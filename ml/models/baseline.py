"""
Resilient baseline flashcards generator.

Key improvements:
1) Structured Outputs via OpenAI Responses API parse() + Pydantic schema
   (reduces parsing errors and forces schema compliance).
2) Retry with exponential backoff (+ jitter) for transient failures (429/5xx/timeouts).
3) Circuit breaker: on auth errors (401/403/invalid key), disable OpenAI for a cooldown period.
4) Hard limits and sanitization to avoid validation errors downstream (e.g., answer length).

Docs:
- Structured outputs + parse: https://platform.openai.com/docs/guides/structured-outputs
- Rate limits + retry advice: https://platform.openai.com/docs/guides/rate-limits
"""

from __future__ import annotations

from typing import List, Dict, Optional
import logging
import os
import json
import time
import random
import re

from pydantic import BaseModel, Field, ValidationError
from openai import OpenAI

logger = logging.getLogger(__name__)

# -----------------------------
# Env helpers / config
# -----------------------------

def _env_bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}

def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default

def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


LLM_ENABLED = _env_bool("LLM_ENABLED", True)

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TIMEOUT_SEC = _env_float("OPENAI_TIMEOUT_SEC", 12.0)
OPENAI_MAX_RETRIES = _env_int("OPENAI_MAX_RETRIES", 2)
OPENAI_DISABLE_COOLDOWN_SEC = _env_int("OPENAI_DISABLE_COOLDOWN_SEC", 300)

# To keep prompts and outputs under control for large documents
OPENAI_INPUT_MAX_CHARS = _env_int("OPENAI_INPUT_MAX_CHARS", 12000)

# Downstream constraints (your API validation / DB / etc.)
QUESTION_MAX_LEN = _env_int("FLASHCARD_QUESTION_MAX_LEN", 400)
ANSWER_MAX_LEN = _env_int("FLASHCARD_ANSWER_MAX_LEN", 1800)  # keep < 2000 as safety

MAX_CARDS_CAP = _env_int("FLASHCARDS_MAX_CARDS_CAP", 30)

# process-level circuit breaker
_OPENAI_DISABLED_UNTIL_TS: float = 0.0


# -----------------------------
# Pydantic schema (Structured Outputs)
# -----------------------------

class Flashcard(BaseModel):
    question: str = Field(min_length=1, max_length=QUESTION_MAX_LEN)
    answer: str = Field(min_length=1, max_length=ANSWER_MAX_LEN)

class FlashcardsPayload(BaseModel):
    cards: List[Flashcard] = Field(default_factory=list)


# -----------------------------
# Text sanitization / clamping
# -----------------------------

def _clamp_str(s: str, max_len: int) -> str:
    s = (s or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1].rstrip() + "…"

def _sanitize_text(s: str) -> str:
    # remove null bytes and normalize whitespace a bit
    s = (s or "").replace("\x00", " ")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

def _normalize_cards(raw_cards: List[Dict[str, str]], max_cards: int) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for c in raw_cards[:max_cards]:
        q = _clamp_str(_sanitize_text(c.get("question", "")), QUESTION_MAX_LEN)
        a = _clamp_str(_sanitize_text(c.get("answer", "")), ANSWER_MAX_LEN)
        if q and a:
            out.append({"question": q, "answer": a})
    return out


# -----------------------------
# Local fallback (no LLM)
# -----------------------------

_SENT_SPLIT_RE = re.compile(r"[.!?]+(?:\s+|$)")

def _split_into_sentences(text: str) -> List[str]:
    parts = [p.strip() for p in _SENT_SPLIT_RE.split(text) if p.strip()]
    return parts

