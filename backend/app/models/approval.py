import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class EntityType(str, enum.Enum):
    PURCHASE_ORDER = "PURCHASE_ORDER"
    WORK_ORDER = "WORK_ORDER"
    DISPATCH = "DISPATCH"


class ApprovalAction(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    AUTO_APPROVED = "AUTO_APPROVED"
    RESUBMITTED = "RESUBMITTED"


class ApprovalLog(Base):
    __tablename__ = "approval_logs"
    __table_args__ = (
        Index("ix_approval_logs_entity", "entity_type", "entity_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(Enum(EntityType), nullable=False)
    entity_id = Column(Integer, nullable=False)
    action = Column(Enum(ApprovalAction), nullable=False)
    performed_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    comments = Column(Text, nullable=True)
    auto_approve_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    performer = relationship("User", foreign_keys=[performed_by])
