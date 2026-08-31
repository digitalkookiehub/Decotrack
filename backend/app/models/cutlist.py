import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin


class CutOrientation(str, enum.Enum):
    LENGTH_FIRST = "LENGTH_FIRST"
    WIDTH_FIRST = "WIDTH_FIRST"


class CuttingMethod(str, enum.Enum):
    GUILLOTINE = "GUILLOTINE"
    FREE = "FREE"


class OptimizationPriority(str, enum.Enum):
    MINIMIZE_WASTE = "MINIMIZE_WASTE"
    MINIMIZE_CUTS = "MINIMIZE_CUTS"


class CutUnits(str, enum.Enum):
    MM = "MM"
    INCHES = "INCHES"


class CutJobStatus(str, enum.Enum):
    PENDING = "PENDING"
    OPTIMIZED = "OPTIMIZED"
    ARCHIVED = "ARCHIVED"


class CutJob(Base, TimestampMixin):
    __tablename__ = "cut_jobs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    material_id = Column(Integer, ForeignKey("raw_materials.id"), nullable=True, index=True)
    sheet_width = Column(Numeric(10, 2), nullable=False)
    sheet_height = Column(Numeric(10, 2), nullable=False)
    blade_kerf = Column(Numeric(6, 2), nullable=False, default=3)
    kerf_unit = Column(Enum(CutUnits), nullable=False, default=CutUnits.MM)
    cut_orientation = Column(Enum(CutOrientation), nullable=False, default=CutOrientation.LENGTH_FIRST)
    cutting_method = Column(Enum(CuttingMethod), nullable=False, default=CuttingMethod.GUILLOTINE)
    optimization_priority = Column(Enum(OptimizationPriority), nullable=False, default=OptimizationPriority.MINIMIZE_WASTE)
    units = Column(Enum(CutUnits), nullable=False, default=CutUnits.MM)
    status = Column(Enum(CutJobStatus), nullable=False, default=CutJobStatus.PENDING)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    material = relationship("RawMaterial", foreign_keys=[material_id])
    creator = relationship("User", foreign_keys=[created_by])
    parts = relationship("CutPart", back_populates="cut_job", cascade="all, delete-orphan", order_by="CutPart.id")
    result = relationship("CutResult", back_populates="cut_job", uselist=False, cascade="all, delete-orphan")


class CutPart(Base):
    __tablename__ = "cut_parts"

    id = Column(Integer, primary_key=True, index=True)
    cut_job_id = Column(Integer, ForeignKey("cut_jobs.id", ondelete="CASCADE"), index=True, nullable=False)
    label = Column(String(100), nullable=False)
    length = Column(Numeric(10, 2), nullable=False)
    width = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    grain_locked = Column(Boolean, nullable=False, default=False)
    edge_banding_l1 = Column(Boolean, nullable=False, default=False)
    edge_banding_l2 = Column(Boolean, nullable=False, default=False)
    edge_banding_w1 = Column(Boolean, nullable=False, default=False)
    edge_banding_w2 = Column(Boolean, nullable=False, default=False)
    rotation_locked = Column(Boolean, nullable=False, default=False)

    cut_job = relationship("CutJob", back_populates="parts")


class CutResult(Base):
    __tablename__ = "cut_results"

    id = Column(Integer, primary_key=True, index=True)
    cut_job_id = Column(Integer, ForeignKey("cut_jobs.id", ondelete="CASCADE"), unique=True, nullable=False)
    sheets_used = Column(Integer, nullable=False)
    waste_percentage = Column(Numeric(5, 2), nullable=False)
    material_efficiency_percentage = Column(Numeric(5, 2), nullable=False)
    total_cost = Column(Numeric(12, 2), nullable=False, default=0)
    waste_area = Column(Numeric(14, 2), nullable=False)
    placements_json = Column(JSON, nullable=False)
    svg_data_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    cut_job = relationship("CutJob", back_populates="result")
