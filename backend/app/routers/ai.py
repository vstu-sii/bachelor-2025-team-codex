# backend/app/routers/ai.py

from __future__ import annotations

import os
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from ml.service.flashcards_service import (
    flashcards_service,
    FlashcardsRequest,
)
from ml.api.schemas import (
    Flashcard,
    GenerateFlashcardsRequest,
    GenerateFlashcardsResponse,
)

router = APIRouter()


# --------- helpers: extract text from uploads (txt/pdf/docx) ---------

def _safe_limit_text(text: str, max_chars: int = 20000) -> str:
    """Avoid sending extremely long texts into the model/service."""
    text = (text or "").strip()
    if len(text) > max_chars:
        return text[:max_chars]
    return text


def _guess_ext(filename: str) -> str:
    name = (filename or "").lower().strip()
    if "." in name:
        return name.rsplit(".", 1)[-1]
    return ""


async def _extract_text_from_upload(file: UploadFile) -> str:
    """
    Extract text from UploadFile (txt/pdf/docx).
    Raises 415 for unsupported types.
    """
    raw = await file.read()
    if not raw:
        return ""

    content_type = (file.content_type or "").lower()
    ext = _guess_ext(file.filename or "")

    # DOCX
    if content_type in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    } or ext == "docx":
        try:
            from docx import Document  # python-docx
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"python-docx is not installed/available: {exc}",
            )

        doc = Document(BytesIO(raw))
        parts = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
        return "\n".join(parts).strip()

    # PDF
    if content_type == "application/pdf" or ext == "pdf":
        try:
            from pypdf import PdfReader
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"pypdf is not installed/available: {exc}",
            )

        reader = PdfReader(BytesIO(raw))
        pages_text: List[str] = []
        for page in reader.pages:
            try:
                pages_text.append((page.extract_text() or "").strip())
            except Exception:
                pages_text.append("")
        return "\n".join([t for t in pages_text if t]).strip()

    # Plain text (fallback)
    if content_type.startswith("text/") or ext in {"txt", "md", "csv", "log"}:
        return raw.decode("utf-8", errors="replace").strip()

    # Unknown type
    raise HTTPException(
        status_code=415,
        detail=f"Unsupported file type: content_type={file.content_type}, filename={file.filename}",
    )


# --------- endpoints ---------

@router.post(
    "/generate",
    response_model=GenerateFlashcardsResponse,
    summary="Генерация флеш-карточек из текста",
)
async def generate_flashcards_endpoint(
    payload: GenerateFlashcardsRequest,
) -> GenerateFlashcardsResponse:
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Текст для генерации пустой")

    service_request = FlashcardsRequest(
        text=_safe_limit_text(text),
        max_cards=payload.max_cards,
    )

    result = flashcards_service.generate(service_request)

    cards_models: List[Flashcard] = [Flashcard(**card) for card in result.cards]

    return GenerateFlashcardsResponse(
        cards=cards_models,
        cached=result.cached,
        latency_ms=result.latency_ms,
    )


@router.post(
    "/generate-file",
    response_model=GenerateFlashcardsResponse,
    summary="Генерация флеш-карточек из файла (txt/pdf/docx)",
)
async def generate_flashcards_from_file_endpoint(
    file: UploadFile = File(...),
    max_cards: int = Form(5),
) -> GenerateFlashcardsResponse:
    extracted = await _extract_text_from_upload(file)
    extracted = (extracted or "").strip()

    if not extracted:
        raise HTTPException(
            status_code=400,
            detail="Не удалось извлечь текст из файла (файл пустой или без текста).",
        )

    service_request = FlashcardsRequest(
        text=_safe_limit_text(extracted),
        max_cards=max_cards,
    )

    result = flashcards_service.generate(service_request)
    cards_models: List[Flashcard] = [Flashcard(**card) for card in result.cards]

    return GenerateFlashcardsResponse(
        cards=cards_models,
        cached=result.cached,
        latency_ms=result.latency_ms,
    )
