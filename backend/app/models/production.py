import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ProductionStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class StageStatus(str, enum.Enum):
    STARTED = "STARTED"
    COMPLETED = "COMPLETED"


class ProductionUnit(Base):
    __tablename__ = "production_units"

    id = Column(Integer, primary_key=True, index=True)
    wo_item_id = Column(Integer, ForeignKey("work_order_items.id", ondelete="CASCADE"), index=True, nullable=False)
    unit_number = Column(Integer, nullable=False)
    current_stage = Column(String(100), nullable=True)
    status = Column(Enum(ProductionStatus), default=ProductionStatus.NOT_STARTED, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    wo_item = relationship("WorkOrderItem", back_populates="production_units")
    stage_logs = relationship("ProductionStageLog", back_populates="production_unit", cascade="all, delete-orphan")


class ProductionStageLog(Base):
    __tablename__ = "production_stage_logs"

    id = Column(Integer, primary_key=True, index=True)
    production_unit_id = Column(Integer, ForeignKey("production_units.id", ondelete="CASCADE"), index=True, nullable=False)
    stage_name = Column(String(100), nullable=False)
    status = Column(Enum(StageStatus), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)

    production_unit = relationship("ProductionUnit", back_populates="stage_logs")
    completer = relationship("User", foreign_keys=[completed_by])


class WastageLog(Base):
    __tablename__ = "wastage_logs"

    id = Column(Integer, primary_key=True, index=True)
    production_unit_id = Column(Integer, ForeignKey("production_units.id", ondelete="SET NULL"), nullable=True, index=True)
    wo_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), index=True, nullable=False)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"), index=True, nullable=False)
    stage_name = Column(String(100), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=False)
    reason = Column(Text, nullable=False)
    logged_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    production_unit = relationship("ProductionUnit")
    work_order = relationship("WorkOrder", back_populates="wastage_logs")
    raw_material = relationship("RawMaterial")
    logger = relationship("User", foreign_keys=[logged_by])


class MaterialIssue(Base):
    __tablename__ = "material_issues"

    id = Column(Integer, primary_key=True, index=True)
    wo_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), index=True, nullable=False)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"), index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("inventory_batches.id"), index=True, nullable=False)
    quantity_issued = Column(Numeric(12, 2), nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    issued_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)

    work_order = relationship("WorkOrder", back_populates="material_issues")
    raw_material = relationship("RawMaterial")
    batch = relationship("InventoryBatch", back_populates="material_issues")
    issuer = relationship("User", foreign_keys=[issued_by])
