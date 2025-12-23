from __future__ import annotations

import io
import re
from typing import Optional

from docx import Document  # python-docx
from pypdf import PdfReader  # pypdf


def _clean_text(s: str) -> str:
    s = s.replace("\x00", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract_text_from_bytes(
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> str:
    """
    Extract text from TXT / DOCX / PDF.
    - DOCX: python-docx Document accepts a file-like object (BytesIO). :contentReference[oaicite:1]{index=1}
    - PDF: pypdf PdfReader + page.extract_text(). :contentReference[oaicite:2]{index=2}
    """
    name = (filename or "").lower().strip()

    # TXT
    if name.endswith(".txt") or (content_type or "").startswith("text/"):
        try:
            return _clean_text(file_bytes.decode("utf-8"))
        except UnicodeDecodeError:
            return _clean_text(file_bytes.decode("utf-8", errors="ignore"))

    # DOCX
    if name.endswith(".docx") or content_type in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }:
        doc = Document(io.BytesIO(file_bytes))
        parts = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
        return _clean_text("\n".join(parts))

    # PDF
    if name.endswith(".pdf") or content_type == "application/pdf":
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text() or ""
            if t.strip():
                pages_text.append(t)
        return _clean_text("\n".join(pages_text))

    # Unsupported
    raise ValueError("Unsupported file type. Please upload TXT, DOCX, or PDF.")
