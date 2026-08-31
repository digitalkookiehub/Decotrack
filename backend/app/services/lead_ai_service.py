"""AI triage for incoming WhatsApp leads — pulls structured signal (city,
budget) out of free-text messages and drafts a first-reply suggestion, via
Gemini. Best-effort only: a failure here must never block lead creation."""
import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

PROMPT = (
    "You are triaging an incoming WhatsApp enquiry for an interior design and furniture "
    "manufacturing company's sales team. Read the customer's message below and extract:\n"
    "- city: the city they want work done in, if mentioned. Null if not mentioned.\n"
    "- budget_estimate_inr: a numeric budget in Indian Rupees if they mention one — convert "
    "'lakh'/'lakhs' to numbers (e.g. '5 lakh' -> 500000, '80k' -> 80000). Null if not mentioned.\n"
    "- summary: one or two sentences in English paraphrasing what the customer is asking for, "
    "regardless of what language the message itself is in.\n"
    "- suggested_reply: a short, polite, professional WhatsApp reply a salesperson could send to "
    "acknowledge the enquiry and ask one clarifying next-step question. Match the customer's "
    "language/tone where you can tell what it is; default to English otherwise.\n\n"
    "Customer's message:\n{message}"
)

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "city": {"type": "STRING", "nullable": True},
        "budget_estimate_inr": {"type": "NUMBER", "nullable": True},
        "summary": {"type": "STRING"},
        "suggested_reply": {"type": "STRING"},
    },
    "required": ["summary", "suggested_reply"],
}


def triage_message(message_body: str | None) -> dict | None:
    """Returns {city, budget_estimate_inr, summary, suggested_reply} or None if
    triage isn't possible (no key configured, empty message, or the API call failed)."""
    if not settings.GEMINI_API_KEY or not message_body or not message_body.strip():
        return None

    body = {
        "contents": [{"parts": [{"text": PROMPT.format(message=message_body)}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            # Lower than default for reliable city/budget extraction, but not 0 —
            # suggested_reply reads better with a little natural variance.
            "temperature": 0.3,
        },
    }

    url = GEMINI_URL.format(model=settings.GEMINI_MODEL)
    try:
        resp = httpx.post(url, params={"key": settings.GEMINI_API_KEY}, json=body, timeout=30.0)
        resp.raise_for_status()
        raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(raw_text)
    except Exception:
        logger.warning("Lead triage failed for message %r", message_body, exc_info=True)
        return None

    if not isinstance(result, dict) or not result.get("summary") or not result.get("suggested_reply"):
        logger.warning("Lead triage returned unusable result: %r", result)
        return None

    return {
        "city": (result.get("city") or "").strip() or None,
        "budget_estimate_inr": result.get("budget_estimate_inr"),
        "summary": result["summary"].strip(),
        "suggested_reply": result["suggested_reply"].strip(),
    }
