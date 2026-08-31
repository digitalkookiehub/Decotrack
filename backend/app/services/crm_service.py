import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.exceptions import BadRequestError, NotFoundError
from app.models.client import Client
from app.models.crm import (
    CallSource,
    Followup,
    FollowupStatus,
    Interaction,
    InteractionType,
    Lead,
    LeadMeasurement,
    LeadSource,
    LeadStatus,
    MeasurementSource,
)
from app.models.project import Project, ProjectStatus
from app.models.user import User
from app.schemas.crm import (
    BulkCallLogRequest,
    FollowupCreate,
    FollowupUpdate,
    InteractionCreate,
    LeadConvertRequest,
    LeadCreate,
    LeadMeasurementCreate,
    LeadMeasurementUpdate,
    LeadUpdate,
    WebsiteContactForm,
    WhatsAppWebhookMessage,
)
from app.services import lead_ai_service, measurement_ocr_service
from app.services.numbering_service import generate_client_scoped_number, generate_number

logger = logging.getLogger(__name__)


# ── Lead CRUD ─────────────────────────────────────────────────


def create_lead(db: Session, data: LeadCreate, user: User) -> Lead:
    lead_number = generate_number(db, "LEAD", Lead.lead_number, Lead)
    lead = Lead(
        **data.model_dump(),
        lead_number=lead_number,
    )
    if not lead.assigned_to:
        lead.assigned_to = user.id
    db.add(lead)
    db.commit()
    db.refresh(lead)
    logger.info("Lead created: %s by %s", lead.lead_number, user.full_name)
    return lead


