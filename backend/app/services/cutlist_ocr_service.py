"""AI Vision: reads a photographed handwritten/printed cutting list and
extracts structured panel rows for the Cut Planner — via Gemini Vision."""
import base64
import json
import logging

import httpx

from app.config import settings
from app.exceptions import BadRequestError

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

PROMPT = (
    "You are reading a furniture cutting list (handwritten or printed) from a carpenter or "
    "factory worker. Extract each row as a panel.\n"
    "- label: the part name (e.g. 'Side Panel', 'Top', 'Shelf'); if illegible or missing, use an empty string.\n"
    "- length_mm: the longer dimension in millimeters — convert from cm/inches/feet if those units are shown.\n"
    "- width_mm: the shorter dimension in millimeters — same unit conversion rule.\n"
    "- quantity: integer count; default to 1 if not specified.\n"
    "Only include rows where both dimensions are readable. Ignore headers, totals, page numbers, "
    "or any text that isn't a cutting-list row."
)

RESPONSE_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "label": {"type": "STRING"},
            "length_mm": {"type": "NUMBER"},
            "width_mm": {"type": "NUMBER"},
            "quantity": {"type": "INTEGER"},
        },
        "required": ["length_mm", "width_mm", "quantity"],
    },
}


def extract_panels_from_image(image_bytes: bytes, mime_type: str) -> list[dict]:
    """Returns a list of {label, length, width, quantity} panel dicts (frontend field names).

    Never raises on model-side ambiguity — worst case it returns an empty list and the
    user fills the panel table in by hand, same as if this feature didn't exist.
    """
    if not settings.GEMINI_API_KEY:
        raise BadRequestError("AI cutting-list scan isn't configured — set GEMINI_API_KEY")

    body = {
        "contents": [{
            "parts": [
                {"text": PROMPT},
                {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}},
            ],
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "temperature": 0,
        },
    }

    url = GEMINI_URL.format(model=settings.GEMINI_MODEL)
    try:
        resp = httpx.post(url, params={"key": settings.GEMINI_API_KEY}, json=body, timeout=60.0)
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        logger.warning("Cutting-list OCR request failed", exc_info=True)
        raise BadRequestError("Couldn't read the cutting list — try a clearer, well-lit photo")

    try:
        rows = json.loads(raw_text)
    except (ValueError, TypeError):
        logger.warning("Cutting-list OCR returned unparseable JSON: %r", raw_text)
        raise BadRequestError("Couldn't read the cutting list — try a clearer, well-lit photo")

    panels = []
    for row in rows if isinstance(rows, list) else []:
        try:
            length = float(row["length_mm"])
            width = float(row["width_mm"])
            qty = int(row.get("quantity") or 1)
        except (KeyError, TypeError, ValueError):
            continue
        if length <= 0 or width <= 0 or qty <= 0:
            continue
        panels.append({
            "label": str(row.get("label") or "").strip(),
            "length": length,
            "width": width,
            "quantity": qty,
        })

    if not panels:
        raise BadRequestError("No readable cutting-list rows found in that photo")

    logger.info("Cutting-list OCR extracted %d panels", len(panels))
    return panels
