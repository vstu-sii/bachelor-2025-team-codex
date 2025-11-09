# -*- coding: utf-8 -*-

"""
Baseline (Mock) generator for UC-1.
No external APIs; fully local and deterministic.

Output conforms to OpenAPI `Card`:
[
  {"question": "string", "answer": "string", "difficulty": int}
]
"""

import re
from typing import List, Dict

_KEYWORDS_HARD = {
    "runtime", "complexity", "derivative", "integral", "theorem",
    "proof", "convergence", "entropy", "gradient", "optimization",
    "NP-hard", "amortized", "asymptotic"
}
_KEYWORDS_EASY = {
    "definition", "is", "are", "means", "refers", "simple", "basic"
}

def _split_sentences(text: str) -> List[str]:
    # Simple, language-agnostic split; keeps abbreviations roughly intact.
    parts = re.split(r'(?<=[\.!\?])\s+', text.strip())
    return [p.strip() for p in parts if p.strip()]

def _estimate_difficulty(sentence: str) -> int:
    s = sentence.lower()
    score = 3
    # length heuristic
    if len(s) < 60:
        score -= 1
    if len(s) > 180:
        score += 1
    # keyword heuristic
    if any(k in s for k in _KEYWORDS_HARD):
        score += 1
    if any(k in s for k in _KEYWORDS_EASY):
        score -= 1
    return min(5, max(1, score))

def generate_flashcards(text: str, lang: str = "en", max_cards: int = 10) -> List[Dict]:
    """
    Turn free text into a list of Q/A cards (mock).
    - `lang`: "en" or "ru" controls question phrasing only.
    - Deterministic: same input -> same output.
    """
    sentences = _split_sentences(text)
    cards: List[Dict] = []

    for i, sent in enumerate(sentences):
        if len(cards) >= max_cards:
            break
        # Build a simple exam-style question
        if lang.lower().startswith("ru"):
            q = f"В чём основная идея #{i+1}?"
        else:
            q = f"What is the main idea #{i+1}?"

        card = {
            "question": q,
            "answer": sent,
            "difficulty": _estimate_difficulty(sent)
        }
        cards.append(card)

    return cards

if __name__ == "__main__":
    demo = "Algorithms analyze growth rates. Arrays allow O(1) access. Sorting compares elements."
    for c in generate_flashcards(demo, lang="en", max_cards=5):
        print(c)
