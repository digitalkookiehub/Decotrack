import enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin


class DispatchStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    LOADING_VERIFICATION = "LOADING_VERIFICATION"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERY_VERIFICATION = "DELIVERY_VERIFICATION"
    DELIVERED = "DELIVERED"


class FGStatus(str, enum.Enum):
    IN_STOCK = "IN_STOCK"
    DISPATCHED = "DISPATCHED"
    DELIVERED = "DELIVERED"


class Dispatch(Base, TimestampMixin):
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_number = Column(String(20), unique=True, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    status = Column(Enum(DispatchStatus), default=DispatchStatus.DRAFT, nullable=False)
    vehicle_number = Column(String(20), nullable=True)
    driver_name = Column(String(100), nullable=True)
    driver_phone = Column(String(20), nullable=True)
    delivery_address = Column(Text, nullable=True)
    delivery_city = Column(String(100), nullable=True)
    delivery_lat = Column(Numeric(10, 7), nullable=True)
    delivery_lng = Column(Numeric(10, 7), nullable=True)
    delivery_token = Column(String(100), unique=True, index=True, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    token_used = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    rejection_count = Column(Integer, default=0, nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    loading_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    loading_confirmed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    delivery_marked_at = Column(DateTime(timezone=True), nullable=True)
    delivery_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    delivery_confirmed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    challan_url = Column(String(500), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="dispatches")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    loading_confirmer = relationship("User", foreign_keys=[loading_confirmed_by])
    delivery_confirmer = relationship("User", foreign_keys=[delivery_confirmed_by])
    items = relationship("DispatchItem", back_populates="dispatch", cascade="all, delete-orphan")
    photos = relationship("DispatchPhoto", back_populates="dispatch", cascade="all, delete-orphan")


class DispatchItem(Base):
    __tablename__ = "dispatch_items"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id", ondelete="CASCADE"), index=True, nullable=False)
    project_item_id = Column(Integer, ForeignKey("project_items.id", ondelete="SET NULL"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("finished_products.id"), index=True, nullable=False)
    product_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False)
    factory_verified = Column(Boolean, default=False, nullable=False)
    delivered_quantity = Column(Integer, nullable=True)
    site_verified = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    dispatch = relationship("Dispatch", back_populates="items")
    project_item = relationship("ProjectItem")
    product = relationship("FinishedProduct")


class FinishedGoodInventory(Base):
    __tablename__ = "finished_good_inventory"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_fg_inventory_quantity_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("finished_products.id"), index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True, nullable=False)
    wo_id = Column(Integer, ForeignKey("work_orders.id"), index=True, nullable=False)
    wo_item_id = Column(Integer, ForeignKey("work_order_items.id"), index=True, nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    status = Column(Enum(FGStatus), default=FGStatus.IN_STOCK, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("FinishedProduct")
    project = relationship("Project")
    work_order = relationship("WorkOrder")
    wo_item = relationship("WorkOrderItem")