def get_leads(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    search: str | None = None,
    status: LeadStatus | None = None,
    source: str | None = None,
    assigned_to: int | None = None,
) -> tuple[list[Lead], int]:
    query = db.query(Lead)
    if search:
        query = query.filter(
            or_(
                Lead.name.ilike(f"%{search}%"),
                Lead.phone.ilike(f"%{search}%"),
                Lead.lead_number.ilike(f"%{search}%"),
            )
        )
    if status:
        query = query.filter(Lead.status == status)
    if source:
        query = query.filter(Lead.source == source)
    if assigned_to:
        query = query.filter(Lead.assigned_to == assigned_to)

    total = query.count()
    leads = (
        query.order_by(Lead.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return leads, total


def get_lead(db: Session, lead_id: int) -> Lead:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise NotFoundError("Lead")
    return lead


def update_lead(db: Session, lead_id: int, data: LeadUpdate) -> Lead:
    lead = get_lead(db, lead_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    logger.info("Lead updated: %s", lead.lead_number)
    return lead


def convert_lead(db: Session, lead_id: int, data: LeadConvertRequest, user: User) -> Lead:
    lead = get_lead(db, lead_id)
    if lead.status == LeadStatus.WON and lead.client_id:
        raise BadRequestError("Lead is already converted")

    # Create client from lead data
    client = Client(
        name=lead.name,
        phone=lead.phone,
        email=lead.email,
        address=lead.address,
        city=lead.city,
        state=lead.state,
    )
    db.add(client)
    db.flush()

    lead.client_id = client.id
    lead.status = LeadStatus.WON

    # Transfer interactions to new client
    db.query(Interaction).filter(Interaction.lead_id == lead_id).update(
        {Interaction.client_id: client.id}
    )

    # Optionally create project
    if data.create_project:
        project_name = data.project_name or f"{lead.name} - Project"
        project_number = generate_client_scoped_number(db, client.name, Project.project_number, Project)
        project = Project(
            project_number=project_number,
            name=project_name,
            client_id=client.id,
            status=ProjectStatus.PLANNING,
            created_by=user.id,
        )
        db.add(project)
        db.flush()
        lead.project_id = project.id

    db.commit()
    db.refresh(lead)
    logger.info("Lead %s converted to client %s by %s", lead.lead_number, client.id, user.full_name)
    return lead


# ── Interaction CRUD ──────────────────────────────────────────


def create_interaction(db: Session, data: InteractionCreate, user: User) -> Interaction:
    interaction = Interaction(
        **data.model_dump(),
        logged_by=user.id,
        call_source=CallSource.MANUAL,
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    logger.info("Interaction logged by %s", user.full_name)
    return interaction


def get_interactions(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    lead_id: int | None = None,
    client_id: int | None = None,
    interaction_type: str | None = None,
    search: str | None = None,
) -> tuple[list[Interaction], int]:
    query = db.query(Interaction)
    if lead_id:
        query = query.filter(Interaction.lead_id == lead_id)
    if client_id:
        query = query.filter(Interaction.client_id == client_id)
    if interaction_type:
        query = query.filter(Interaction.interaction_type == interaction_type)
    if search:
        query = query.filter(
            or_(
                Interaction.phone_number.ilike(f"%{search}%"),
                Interaction.summary.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    interactions = (
        query.order_by(Interaction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return interactions, total


def bulk_log_calls(db: Session, data: BulkCallLogRequest, user: User) -> list[dict]:
    """Bulk import call logs from Android app. Auto-creates leads for unknown numbers."""
    results = []
    for call in data.calls:
        # Auto-match phone to client or lead
        client = db.query(Client).filter(Client.phone == call.phone_number).first()
        if client:
            lead_id = None
            client_id = client.id
            is_new_lead = False
        else:
            lead = db.query(Lead).filter(Lead.phone == call.phone_number).first()
            if lead:
                lead_id = lead.id
                is_new_lead = False
            else:
                # Auto-create lead for unknown number
                lead_number = generate_number(db, "LEAD", Lead.lead_number, Lead)
                source = LeadSource.INCOMING_CALL if call.call_type == InteractionType.INCOMING_CALL else LeadSource.OUTGOING_CALL
                new_lead = Lead(
                    lead_number=lead_number,
                    name=f"Unknown ({call.phone_number})",
                    phone=call.phone_number,
                    source=source,
                    status=LeadStatus.NEW,
                    assigned_to=user.id,
                )
                db.add(new_lead)
                db.flush()
                lead_id = new_lead.id
                is_new_lead = True
                logger.info("Auto-created lead %s for unknown number %s", lead_number, call.phone_number)

            client_id = None

        interaction = Interaction(
            lead_id=lead_id,
            client_id=client_id,
            interaction_type=call.call_type,
            logged_by=user.id,
            phone_number=call.phone_number,
            duration_seconds=call.duration_seconds,
            call_source=CallSource.ANDROID_APP,
        )
        db.add(interaction)
        results.append({
            "phone_number": call.phone_number,
            "is_new_lead": is_new_lead,
            "lead_id": lead_id,
            "client_id": client_id,
        })

    db.commit()
    logger.info("Bulk call log: %d calls imported by %s", len(results), user.full_name)
    return results


# ── Followup CRUD ─────────────────────────────────────────────


def create_followup(db: Session, data: FollowupCreate, user: User) -> Followup:
    followup = Followup(
        **data.model_dump(),
        assigned_to=user.id,
    )
    db.add(followup)
    db.commit()
    db.refresh(followup)
    logger.info("Followup scheduled by %s", user.full_name)
    return followup


def get_followups(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    filter_type: str | None = None,
    assigned_to: int | None = None,
) -> tuple[list[Followup], int]:
    query = db.query(Followup)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    if filter_type == "overdue":
        query = query.filter(
            Followup.status == FollowupStatus.PENDING,
            Followup.scheduled_at < now,
        )
    elif filter_type == "today":
        query = query.filter(
            Followup.status == FollowupStatus.PENDING,
            Followup.scheduled_at >= today_start,
            Followup.scheduled_at < today_end,
        )
    elif filter_type == "upcoming":
        query = query.filter(
            Followup.status == FollowupStatus.PENDING,
            Followup.scheduled_at >= today_end,
        )
    elif filter_type == "pending":
        query = query.filter(Followup.status == FollowupStatus.PENDING)

    if assigned_to:
        query = query.filter(Followup.assigned_to == assigned_to)

    total = query.count()
    followups = (
        query.order_by(Followup.scheduled_at.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return followups, total


def update_followup(db: Session, followup_id: int, data: FollowupUpdate) -> Followup:
    followup = db.query(Followup).filter(Followup.id == followup_id).first()
    if not followup:
        raise NotFoundError("Followup")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(followup, field, value)

    if data.status == FollowupStatus.COMPLETED:
        followup.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(followup)
    return followup


# ── Phone Lookup ──────────────────────────────────────────────


def phone_lookup(db: Session, phone: str) -> dict:
    """Search both clients and leads by phone number."""
    client = db.query(Client).filter(Client.phone == phone).first()
    if client:
        recent = (
            db.query(Interaction)
            .filter(Interaction.client_id == client.id)
            .order_by(Interaction.created_at.desc())
            .limit(5)
            .all()
        )
        return {
            "found": True,
            "match_type": "client",
            "client": {
                "id": client.id,
                "name": client.name,
                "phone": client.phone,
                "email": client.email,
                "city": client.city,
            },
            "lead": None,
            "recent_interactions": recent,
        }

    lead = db.query(Lead).filter(Lead.phone == phone).first()
    if lead:
        recent = (
            db.query(Interaction)
            .filter(Interaction.lead_id == lead.id)
            .order_by(Interaction.created_at.desc())
            .limit(5)
            .all()
        )
        return {
            "found": True,
            "match_type": "lead",
            "client": None,
            "lead": {
                "id": lead.id,
                "lead_number": lead.lead_number,
                "name": lead.name,
                "phone": lead.phone,
                "status": lead.status.value,
            },
            "recent_interactions": recent,
        }

    return {
        "found": False,
        "match_type": None,
        "client": None,
        "lead": None,
        "recent_interactions": [],
    }


# ── CRM Dashboard Stats ──────────────────────────────────────


def get_crm_stats(db: Session) -> dict:
    """Pipeline counts, followup stats, and recent activity."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Pipeline counts
    pipeline = {}
    for status in LeadStatus:
        count = db.query(Lead).filter(Lead.status == status).count()
        pipeline[status.value] = count

    # Followup counts
    todays_followups = db.query(Followup).filter(
        Followup.status == FollowupStatus.PENDING,
        Followup.scheduled_at >= today_start,
        Followup.scheduled_at < today_end,
    ).count()

    overdue_followups = db.query(Followup).filter(
        Followup.status == FollowupStatus.PENDING,
        Followup.scheduled_at < now,
    ).count()

    # Recent interactions (last 7 days)
    week_ago = now - timedelta(days=7)
    recent_count = db.query(Interaction).filter(
        Interaction.created_at >= week_ago
    ).count()

    # Total leads and won value
    total_leads = db.query(Lead).count()
    won_value = (
        db.query(func.coalesce(func.sum(Lead.estimated_value), 0))
        .filter(Lead.status == LeadStatus.WON)
        .scalar()
    )

    return {
        "pipeline": pipeline,
        "todays_followups": todays_followups,
        "overdue_followups": overdue_followups,
        "recent_interactions_count": recent_count,
        "total_leads": total_leads,
        "won_value": Decimal(str(won_value)),
    }


# ── Auto Lead Creation ───────────────────────────────────────


def _find_or_create_lead(
    db: Session,
    phone: str,
    name: str,
    source: LeadSource,
    email: str | None = None,
    city: str | None = None,
    notes: str | None = None,
) -> tuple[Lead, bool]:
    """Find existing lead/client by phone, or create a new lead. Returns (lead, is_new)."""
    # Check if already a client
    client = db.query(Client).filter(Client.phone == phone).first()
    if client:
        # Find linked lead if any
        lead = db.query(Lead).filter(Lead.client_id == client.id).first()
        if lead:
            return lead, False
        # Create lead linked to existing client
        lead_number = generate_number(db, "LEAD", Lead.lead_number, Lead)
        lead = Lead(
            lead_number=lead_number,
            name=client.name,
            phone=phone,
            email=email or client.email,
            city=city or client.city,
            source=source,
            status=LeadStatus.CONTACTED,
            client_id=client.id,
            notes=notes,
        )
        db.add(lead)
        db.flush()
        return lead, True

    # Check if already a lead
    existing = db.query(Lead).filter(Lead.phone == phone).first()
    if existing:
        # Update notes if new info provided
        if notes and existing.notes:
            existing.notes = f"{existing.notes}\n---\n{notes}"
        elif notes:
            existing.notes = notes
        return existing, False

    # Create new lead
    lead_number = generate_number(db, "LEAD", Lead.lead_number, Lead)
    lead = Lead(
        lead_number=lead_number,
        name=name,
        phone=phone,
        email=email,
        city=city,
        source=source,
        status=LeadStatus.NEW,
        notes=notes,
    )
    db.add(lead)
    db.flush()
    return lead, True


def create_lead_from_website(db: Session, data: WebsiteContactForm) -> dict:
    """Auto-create lead from website contact form. Public endpoint, no auth."""
    notes = data.message
    if data.page_url:
        notes = f"{notes or ''}\n[Submitted from: {data.page_url}]".strip()

    lead, is_new = _find_or_create_lead(
        db,
        phone=data.phone,
        name=data.name,
        source=LeadSource.WEBSITE,
        email=data.email,
        city=data.city,
        notes=notes,
    )

    # Log the interaction
    interaction = Interaction(
        lead_id=lead.id,
        client_id=lead.client_id,
        interaction_type=InteractionType.NOTE,
        logged_by=_get_system_user_id(db),
        phone_number=data.phone,
        summary=f"Website inquiry: {data.message or 'No message'}",
        call_source=CallSource.MANUAL,
    )
    db.add(interaction)
    db.commit()
    db.refresh(lead)

    logger.info("Website lead %s: %s (new=%s)", lead.lead_number, data.name, is_new)
    return {
        "lead_id": lead.id,
        "lead_number": lead.lead_number,
        "is_new": is_new,
        "message": "Lead created successfully" if is_new else "Existing lead updated",
    }


def create_lead_from_whatsapp(db: Session, data: WhatsAppWebhookMessage) -> dict:
    """Auto-create lead from WhatsApp Business webhook."""
    name = data.display_name or f"WhatsApp ({data.phone_number})"

    lead, is_new = _find_or_create_lead(
        db,
        phone=data.phone_number,
        name=name,
        source=LeadSource.WHATSAPP,
        notes=data.message_body,
    )

    # Log the WhatsApp interaction
    interaction = Interaction(
        lead_id=lead.id,
        client_id=lead.client_id,
        interaction_type=InteractionType.WHATSAPP,
        logged_by=_get_system_user_id(db),
        phone_number=data.phone_number,
        summary=data.message_body,
        call_source=CallSource.MANUAL,
    )
    db.add(interaction)
    db.flush()

    # Best-effort AI triage — never blocks lead/interaction creation if it fails.
    triage = lead_ai_service.triage_message(data.message_body)
    if triage:
        interaction.ai_summary = triage["summary"]
        interaction.ai_suggested_reply = triage["suggested_reply"]
        if not lead.city and triage["city"]:
            lead.city = triage["city"]
        if not lead.estimated_value and triage["budget_estimate_inr"]:
            lead.estimated_value = Decimal(str(triage["budget_estimate_inr"]))

    db.commit()
    db.refresh(lead)

    logger.info("WhatsApp lead %s: %s (new=%s)", lead.lead_number, name, is_new)
    return {
        "lead_id": lead.id,
        "lead_number": lead.lead_number,
        "is_new": is_new,
        "message": "Lead created from WhatsApp" if is_new else "Existing lead updated from WhatsApp",
    }


def _get_system_user_id(db: Session) -> int:
    """Get first admin user ID as system user for auto-logged interactions."""
    from app.models.user import UserRole
    admin = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active.is_(True)).first()
    if admin:
        return admin.id
    # Fallback: first active user
    user = db.query(User).filter(User.is_active.is_(True)).first()
    return user.id if user else 1


# ── Lead Measurements (site visit → measurement stage) ─────────


def add_measurement(db: Session, lead_id: int, data: LeadMeasurementCreate, user: User) -> LeadMeasurement:
    get_lead(db, lead_id)  # 404 if the lead doesn't exist
    measurement = LeadMeasurement(
        lead_id=lead_id,
        room=data.room,
        length_mm=data.length_mm,
        width_mm=data.width_mm,
        height_mm=data.height_mm,
        notes=data.notes,
        source=MeasurementSource.MANUAL,
        logged_by=user.id,
    )
    db.add(measurement)
    db.commit()
    db.refresh(measurement)
    return measurement


def scan_measurements(db: Session, lead_id: int, image_bytes: bytes, mime_type: str, user: User) -> list[LeadMeasurement]:
    """AI-extract rooms from a photographed measurement sheet and save them directly —
    reviewed/edited afterward on the lead page, same pattern as the Cut Planner OCR."""
    get_lead(db, lead_id)
    rows = measurement_ocr_service.extract_measurements_from_image(image_bytes, mime_type)

    created = []
    for row in rows:
        measurement = LeadMeasurement(
            lead_id=lead_id,
            room=row["room"],
            length_mm=row["length_mm"],
            width_mm=row["width_mm"],
            height_mm=row["height_mm"],
            notes=row["notes"],
            source=MeasurementSource.AI_SCAN,
            logged_by=user.id,
        )
        db.add(measurement)
        created.append(measurement)

    db.commit()
    for m in created:
        db.refresh(m)
    logger.info("Scanned %d room measurements for lead %s", len(created), lead_id)
    return created


def update_measurement(db: Session, lead_id: int, measurement_id: int, data: LeadMeasurementUpdate) -> LeadMeasurement:
    measurement = db.query(LeadMeasurement).filter(
        LeadMeasurement.id == measurement_id, LeadMeasurement.lead_id == lead_id,
    ).first()
    if not measurement:
        raise NotFoundError("Measurement")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(measurement, field, value)
    db.commit()
    db.refresh(measurement)
    return measurement


def delete_measurement(db: Session, lead_id: int, measurement_id: int) -> None:
    measurement = db.query(LeadMeasurement).filter(
        LeadMeasurement.id == measurement_id, LeadMeasurement.lead_id == lead_id,
    ).first()
    if not measurement:
        raise NotFoundError("Measurement")
    db.delete(measurement)
    db.commit()
