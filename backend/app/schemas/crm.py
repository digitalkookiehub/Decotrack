from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr

from app.models.crm import CallSource, FollowupStatus, InteractionType, LeadSource, LeadStatus, MeasurementSource


# ── Lead Schemas ──────────────────────────────────────────────


class LeadCreate(BaseModel):
    name: str
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    source: LeadSource = LeadSource.INCOMING_CALL
    assigned_to: int | None = None
    estimated_value: Decimal | None = None
    notes: str | None = None


class LeadUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    source: LeadSource | None = None
    status: LeadStatus | None = None
    assigned_to: int | None = None
    estimated_value: Decimal | None = None
    notes: str | None = None
    lost_reason: str | None = None


class LeadResponse(BaseModel):
    id: int
    lead_number: str
    name: str
    phone: str | None
    email: str | None
    address: str | None
    city: str | None
    state: str | None
    source: LeadSource
    status: LeadStatus
    assigned_to: int | None
    assignee_name: str | None = None
    client_id: int | None
    project_id: int | None
    estimated_value: Decimal | None
    notes: str | None
    lost_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadDetailResponse(LeadResponse):
    interactions: list["InteractionResponse"] = []
    followups: list["FollowupResponse"] = []
    measurements: list["LeadMeasurementResponse"] = []


class LeadConvertRequest(BaseModel):
    create_project: bool = False
    project_name: str | None = None


# ── Lead Measurement Schemas ──────────────────────────────────


class LeadMeasurementCreate(BaseModel):
    room: str
    length_mm: float | None = None
    width_mm: float | None = None
    height_mm: float | None = None
    notes: str | None = None


class LeadMeasurementUpdate(BaseModel):
    room: str | None = None
    length_mm: float | None = None
    width_mm: float | None = None
    height_mm: float | None = None
    notes: str | None = None


class LeadMeasurementResponse(BaseModel):
    id: int
    lead_id: int
    room: str
    length_mm: float | None
    width_mm: float | None
    height_mm: float | None
    notes: str | None
    source: MeasurementSource
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Interaction Schemas ───────────────────────────────────────


class InteractionCreate(BaseModel):
    lead_id: int | None = None
    client_id: int | None = None
    interaction_type: InteractionType
    phone_number: str | None = None
    duration_seconds: int | None = None
    summary: str | None = None


class InteractionResponse(BaseModel):
    id: int
    lead_id: int | None
    client_id: int | None
    interaction_type: InteractionType
    logged_by: int
    logger_name: str | None = None
    phone_number: str | None
    duration_seconds: int | None
    summary: str | None
    call_source: CallSource
    ai_summary: str | None = None
    ai_suggested_reply: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CallLogEntry(BaseModel):
    phone_number: str
    duration_seconds: int | None = None
    call_type: InteractionType = InteractionType.INCOMING_CALL
    timestamp: datetime | None = None


class BulkCallLogRequest(BaseModel):
    calls: list[CallLogEntry]


# ── Followup Schemas ─────────────────────────────────────────


class FollowupCreate(BaseModel):
    lead_id: int | None = None
    client_id: int | None = None
    scheduled_at: datetime
    notes: str | None = None


class FollowupUpdate(BaseModel):
    scheduled_at: datetime | None = None
    notes: str | None = None
    status: FollowupStatus | None = None


class FollowupResponse(BaseModel):
    id: int
    lead_id: int | None
    client_id: int | None
    assigned_to: int
    assignee_name: str | None = None
    lead_name: str | None = None
    client_name: str | None = None
    scheduled_at: datetime
    notes: str | None
    status: FollowupStatus
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Lookup & Stats ───────────────────────────────────────────


class PhoneLookupResponse(BaseModel):
    found: bool
    match_type: str | None = None  # "client" or "lead"
    client: dict | None = None
    lead: dict | None = None
    recent_interactions: list[InteractionResponse] = []


class CRMStatsResponse(BaseModel):
    pipeline: dict[str, int]
    todays_followups: int
    overdue_followups: int
    recent_interactions_count: int
    total_leads: int
    won_value: Decimal


# ── Public / Webhook Schemas ──────────────────────────────────


class WebsiteContactForm(BaseModel):
    name: str
    phone: str
    email: EmailStr | None = None
    city: str | None = None
    message: str | None = None
    page_url: str | None = None  # which page they submitted from


class WhatsAppWebhookMessage(BaseModel):
    phone_number: str
    display_name: str | None = None
    message_body: str | None = None
    timestamp: datetime | None = None
    message_id: str | None = None


class AutoLeadResponse(BaseModel):
    lead_id: int
    lead_number: str
    is_new: bool  # True if new lead created, False if existing
    message: str


# Rebuild forward refs
LeadDetailResponse.model_rebuild()
