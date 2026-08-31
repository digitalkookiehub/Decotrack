import enum

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class MovementType(str, enum.Enum):
    GRN_IN = "GRN_IN"
    WO_ISSUE = "WO_ISSUE"
    WO_RETURN = "WO_RETURN"
    ADJUSTMENT = "ADJUSTMENT"
    WASTAGE = "WASTAGE"


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"
    __table_args__ = (
        CheckConstraint("quantity_remaining >= 0", name="ck_batch_remaining_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id", ondelete="CASCADE"), index=True, nullable=False)
    batch_number = Column(String(50), nullable=False)
    received_date = Column(Date, nullable=False)
    quantity_received = Column(Numeric(12, 2), nullable=False)
    quantity_remaining = Column(Numeric(12, 2), nullable=False)
    purchase_rate = Column(Numeric(12, 2), nullable=False)
    grn_id = Column(Integer, ForeignKey("goods_received_notes.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    raw_material = relationship("RawMaterial", back_populates="inventory_batches")
    grn = relationship("GoodsReceivedNote", back_populates="batches")
    material_issues = relationship("MaterialIssue", back_populates="batch")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    __table_args__ = (
        Index("ix_inventory_movements_reference", "reference_type", "reference_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id", ondelete="CASCADE"), index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("inventory_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    movement_type = Column(Enum(MovementType), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    qty_before = Column(Numeric(12, 2), nullable=False)
    qty_after = Column(Numeric(12, 2), nullable=False)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    raw_material = relationship("RawMaterial", back_populates="inventory_movements")
    batch = relationship("InventoryBatch")
    performer = relationship("User", foreign_keys=[performed_by])
