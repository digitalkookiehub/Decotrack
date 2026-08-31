import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class WOStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class WOItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class WorkOrder(Base, TimestampMixin):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    wo_number = Column(String(20), unique=True, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    status = Column(Enum(WOStatus), default=WOStatus.DRAFT, nullable=False)
    estimated_material_cost = Column(Numeric(14, 2), default=0)
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    rejection_count = Column(Integer, default=0, nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    bom_snapshot = Column(JSON, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="work_orders")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    items = relationship("WorkOrderItem", back_populates="work_order", cascade="all, delete-orphan")
    material_issues = relationship("MaterialIssue", back_populates="work_order")
    wastage_logs = relationship("WastageLog", back_populates="work_order")


class WorkOrderItem(Base):
    __tablename__ = "work_order_items"

    id = Column(Integer, primary_key=True, index=True)
    wo_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("finished_products.id"), index=True, nullable=False)
    quantity = Column(Integer, nullable=False)
    completed_count = Column(Integer, default=0, nullable=False)
    status = Column(Enum(WOItemStatus), default=WOItemStatus.PENDING, nullable=False)

    work_order = relationship("WorkOrder", back_populates="items")
    product = relationship("FinishedProduct")
    production_units = relationship("ProductionUnit", back_populates="wo_item", cascade="all, delete-orphan")
