"""
Baseline generator for Auto‑Flashcards.
- If OPENAI_API_KEY is configured, uses OpenAI chat models.
- Otherwise falls back to a simple mock that fabricates Q&A from the text heuristically.
"""

import os
import json
import re
from typing import List, Dict

try:
    from openai import OpenAI
    _HAS_OPENAI = True
except Exception:
    _HAS_OPENAI = False


def _mock_generate(text: str, max_cards: int = 15) -> List[Dict[str, str]]:
    # Split text into sentences and turn them into Q/A heuristically
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    cards = []
    for i, s in enumerate(sentences):
        s_clean = s.strip()
        if not s_clean:
            continue
        q = f"What is the key idea of sentence {i+1}?"
        a = s_clean
        cards.append({"question": q, "answer": a})
        if len(cards) >= max_cards:
            break
    return cards


def generate_flashcards(text: str, language: str = "en", max_cards: int = 15, temperature: float = 0.2) -> List[Dict[str, str]]:
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("FLASHCARDS_MODEL", "gpt-4o-mini")
    if _HAS_OPENAI and api_key:
        client = OpenAI(api_key=api_key)
        system = "You extract study flashcards. Return ONLY valid JSON list of {question, answer}."
        prompt = f"Extract {max_cards} Q&A flashcards from this {language} text. Answers must be grounded in the text.\n\n{text}"
        try:
            resp = client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            )
            content = resp.choices[0].message.content
            # Try to parse JSON; if not parsable, fallback to mock
            data = json.loads(content)
            if isinstance(data, list):
                # keep only needed fields
                clean = []
                for item in data:
                    q = str(item.get("question", "")).strip()
                    a = str(item.get("answer", "")).strip()
                    if q and a:
                        clean.append({"question": q, "answer": a})
                return clean[:max_cards]
        except Exception:
            pass  # fall back to mock

    return _mock_generate(text, max_cards=max_cards)


if __name__ == "__main__":
    sample_text = "Cognitive Load Theory (CLT) explains limits of working memory. Segmenting content helps. Spaced repetition improves retention."
    cards = generate_flashcards(sample_text, language="en", max_cards=5)
    print(json.dumps(cards, ensure_ascii=False, indent=2))
