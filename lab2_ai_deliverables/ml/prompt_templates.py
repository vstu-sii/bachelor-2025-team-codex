"""
Prompt templates for Auto‑Flashcards (Lab 2)
"""

PROMPT_QA_EN = """
You are an assistant that extracts concise study flashcards.
Extract 15–20 diverse, key Question–Answer pairs from the text below.
- Keep questions short and unambiguous.
- Keep answers factual and grounded strictly in the text (≤ 2 sentences).
- Avoid duplicates and trivial definitions.
- Output **ONLY** valid JSON: a list of objects {{"question": "...", "answer": "..."}}

TEXT:
{text}
"""

PROMPT_QA_RU = """
Ты ассистент, который выделяет краткие учебные карточки.
Извлеки 15–20 ключевых пар Вопрос–Ответ из текста ниже.
- Вопросы — короткие и однозначные.
- Ответы — только по тексту (не более 2 предложений).
- Избегай дубликатов и тривиальных фактов.
- Выведи **ТОЛЬКО** корректный JSON: список объектов {{"question": "...", "answer": "..."}}

ТЕКСТ:
{text}
"""
