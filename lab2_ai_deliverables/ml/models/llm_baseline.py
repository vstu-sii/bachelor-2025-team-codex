# -*- coding: utf-8 -*-
"""
LLM baseline with optional real OpenAI call or a mock fallback.
"""
from typing import List, Dict
import json, time, os

from lab2_ai_deliverables.ml.prompt_templates import qa_prompt_en, qa_prompt_ru
from lab2_ai_deliverables.ml.models.baseline import _estimate_difficulty
from lab2_ai_deliverables.ml.metrics import GenerationMetrics, log_metrics_jsonl
from lab2_ai_deliverables.ml.observability.langfuse_client import trace_llm_generation

# Try import openai client (new)
try:
    from openai import OpenAI  # type: ignore
    _HAS_OPENAI = True
except Exception:
    OpenAI = None  # type: ignore
    _HAS_OPENAI = False

def _mock_llm_generate(text: str, lang: str = "en", max_cards: int = 10) -> List[Dict]:
    sentences = [s.strip() for s in text.replace("\n"," ").split('.') if s.strip()]
    cards = []
    for i, s in enumerate(sentences[:max_cards]):
        q = f"Explain the main idea #{i+1}" if not lang.startswith("ru") else f"Объясните основную идею #{i+1}"
        cards.append({"question": q, "answer": s, "difficulty": _estimate_difficulty(s)})
    return cards

def _parse_openai_json_response(raw_text: str) -> List[Dict]:
    try:
        data = json.loads(raw_text)
    except Exception as e:
        raise ValueError("Failed to parse LLM JSON output: " + str(e))
    cards = data.get("cards", [])
    if not isinstance(cards, list):
        raise ValueError("LLM response JSON must contain a list under 'cards' key.")
    return cards

def _llm_call_openai(prompt: str, model: str = "gpt-4.1-mini") -> str:
    client = OpenAI()
    completion = client.responses.create(model=model, input=prompt, response_format={"type":"json_object"})
    try:
        raw = completion.output[0].content[0].text
    except Exception:
        raw = str(completion)
    return raw

def generate_flashcards_llm(text: str, lang: str = "en", max_cards: int = 10, model: str = "gpt-4.1-mini") -> List[Dict]:
    start = time.perf_counter()
    prompt = qa_prompt_ru("Auto-Flashcards UC-1", text, max_cards=max_cards) if lang.lower().startswith("ru") else qa_prompt_en("Auto-Flashcards UC-1", text, max_cards=max_cards)

    use_real = _HAS_OPENAI and os.getenv("OPENAI_API_KEY")
    if use_real:
        raw = _llm_call_openai(prompt, model=model)
        cards = _parse_openai_json_response(raw)
        engine = "llm-baseline"
    else:
        cards = _mock_llm_generate(text, lang=lang, max_cards=max_cards)
        engine = "llm-baseline-mock"

    for c in cards:
        if "difficulty" not in c:
            c["difficulty"] = _estimate_difficulty(c.get("answer",""))

    latency = time.perf_counter() - start

    m = GenerationMetrics.create(engine=engine, lang=lang, num_cards=len(cards), input_text=text, latency_s=latency, model=(model if use_real else "mock"))
    log_metrics_jsonl(m)

    try:
        trace_llm_generation(input_text=text, cards=cards, model=(model if use_real else "mock"), latency_s=latency, lang=lang)
    except Exception:
        pass

    print(f"[LLM baseline] engine={engine} generated={len(cards)} latency_s={latency:.3f}")
    return cards
