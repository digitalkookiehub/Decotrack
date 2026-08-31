import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class POStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SENT_TO_VENDOR = "SENT_TO_VENDOR"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    FULLY_RECEIVED = "FULLY_RECEIVED"
    CANCELLED = "CANCELLED"


class PurchaseOrder(Base, TimestampMixin):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(20), unique=True, index=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    status = Column(Enum(POStatus), default=POStatus.DRAFT, nullable=False)
    total_amount = Column(Numeric(12, 2), default=0, nullable=False)
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    rejection_count = Column(Integer, default=0, nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    vendor = relationship("Vendor", back_populates="purchase_orders")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")
    grns = relationship("GoodsReceivedNote", back_populates="purchase_order")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True, nullable=False)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"), index=True, nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    rate = Column(Numeric(12, 2), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    last_purchase_rate = Column(Numeric(12, 2), default=0)
    current_stock = Column(Numeric(12, 2), default=0)
    received_qty = Column(Numeric(12, 2), default=0)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    raw_material = relationship("RawMaterial")
    grn_items = relationship("GRNItem", back_populates="po_item")
