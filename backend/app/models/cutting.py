import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class JobType(str, enum.Enum):
    OWN = "OWN"
    CONTRACT = "CONTRACT"


class CutOrderStatus(str, enum.Enum):
    PLANNED = "PLANNED"        # Cut plan created, not started
    CUTTING = "CUTTING"        # Material issued, cutting in progress
    COMPLETED = "COMPLETED"    # Cutting done
    CANCELLED = "CANCELLED"


class CuttingPattern(Base, TimestampMixin):
    __tablename__ = "cutting_patterns"

    id = Column(Integer, primary_key=True, index=True)
    cut_order_number = Column(String(20), unique=True, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("finished_products.id"), nullable=True, index=True)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"), nullable=False)
    wo_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True, index=True)
    product_type = Column(String(50), nullable=False)  # label/site name

    # Order status
    status = Column(Enum(CutOrderStatus), nullable=False, default=CutOrderStatus.PLANNED)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Job classification
    job_type = Column(Enum(JobType), nullable=False, default=JobType.OWN)
    company_name = Column(String(200), nullable=True)
    company_contact = Column(String(100), nullable=True)
    company_phone = Column(String(20), nullable=True)
    job_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    # Dimensions (legacy, kept for compatibility)
    product_length = Column(Numeric(10, 2), nullable=False, default=0)
    product_width = Column(Numeric(10, 2), nullable=True)
    product_height = Column(Numeric(10, 2), nullable=False, default=0)
    product_depth = Column(Numeric(10, 2), nullable=False, default=0)

    # Cutting list and results
    panels = Column(JSON, nullable=False)  # [{label, width, height, qty}]
    sheets_required = Column(Integer, nullable=False)
    total_panel_area = Column(Numeric(12, 2), nullable=False)
    total_sheet_area = Column(Numeric(12, 2), nullable=False)
    wastage_area = Column(Numeric(12, 2), nullable=False)
    wastage_percent = Column(Numeric(5, 2), nullable=False)
    cost_per_sheet = Column(Numeric(12, 2), nullable=False)
    total_cost = Column(Numeric(12, 2), nullable=False)
    edge_banding_length = Column(Numeric(10, 2), nullable=True)

    # Material tracking — actual sheets consumed
    sheets_consumed = Column(Integer, nullable=True, default=0)
    actual_wastage_percent = Column(Numeric(5, 2), nullable=True)

    # Full computed sheet layout at save time (CuttingListResponse-shaped JSON),
    # so viewing later replays the exact result instead of recomputing it — the
    # multi-sheet-size optimizer used to produce it isn't reproducible from
    # raw_material_id alone.
    layout_result = Column(JSON, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    product = relationship("FinishedProduct", foreign_keys=[product_id])
    raw_material = relationship("RawMaterial", foreign_keys=[raw_material_id])
    work_order = relationship("WorkOrder", foreign_keys=[wo_id])
    creator = relationship("User", foreign_keys=[created_by])
