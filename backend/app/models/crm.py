import enum
from decimal import Decimal

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class LeadSource(str, enum.Enum):
    INCOMING_CALL = "INCOMING_CALL"
    OUTGOING_CALL = "OUTGOING_CALL"
    WHATSAPP = "WHATSAPP"
    WALK_IN = "WALK_IN"
    REFERRAL = "REFERRAL"
    WEBSITE = "WEBSITE"
    INSTAGRAM = "INSTAGRAM"
    OTHER = "OTHER"


class LeadStatus(str, enum.Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    SITE_VISIT = "SITE_VISIT"
    MEASUREMENT = "MEASUREMENT"
    QUOTATION_SENT = "QUOTATION_SENT"
    NEGOTIATION = "NEGOTIATION"
    WON = "WON"
    LOST = "LOST"


class InteractionType(str, enum.Enum):
    INCOMING_CALL = "INCOMING_CALL"
    OUTGOING_CALL = "OUTGOING_CALL"
    WHATSAPP = "WHATSAPP"
    EMAIL = "EMAIL"
    SITE_VISIT = "SITE_VISIT"
    MEETING = "MEETING"
    NOTE = "NOTE"


class CallSource(str, enum.Enum):
    MANUAL = "MANUAL"
    ANDROID_APP = "ANDROID_APP"


class FollowupStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    MISSED = "MISSED"
    CANCELLED = "CANCELLED"


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    lead_number = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20), nullable=True, index=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    source = Column(Enum(LeadSource), nullable=False, default=LeadSource.INCOMING_CALL)
    status = Column(Enum(LeadStatus), nullable=False, default=LeadStatus.NEW)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    estimated_value = Column(Numeric(12, 2), nullable=True)
    notes = Column(Text, nullable=True)
    lost_reason = Column(Text, nullable=True)

    assignee = relationship("User", foreign_keys=[assigned_to])
    client = relationship("Client", foreign_keys=[client_id])
    project = relationship("Project", foreign_keys=[project_id])
    interactions = relationship("Interaction", back_populates="lead", order_by="desc(Interaction.created_at)")
    followups = relationship("Followup", back_populates="lead", order_by="desc(Followup.scheduled_at)")
    measurements = relationship("LeadMeasurement", back_populates="lead", order_by="LeadMeasurement.id", cascade="all, delete-orphan")


class Interaction(Base, TimestampMixin):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    interaction_type = Column(Enum(InteractionType), nullable=False)
    logged_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    phone_number = Column(String(20), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    summary = Column(Text, nullable=True)
    call_source = Column(Enum(CallSource), nullable=False, default=CallSource.MANUAL)
    ai_summary = Column(Text, nullable=True)
    ai_suggested_reply = Column(Text, nullable=True)

    lead = relationship("Lead", back_populates="interactions")
    client = relationship("Client", foreign_keys=[client_id])
    logger = relationship("User", foreign_keys=[logged_by])


class Followup(Base, TimestampMixin):
    __tablename__ = "followups"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(Enum(FollowupStatus), nullable=False, default=FollowupStatus.PENDING)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    lead = relationship("Lead", back_populates="followups")
    client = relationship("Client", foreign_keys=[client_id])
    assignee = relationship("User", foreign_keys=[assigned_to])


class MeasurementSource(str, enum.Enum):
    AI_SCAN = "AI_SCAN"
    MANUAL = "MANUAL"


class LeadMeasurement(Base, TimestampMixin):
    """A room's site measurement, taken during the SITE_VISIT/MEASUREMENT stage —
    either typed in manually or extracted from a photo of the carpenter's sheet."""
    __tablename__ = "lead_measurements"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    room = Column(String(100), nullable=False)
    length_mm = Column(Numeric(10, 2), nullable=True)
    width_mm = Column(Numeric(10, 2), nullable=True)
    height_mm = Column(Numeric(10, 2), nullable=True)
    notes = Column(Text, nullable=True)
    source = Column(Enum(MeasurementSource), nullable=False, default=MeasurementSource.MANUAL)
    logged_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    lead = relationship("Lead", back_populates="measurements")
    logger = relationship("User", foreign_keys=[logged_by])
