"""AI Vision: reads a photographed handwritten/printed site-measurement sheet
and extracts room dimensions — via Gemini Vision."""
import base64
import json
import logging

import httpx

from app.config import settings
from app.exceptions import BadRequestError

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

PROMPT = (
    "You are reading a site-measurement sheet (handwritten or printed) taken by a carpenter or "
    "factory staff during a client site visit for interior design work. Extract each room as a row.\n"
    "- room: the room name (e.g. 'Kitchen', 'Master Bedroom', 'Living Room'); if illegible or missing, use an empty string.\n"
    "- length_mm: the room's length in millimeters. Indian site measurements are very often in FEET "
    "(e.g. '10x8', \"10' x 8'\") — convert feet to mm (1 ft = 304.8 mm). Also convert cm/inches/meters "
    "if those units are shown instead. Null if not readable.\n"
    "- width_mm: the room's width in millimeters, same conversion rules. Null if not readable.\n"
    "- height_mm: ceiling height in millimeters if noted, same conversion rules. Null if not mentioned.\n"
    "- notes: any other relevant detail written for that room (window/door position, obstruction, "
    "special instruction). Empty string if none.\n"
    "Only include rows that are actual room measurements. Ignore headers, client name/address, dates, "
    "or any text that isn't a room's dimensions."
)

RESPONSE_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "room": {"type": "STRING"},
            "length_mm": {"type": "NUMBER", "nullable": True},
            "width_mm": {"type": "NUMBER", "nullable": True},
            "height_mm": {"type": "NUMBER", "nullable": True},
            "notes": {"type": "STRING"},
        },
        "required": ["room"],
    },
}


def extract_measurements_from_image(image_bytes: bytes, mime_type: str) -> list[dict]:
    """Returns a list of {room, length_mm, width_mm, height_mm, notes} dicts.

    Never raises on model-side ambiguity — worst case it returns an empty list and the
    user enters rooms by hand, same as if this feature didn't exist.
    """
    if not settings.GEMINI_API_KEY:
        raise BadRequestError("AI measurement scan isn't configured — set GEMINI_API_KEY")

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
        logger.warning("Measurement sheet OCR request failed", exc_info=True)
        raise BadRequestError("Couldn't read the measurement sheet — try a clearer, well-lit photo")

    try:
        rows = json.loads(raw_text)
    except (ValueError, TypeError):
        logger.warning("Measurement OCR returned unparseable JSON: %r", raw_text)
        raise BadRequestError("Couldn't read the measurement sheet — try a clearer, well-lit photo")

    measurements = []
    for row in rows if isinstance(rows, list) else []:
        room = str(row.get("room") or "").strip()
        if not room:
            continue

        def _num(key: str) -> float | None:
            val = row.get(key)
            try:
                return float(val) if val is not None else None
            except (TypeError, ValueError):
                return None

        measurements.append({
            "room": room,
            "length_mm": _num("length_mm"),
            "width_mm": _num("width_mm"),
            "height_mm": _num("height_mm"),
            "notes": str(row.get("notes") or "").strip() or None,
        })

    if not measurements:
        raise BadRequestError("No readable room measurements found in that photo")

    logger.info("Measurement sheet OCR extracted %d rooms", len(measurements))
    return measurements
