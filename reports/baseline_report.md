# Baseline Report (Lab 2 – Auto‑Flashcards)

**Date:** 2025-10-06

## Model / Approach
- **Generation:** OpenAI Chat (preferred) or fallback mock (heuristic sentence Q→A).
- **Prompts:** See `ml/prompt_templates.py` (`PROMPT_QA_EN`, `PROMPT_QA_RU`).
- **Languages:** English + Russian.

## Test Data
- `data/sample_notes.txt` (English, ~4 lines)
- `data/sample_lecture.pdf` (placeholder – add any 1–2 page PDF)

## Run (baseline)
Input: ~1 short paragraph → Output: 4 cards  
Latency (mock): ~0.01 s locally.  
Estimated Latency (LLM API): 3–8 s for 15–20 cards (within target 10 s).

### Sample Input
```
Cognitive Load Theory (CLT) limits working memory. Intrinsic load depends on complexity; extraneous load stems from poor design. Segmenting content and dual‑coding aid learning. Spaced repetition improves long‑term retention.
```

### Sample Output (first 4 cards)
```json
[
  {
    "question": "What is the key idea of sentence 1?",
    "answer": "Cognitive Load Theory (CLT) limits working memory."
  },
  {
    "question": "What is the key idea of sentence 2?",
    "answer": "Intrinsic load depends on complexity; extraneous load stems from poor design."
  },
  {
    "question": "What is the key idea of sentence 3?",
    "answer": "Segmenting content and dual‑coding aid learning."
  },
  {
    "question": "What is the key idea of sentence 4?",
    "answer": "Spaced repetition improves long‑term retention."
  }
]
```

## Issues observed
- Mock generator is simplistic (creates generic questions).
- Real LLM may hallucinate if text is ambiguous; needs stricter prompts/temperature.
- Need PDF text extraction step (pypdf) for end‑to‑end runs.

## Next steps (Sprint 3)
- Add PDF → text extraction pipeline with `pypdf` + language detection.
- Add deduplication + keyphrase ranking (e.g., embeddings) before prompting.
- Add evaluation harness (factuality rubric + JSON schema validation).
- Optional: add RU‑specific style rules and tests.

## KPI vs Targets
- **Latency:** ✔ (estimate ≤ 10 s on LLM)
- **Accuracy:** △ Baseline mock not measured; LLM expected ≈ 85% with constrained prompts
- **Cost:** ✔ With small models or 1–2 generations/day ≤ $0.05
