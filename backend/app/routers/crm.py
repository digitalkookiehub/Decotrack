import math
from typing import Annotated

from fastapi import APIRouter, Depends, File, Header, Query, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import require_any
from app.exceptions import BadRequestError, ForbiddenError
from app.models.crm import LeadStatus
from app.models.user import User
from app.schemas.crm import (
    AutoLeadResponse,
    BulkCallLogRequest,
    CRMStatsResponse,
    FollowupCreate,
    FollowupResponse,
    FollowupUpdate,
    InteractionCreate,
    InteractionResponse,
    LeadConvertRequest,
    LeadCreate,
    LeadDetailResponse,
    LeadMeasurementCreate,
    LeadMeasurementResponse,
    LeadMeasurementUpdate,
    LeadResponse,
    LeadUpdate,
    PhoneLookupResponse,
    WebsiteContactForm,
    WhatsAppWebhookMessage,
)
from app.services import crm_service

router = APIRouter(prefix="/crm", tags=["CRM"])
limiter = Limiter(key_func=get_remote_address)


def _validate_api_key(x_api_key: str | None = Header(None)) -> None:
    """Validate API key for public CRM endpoints.
    If CRM_API_KEYS is empty in config, all requests are allowed (dev mode).
    """
    configured_keys = settings.CRM_API_KEYS.strip()
    if not configured_keys:
        return  # No keys configured = dev mode, allow all
    valid_keys = [k.strip() for k in configured_keys.split(",") if k.strip()]
    if not x_api_key or x_api_key not in valid_keys:
        raise ForbiddenError("Invalid or missing API key")


# ── Leads ─────────────────────────────────────────────────────


@router.get("/leads")
async def list_leads(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = None,
    status: LeadStatus | None = None,
    source: str | None = None,
    assigned_to: int | None = None,
):
    leads, total = crm_service.get_leads(db, page, per_page, search, status, source, assigned_to)
    items = []
    for lead in leads:
        resp = LeadResponse.model_validate(lead)
        resp.assignee_name = lead.assignee.full_name if lead.assignee else None
        items.append(resp)
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/leads", response_model=LeadResponse, status_code=201)
async def create_lead(
    data: LeadCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
):
    lead = crm_service.create_lead(db, data, user)
    resp = LeadResponse.model_validate(lead)
    resp.assignee_name = lead.assignee.full_name if lead.assignee else None
    return resp


