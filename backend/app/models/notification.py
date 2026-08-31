import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class NotificationType(str, enum.Enum):
    APPROVAL_REQUEST = "APPROVAL_REQUEST"
    APPROVAL_REMINDER = "APPROVAL_REMINDER"
    ESCALATION = "ESCALATION"
    REORDER_ALERT = "REORDER_ALERT"
    DELIVERY_COMPLETE = "DELIVERY_COMPLETE"
    GENERAL = "GENERAL"


class NotificationChannel(str, enum.Enum):
    PUSH = "PUSH"
    WHATSAPP = "WHATSAPP"
    SMS = "SMS"
    IN_APP = "IN_APP"


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    channel = Column(Enum(NotificationChannel), default=NotificationChannel.IN_APP, nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")


class EscalationTracker(Base):
    __tablename__ = "escalation_trackers"
    __table_args__ = (
        Index("ix_escalation_entity", "entity_type", "entity_id"),
        Index("ix_escalation_pending", "resolved", "next_reminder_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    reminder_count = Column(Integer, default=0, nullable=False)
    last_reminder_at = Column(DateTime(timezone=True), nullable=True)
    next_reminder_at = Column(DateTime(timezone=True), nullable=True)
    escalated = Column(Boolean, default=False, nullable=False)
    resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
