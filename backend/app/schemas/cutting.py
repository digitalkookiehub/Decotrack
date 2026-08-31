from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class CuttingPiece(BaseModel):
    label: str = ""
    width: float   # mm
    height: float  # mm
    qty: int = 1


class CuttingListRequest(BaseModel):
    raw_material_id: int
    pieces: list[CuttingPiece]
    kerf_mm: float = 4.0
    label: str = ""
    job_type: str = "OWN"
    company_name: str | None = None
    company_contact: str | None = None
    company_phone: str | None = None
    job_reference: str | None = None
    notes: str | None = None


class PlacedPiece(BaseModel):
    label: str
    x: float
    y: float
    width: float
    height: float
    rotated: bool
    piece_id: int


class SheetLayout(BaseModel):
    sheet_num: int
    placed_pieces: list[PlacedPiece]
    piece_count: int
    used_area_mm2: float
    waste_area_mm2: float
    waste_percent: float


class CuttingSummary(BaseModel):
    total_sheets: int
    total_pieces: int
    sheet_size_mm: dict
    total_piece_area_mm2: float
    total_sheet_area_mm2: float
    total_waste_mm2: float
    waste_percent: float
    cost_per_sheet: float
    total_cost: float
    waste_cost: float
    available_stock: float
    sufficient_stock: bool
    material_name: str
    material_sku: str
    kerf_mm: float


class CuttingListResponse(BaseModel):
    sheets: list[SheetLayout]
    summary: CuttingSummary


class CuttingSaveRequest(BaseModel):
    raw_material_id: int
    pieces: list[dict]
    label: str = ""
    product_id: int | None = None
    wo_id: int | None = None  # link to existing WO (skips auto-create)
    total_sheets: int
    total_piece_area_mm2: float
    total_sheet_area_mm2: float
    total_waste_mm2: float
    waste_percent: float
    cost_per_sheet: float
    total_cost: float
    job_type: str = "OWN"
    company_name: str | None = None
    company_contact: str | None = None
    company_phone: str | None = None
    job_reference: str | None = None
    notes: str | None = None
    layout_result: dict | None = None  # full computed sheet layout, replayed as-is on view


class CutOrderStatusUpdate(BaseModel):
    status: str  # PLANNED, CUTTING, COMPLETED, CANCELLED
    sheets_consumed: int | None = None


class CutOrderResponse(BaseModel):
    id: int
    cut_order_number: str
    product_id: int | None
    raw_material_id: int
    wo_id: int | None = None
    wo_number: str | None = None
    product_type: str
    status: str
    job_type: str
    company_name: str | None
    company_contact: str | None
    company_phone: str | None
    job_reference: str | None
    notes: str | None
    panels: list[dict]
    sheets_required: int
    sheets_consumed: int | None
    total_panel_area: float
    total_sheet_area: float
    wastage_area: float
    wastage_percent: float
    cost_per_sheet: float
    total_cost: float
    material_name: str | None = None
    creator_name: str | None = None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