@router.get("/leads/{lead_id}")
async def get_lead(
    lead_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    lead = crm_service.get_lead(db, lead_id)
    resp = LeadDetailResponse.model_validate(lead)
    resp.assignee_name = lead.assignee.full_name if lead.assignee else None

    resp.interactions = []
    for i in lead.interactions:
        ir = InteractionResponse.model_validate(i)
        ir.logger_name = i.logger.full_name if i.logger else None
        resp.interactions.append(ir)

    resp.followups = []
    for f in lead.followups:
        fr = FollowupResponse.model_validate(f)
        fr.assignee_name = f.assignee.full_name if f.assignee else None
        fr.lead_name = lead.name
        resp.followups.append(fr)

    resp.measurements = [LeadMeasurementResponse.model_validate(m) for m in lead.measurements]

    return resp


@router.put("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: int,
    data: LeadUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    lead = crm_service.update_lead(db, lead_id, data)
    resp = LeadResponse.model_validate(lead)
    resp.assignee_name = lead.assignee.full_name if lead.assignee else None
    return resp


@router.post("/leads/{lead_id}/convert", response_model=LeadResponse)
async def convert_lead(
    lead_id: int,
    data: LeadConvertRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
):
    lead = crm_service.convert_lead(db, lead_id, data, user)
    resp = LeadResponse.model_validate(lead)
    resp.assignee_name = lead.assignee.full_name if lead.assignee else None
    return resp


# ── Lead Measurements ─────────────────────────────────────────


@router.post("/leads/{lead_id}/measurements", response_model=LeadMeasurementResponse, status_code=201)
async def add_measurement(
    lead_id: int,
    data: LeadMeasurementCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
):
    return crm_service.add_measurement(db, lead_id, data, user)


@router.post("/leads/{lead_id}/measurements/scan", response_model=list[LeadMeasurementResponse], status_code=201)
async def scan_measurements(
    lead_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
    file: UploadFile = File(...),
):
    """Photograph a carpenter's handwritten site-measurement sheet — AI reads it and
    saves each room's dimensions directly, ready to review/edit on the lead page."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise BadRequestError("Upload an image file")
    contents = await file.read()
    return crm_service.scan_measurements(db, lead_id, contents, file.content_type, user)


@router.put("/leads/{lead_id}/measurements/{measurement_id}", response_model=LeadMeasurementResponse)
async def update_measurement(
    lead_id: int,
    measurement_id: int,
    data: LeadMeasurementUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return crm_service.update_measurement(db, lead_id, measurement_id, data)


@router.delete("/leads/{lead_id}/measurements/{measurement_id}", status_code=204)
async def delete_measurement(
    lead_id: int,
    measurement_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    crm_service.delete_measurement(db, lead_id, measurement_id)


# ── Interactions ──────────────────────────────────────────────


@router.get("/interactions")
async def list_interactions(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    lead_id: int | None = None,
    client_id: int | None = None,
    interaction_type: str | None = None,
    search: str | None = None,
):
    interactions, total = crm_service.get_interactions(
        db, page, per_page, lead_id, client_id, interaction_type, search
    )
    items = []
    for i in interactions:
        resp = InteractionResponse.model_validate(i)
        resp.logger_name = i.logger.full_name if i.logger else None
        items.append(resp)
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/interactions", response_model=InteractionResponse, status_code=201)
async def create_interaction(
    data: InteractionCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
):
    interaction = crm_service.create_interaction(db, data, user)
    resp = InteractionResponse.model_validate(interaction)
    resp.logger_name = user.full_name
    return resp


@router.post("/interactions/call-log")
async def bulk_call_log(
    data: BulkCallLogRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
):
    results = crm_service.bulk_log_calls(db, data, user)
    new_leads = sum(1 for r in results if r["is_new_lead"])
    return {
        "message": f"{len(results)} calls logged, {new_leads} new leads created",
        "count": len(results),
        "new_leads_created": new_leads,
        "details": results,
    }


# ── Followups ─────────────────────────────────────────────────


@router.get("/followups")
async def list_followups(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    filter: str | None = Query(None, alias="filter"),
):
    followups, total = crm_service.get_followups(
        db, page, per_page, filter_type=filter, assigned_to=user.id
    )
    items = []
    for f in followups:
        resp = FollowupResponse.model_validate(f)
        resp.assignee_name = f.assignee.full_name if f.assignee else None
        resp.lead_name = f.lead.name if f.lead else None
        resp.client_name = f.client.name if f.client else None
        items.append(resp)
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/followups", response_model=FollowupResponse, status_code=201)
async def create_followup(
    data: FollowupCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
):
    followup = crm_service.create_followup(db, data, user)
    resp = FollowupResponse.model_validate(followup)
    resp.assignee_name = user.full_name
    return resp


@router.put("/followups/{followup_id}", response_model=FollowupResponse)
async def update_followup(
    followup_id: int,
    data: FollowupUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    followup = crm_service.update_followup(db, followup_id, data)
    resp = FollowupResponse.model_validate(followup)
    resp.assignee_name = followup.assignee.full_name if followup.assignee else None
    resp.lead_name = followup.lead.name if followup.lead else None
    resp.client_name = followup.client.name if followup.client else None
    return resp


# ── Lookup & Stats ────────────────────────────────────────────


@router.get("/lookup", response_model=PhoneLookupResponse)
async def phone_lookup(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    phone: str = Query(..., min_length=5),
):
    result = crm_service.phone_lookup(db, phone)
    # Convert Interaction ORM objects to response models
    recent = []
    for i in result["recent_interactions"]:
        resp = InteractionResponse.model_validate(i)
        resp.logger_name = i.logger.full_name if i.logger else None
        recent.append(resp)
    result["recent_interactions"] = recent
    return result


@router.get("/stats", response_model=CRMStatsResponse)
async def crm_stats(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return crm_service.get_crm_stats(db)


# ── Public Endpoints (No Auth) ───────────────────────────────


@router.post("/public/website-lead", response_model=AutoLeadResponse, status_code=201)
@limiter.limit("10/minute")
async def website_contact_form(
    request: Request,
    data: WebsiteContactForm,
    db: Annotated[Session, Depends(get_db)],
    _key: Annotated[None, Depends(_validate_api_key)],
):
    """Public endpoint for website contact forms. No login required.
    Secured by API key (X-Api-Key header). Rate limited to 10/min per IP.

    Set CRM_API_KEYS in .env to enable key validation.
    If CRM_API_KEYS is empty, all requests are allowed (dev mode).
    """
    return crm_service.create_lead_from_website(db, data)


@router.post("/public/whatsapp-webhook", response_model=AutoLeadResponse, status_code=201)
@limiter.limit("30/minute")
async def whatsapp_webhook(
    request: Request,
    data: WhatsAppWebhookMessage,
    db: Annotated[Session, Depends(get_db)],
    _key: Annotated[None, Depends(_validate_api_key)],
):
    """Webhook for WhatsApp Business API. No login required.
    Secured by API key (X-Api-Key header). Rate limited to 30/min per IP.

    Set CRM_API_KEYS in .env to enable key validation.
    """
    return crm_service.create_lead_from_whatsapp(db, data)


@router.get("/public/whatsapp-webhook")
async def whatsapp_verify(
    request: Request,
):
    """WhatsApp webhook verification endpoint (Meta requires GET for verification).
    Returns the hub.challenge for Meta webhook setup.
    """
    mode = request.query_params.get("hub.mode")
    challenge = request.query_params.get("hub.challenge")
    verify_token = request.query_params.get("hub.verify_token")

    # You can set your own verify token in env vars
    if mode == "subscribe" and challenge:
        return int(challenge)
    return {"status": "ok"}
