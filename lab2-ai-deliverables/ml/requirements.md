# AI Requirements (Lab 2 – Auto‑Flashcards)

## Model choices
- **LLM (generation):** GPT‑4 class (or equivalent) for robust Q&A extraction.
- **Embeddings (retrieval/semantics):** `text-embedding-3-small` (or equivalent) for chunk selection & dedup.
- **OCR (for PDFs with images):** Tesseract (baseline), optional.

## Quality and performance targets
- **Latency:** ≤ **10 s** to generate **15–20** flashcards from ≤2 pages of text (cold start excluded).
- **Accuracy:** ≥ **85%** factual match to the provided text (manual spot‑check rubric, see below).
- **Language coverage:** **EN + RU** (minimum). Multilingual prompts supported.
- **Determinism:** Temperature ≤ 0.3 for baseline reproducibility.

## Cost constraints
- **≤ $0.05 / user / day** (assuming 1–2 generations of 20 cards/day).
  - Tactics: smaller context windows, chunking, stop at 20 items, compress prompts, reuse embeddings.

## Privacy & compliance
- No training on user data; generation‑only.
- **No data retention** in third‑party services (disable logging where possible).
- Remove PII before sending to API when feasible.
- Store only deck metadata + cards in project DB; keep source files in private storage.

## I/O contract
- **Input:** Plain text (extracted from PDF), language hint (`en|ru`), `max_cards` (15–20).
- **Output:** JSON list of objects: `{ "question": str, "answer": str }`.

## Robustness constraints
- Handle empty/short texts gracefully (return 0–3 cards).
- Deduplicate near‑identical Qs.
- Limit each answer to ≤ 2 sentences.

## Evaluation rubric (first pass)
- **Factuality (60%)**: Answer directly anchored in the source text.
- **Coverage (20%)**: Key concepts represented (breadth).
- **Clarity (10%)**: Questions concise and unambiguous.
- **Format (10%)**: Valid JSON, 15–20 items, no hallucinated citations.

## Baseline stack (dev)
- Python 3.11
- `openai` (or compatible SDK) – generation
- `pypdf` – text extraction (optional for local tests)
- `tiktoken` (optional) – token budgeting