def _generate_flashcards_locally(text: str, max_cards: int) -> List[Dict[str, str]]:
    cleaned = _sanitize_text(text)
    if not cleaned:
        return []

    sentences = _split_into_sentences(cleaned)
    if not sentences:
        return [{"question": "Какова основная идея этого текста?", "answer": _clamp_str(cleaned, ANSWER_MAX_LEN)}]

    # If many sentences, sample evenly across text instead of only first N
    if len(sentences) > max_cards:
        step = max(1, len(sentences) // max_cards)
        picked = sentences[0 : step * max_cards : step]
    else:
        picked = sentences

    cards: List[Dict[str, str]] = []
    for idx, sentence in enumerate(picked[:max_cards], start=1):
        topic = " ".join(sentence.split()[:6]).strip()
        q = f"Что означает/о чём речь: «{topic}...»?"
        a = sentence
        cards.append({"question": q, "answer": a})

    return _normalize_cards(cards, max_cards)


# -----------------------------
# OpenAI helpers (retry/backoff/circuit breaker)
# -----------------------------

def _is_openai_disabled() -> bool:
    return time.time() < _OPENAI_DISABLED_UNTIL_TS

def _disable_openai_temporarily(reason: str) -> None:
    global _OPENAI_DISABLED_UNTIL_TS
    _OPENAI_DISABLED_UNTIL_TS = time.time() + float(OPENAI_DISABLE_COOLDOWN_SEC)
    logger.warning("OpenAI disabled for %ss. Reason: %s", OPENAI_DISABLE_COOLDOWN_SEC, reason)

def _looks_like_auth_error(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None)
    if status in (401, 403):
        return True
    msg = str(exc).lower()
    return ("invalid_api_key" in msg) or ("incorrect api key" in msg) or ("authentication" in msg and "error" in msg)

def _is_retryable(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None)
    if status in (429, 500, 502, 503, 504):
        return True
    msg = str(exc).lower()
    return ("timeout" in msg) or ("timed out" in msg) or ("connection" in msg) or ("temporarily" in msg)

def _sleep_backoff(attempt: int) -> None:
    # exponential backoff with jitter; capped
    base = 0.6 * (2 ** attempt)
    jitter = random.uniform(0.0, 0.3)
    time.sleep(min(base + jitter, 4.0))

def _build_messages(text: str, max_cards: int) -> List[Dict[str, str]]:
    system_msg = "Ты лаконичный ассистент, который генерирует флеш-карточки по учебному тексту."
    user_msg = (
        f"Сгенерируй не более {max_cards} флеш-карточек по тексту.\n"
        "Верни ТОЛЬКО JSON строго по схеме:\n"
        '{ "cards": [ { "question": "...", "answer": "..." } ] }\n\n'
        "Требования:\n"
        f"- question <= {QUESTION_MAX_LEN} символов\n"
        f"- answer <= {ANSWER_MAX_LEN} символов\n"
        "- без лишних полей, без комментариев, без markdown\n\n"
        f"Текст:\n{text}"
    )
    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg},
    ]

def _call_llm(text: str, max_cards: int) -> List[Dict[str, str]]:
    if not LLM_ENABLED:
        logger.info("LLM_ENABLED=0 -> local fallback.")
        return []

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY missing -> local fallback.")
        return []

    if _is_openai_disabled():
        logger.info("OpenAI is temporarily disabled -> local fallback.")
        return []

    try:
        client = OpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SEC)
    except Exception as exc:
        logger.exception("Failed to init OpenAI client: %s", exc)
        return []

    # Clamp very long inputs (especially when coming from DOCX/PDF extraction later)
    safe_text = _clamp_str(_sanitize_text(text), OPENAI_INPUT_MAX_CHARS)
    messages = _build_messages(safe_text, max_cards)

    for attempt in range(OPENAI_MAX_RETRIES + 1):
        try:
            # Best path: Responses API structured parsing (if available in SDK)
            if hasattr(client, "responses") and hasattr(client.responses, "parse"):
                resp = client.responses.parse(
                    model=OPENAI_MODEL,
                    input=messages,
                    text_format=FlashcardsPayload,
                )
                payload: Optional[FlashcardsPayload] = getattr(resp, "output_parsed", None)
                if not payload or not payload.cards:
                    return []
                cards = [{"question": c.question, "answer": c.answer} for c in payload.cards]
                return _normalize_cards(cards, max_cards)

            # Compatibility path: ask for JSON and parse manually
            completion = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
            )
            raw = (completion.choices[0].message.content or "").strip()
            if not raw:
                return []

            # Try JSON -> Pydantic
            try:
                data = json.loads(raw)
                parsed = FlashcardsPayload.model_validate(data)
                cards = [{"question": c.question, "answer": c.answer} for c in parsed.cards]
                return _normalize_cards(cards, max_cards)
            except (json.JSONDecodeError, ValidationError):
                # If model returned something non-JSON, no cards
                logger.warning("LLM returned non-JSON or invalid schema; fallback.")
                return []

        except Exception as exc:
            if _looks_like_auth_error(exc):
                _disable_openai_temporarily("Auth error (401/403) or invalid API key.")
                return []

            if attempt >= OPENAI_MAX_RETRIES or not _is_retryable(exc):
                logger.error("LLM call failed (no more retries): %r", exc)
                return []

            logger.warning(
                "LLM call failed; retry %s/%s: %r",
                attempt + 1,
                OPENAI_MAX_RETRIES,
                exc,
            )
            _sleep_backoff(attempt)

    return []


# -----------------------------
# Public API
# -----------------------------

def generate_flashcards(text: str, max_cards: int = 5) -> List[Dict[str, str]]:
    cleaned = _sanitize_text(text)
    if not cleaned:
        return []

    # clamp requested cards
    try:
        max_cards_i = int(max_cards)
    except Exception:
        max_cards_i = 5
    max_cards_i = max(1, min(max_cards_i, MAX_CARDS_CAP))

    # 1) try LLM
    cards = _call_llm(cleaned, max_cards_i)
    if cards:
        return cards

    # 2) local fallback
    return _generate_flashcards_locally(cleaned, max_cards_i)
