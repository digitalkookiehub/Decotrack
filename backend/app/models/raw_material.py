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


class MaterialUnit(str, enum.Enum):
    PCS = "PCS"
    SQM = "SQM"
    M = "M"
    KG = "KG"
    PAIR = "PAIR"
    LITRE = "LITRE"
    SET = "SET"


class ItemCategory(Base):
    __tablename__ = "item_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    raw_materials = relationship("RawMaterial", back_populates="category")


class RawMaterial(Base, TimestampMixin):
    __tablename__ = "raw_materials"
    __table_args__ = (
        CheckConstraint("current_stock >= 0", name="ck_raw_materials_stock_positive"),
    )

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("item_categories.id"), index=True, nullable=True)
    name = Column(String(200), nullable=False)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    unit = Column(Enum(MaterialUnit), nullable=False, default=MaterialUnit.PCS)
    current_stock = Column(Numeric(12, 2), default=0, nullable=False)
    reorder_level = Column(Numeric(12, 2), default=0, nullable=False)
    last_purchase_rate = Column(Numeric(12, 2), default=0, nullable=False)
    hsn_code = Column(String(20), nullable=True)
    gst_rate = Column(Numeric(5, 2), default=18.00, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Sheet/stock dimensions in mm (for sheet materials like plywood, MDF)
    sheet_length = Column(Numeric(10, 2), nullable=True)  # mm (e.g. 2400)
    sheet_width = Column(Numeric(10, 2), nullable=True)   # mm (e.g. 1200)
    thickness = Column(Numeric(10, 2), nullable=True)      # mm (e.g. 18)

    category = relationship("ItemCategory", back_populates="raw_materials")
    inventory_batches = relationship("InventoryBatch", back_populates="raw_material")
    inventory_movements = relationship("InventoryMovement", back_populates="raw_material")
    bom_items = relationship("BOMItem", back_populates="raw_material")
