# ML Requirements — Auto-Flashcards (UC-1 Baseline)

## Model Type
- **Baseline / Mock (rule-based)**: No training phase. Deterministic splitter → sentence to Q/A.
- Optional: Swap-in an external LLM API later (behind the same interface).

## Inputs
- Text extracted from PDF/notes (UTF-8). Max size for baseline: **~50–100 KB** per request.

## Outputs (aligns with OpenAPI `Card`)
```json
[
  { "question": "string", "answer": "string", "difficulty": 1 }
]
