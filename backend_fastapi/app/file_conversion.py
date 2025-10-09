from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import Tuple

from PIL import Image  # type: ignore
from reportlab.lib.pagesizes import A4  # type: ignore
from reportlab.lib.utils import simpleSplit  # type: ignore
from reportlab.pdfbase import pdfmetrics  # type: ignore
from reportlab.pdfbase.cidfonts import UnicodeCIDFont  # type: ignore
from reportlab.pdfgen import canvas  # type: ignore

try:  # python-docx is optional in type checking but required at runtime
    from docx import Document  # type: ignore
except Exception:  # pragma: no cover - fallback when dependency missing
    Document = None  # type: ignore


_logger = logging.getLogger("file_conversion")

_TEXT_EXTENSIONS = {".txt", ".md", ".markdown"}
_TEXT_MIME_TYPES = {
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/json",
}
_DOCX_EXTENSIONS = {".docx"}
_DOCX_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}


def _safe_decode_text(data: bytes) -> str:
    for enc in ("utf-8", "utf-16", "gb18030", "latin-1"):
        try:
            return data.decode(enc)
        except Exception:
            continue
    return data.decode("utf-8", errors="ignore")


_FONT_NAME = "STSong-Light"
_FONT_INITIALIZED = False


def _ensure_text_font() -> None:
    global _FONT_INITIALIZED, _FONT_NAME
    if _FONT_INITIALIZED:
        return
    try:
        pdfmetrics.registerFont(UnicodeCIDFont(_FONT_NAME))
    except Exception:
        fallback = "HeiseiMin-W3"
        pdfmetrics.registerFont(UnicodeCIDFont(fallback))
        _FONT_NAME = fallback
    _FONT_INITIALIZED = True


def _text_to_pdf(text: str) -> bytes:
    _ensure_text_font()
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setFont(_FONT_NAME, 12)
    width, height = A4
    max_width = width - 72
    y = height - 36
    lines = text.splitlines() or [""]
    for line in lines:
        chunks = simpleSplit(line or " ", _FONT_NAME, 12, max_width) or [" "]
        for chunk in chunks:
            c.drawString(36, y, chunk)
            y -= 16
            if y < 36:
                c.showPage()
                c.setFont(_FONT_NAME, 12)
                y = height - 36
    c.save()
    return buffer.getvalue()


def _docx_to_text(data: bytes) -> str:
    if Document is None:
        raise RuntimeError("python-docx is not available")
    try:
        document = Document(io.BytesIO(data))
    except Exception as exc:  # pragma: no cover - dependent on external data
        raise RuntimeError("failed to parse DOCX") from exc
    parts = [p.text for p in document.paragraphs if p.text]
    return "\n".join(parts)


def _image_to_pdf(data: bytes) -> bytes:
    with Image.open(io.BytesIO(data)) as image:
        if image.mode in ("RGBA", "LA"):
            image = image.convert("RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="PDF")
    return buffer.getvalue()


def ensure_pdf_bytes(
    name: str,
    content_type: str | None,
    data: bytes,
) -> Tuple[str, bytes, str]:
    """Return a (name, data, content_type) tuple guaranteed to be PDF."""

    raw_name = (name or "upload.bin").strip() or "upload.bin"
    ext = Path(raw_name).suffix.lower()
    ctype = (content_type or "").strip().lower()

    pdf_name = str(Path(raw_name).with_suffix(".pdf"))

    if ext == ".pdf" or ctype == "application/pdf":
        return (pdf_name if ext != ".pdf" else raw_name, data, "application/pdf")

    try:
        if ext in _TEXT_EXTENSIONS or ctype in _TEXT_MIME_TYPES:
            text = _safe_decode_text(data)
            pdf_bytes = _text_to_pdf(text)
            return pdf_name, pdf_bytes, "application/pdf"

        if ext in _DOCX_EXTENSIONS or ctype in _DOCX_MIME_TYPES:
            text = _docx_to_text(data)
            pdf_bytes = _text_to_pdf(text)
            return pdf_name, pdf_bytes, "application/pdf"

        if ctype.startswith("image/") or ext in _IMAGE_EXTENSIONS:
            pdf_bytes = _image_to_pdf(data)
            return pdf_name, pdf_bytes, "application/pdf"
    except Exception as exc:  # pragma: no cover - conversion errors are rare
        _logger.warning("Failed to convert file %s to PDF: %s", raw_name, exc)

    # Fallback: return original data; upstream may reject unsupported types
    fallback_type = ctype or "application/octet-stream"
    return raw_name, data, fallback_type
