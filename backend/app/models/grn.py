import enum

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class QualityStatus(str, enum.Enum):
    ACCEPTED = "ACCEPTED"
    PARTIAL = "PARTIAL"
    REJECTED = "REJECTED"


class GoodsReceivedNote(Base):
    __tablename__ = "goods_received_notes"

    id = Column(Integer, primary_key=True, index=True)
    grn_number = Column(String(20), unique=True, index=True, nullable=False)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), index=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), index=True, nullable=False)
    received_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    received_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    purchase_order = relationship("PurchaseOrder", back_populates="grns")
    vendor = relationship("Vendor", back_populates="grns")
    receiver = relationship("User", foreign_keys=[received_by])
    items = relationship("GRNItem", back_populates="grn", cascade="all, delete-orphan")
    batches = relationship("InventoryBatch", back_populates="grn")


class GRNItem(Base):
    __tablename__ = "grn_items"

    id = Column(Integer, primary_key=True, index=True)
    grn_id = Column(Integer, ForeignKey("goods_received_notes.id", ondelete="CASCADE"), index=True, nullable=False)
    po_item_id = Column(Integer, ForeignKey("purchase_order_items.id"), index=True, nullable=False)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"), index=True, nullable=False)
    ordered_qty = Column(Numeric(12, 2), nullable=False)
    received_qty = Column(Numeric(12, 2), nullable=False)
    accepted_qty = Column(Numeric(12, 2), nullable=False)
    rejected_qty = Column(Numeric(12, 2), default=0)
    quality_status = Column(Enum(QualityStatus), nullable=False)
    rejection_reason = Column(Text, nullable=True)
    rate = Column(Numeric(12, 2), nullable=False)

    grn = relationship("GoodsReceivedNote", back_populates="items")
    po_item = relationship("PurchaseOrderItem", back_populates="grn_items")
    raw_material = relationship("RawMaterial")
