from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class StockSheet(BaseModel):
    length: float
    width: float
    quantity: int = 99  # unlimited by default


class CutPartCreate(BaseModel):
    label: str
    length: float
    width: float
    quantity: int = 1
    grain_locked: bool = False
    edge_banding_l1: bool = False
    edge_banding_l2: bool = False
    edge_banding_w1: bool = False
    edge_banding_w2: bool = False
    rotation_locked: bool = False

    @field_validator("quantity")
    @classmethod
    def qty_range(cls, v: int) -> int:
        if v < 1 or v > 999:
            raise ValueError("Quantity must be 1–999")
        return v

    @field_validator("label")
    @classmethod
    def label_nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Label cannot be empty")
        return v.strip()


class CutPartResponse(BaseModel):
    id: int
    label: str
    length: float
    width: float
    quantity: int
    grain_locked: bool
    edge_banding_l1: bool
    edge_banding_l2: bool
    edge_banding_w1: bool
    edge_banding_w2: bool
    rotation_locked: bool

    model_config = {"from_attributes": True}


class CutJobCreate(BaseModel):
    name: str
    material_id: int | None = None
    sheet_width: float
    sheet_height: float
    blade_kerf: float = 3
    kerf_unit: str = "MM"
    cut_orientation: str = "LENGTH_FIRST"
    cutting_method: str = "GUILLOTINE"
    optimization_priority: str = "MINIMIZE_WASTE"
    units: str = "MM"
    parts: list[CutPartCreate]
    stock_sheets: list[StockSheet] | None = None  # multiple sheet sizes
    # Toggle options
    labels_on_panels: bool = True
    use_only_one_sheet_size: bool = False
    consider_material_grain: bool = False

    @field_validator("name")
    @classmethod
    def name_min_length(cls, v: str) -> str:
        if len(v.strip()) < 3:
            raise ValueError("Job name must be at least 3 characters")
        return v.strip()

    @field_validator("blade_kerf")
    @classmethod
    def kerf_max(cls, v: float) -> float:
        if v < 0 or v > 20:
            raise ValueError("Blade kerf must be 0–20mm")
        return v

    @field_validator("sheet_width", "sheet_height")
    @classmethod
    def positive_dims(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Sheet dimensions must be positive non-zero")
        return v

    @field_validator("parts")
    @classmethod
    def at_least_one_part(cls, v: list) -> list:
        if len(v) == 0:
            raise ValueError("At least 1 part is required")
        return v


class CutJobUpdate(BaseModel):
    name: str | None = None
    material_id: int | None = None
    sheet_width: float | None = None
    sheet_height: float | None = None
    blade_kerf: float | None = None
    kerf_unit: str | None = None
    cut_orientation: str | None = None
    cutting_method: str | None = None
    optimization_priority: str | None = None
    units: str | None = None
    parts: list[CutPartCreate] | None = None


class PlacementItem(BaseModel):
    sheet: int
    label: str
    x: float
    y: float
    w: float
    h: float
    rotated: bool
    part_id: int


class CutResultResponse(BaseModel):
    id: int
    sheets_used: int
    waste_percentage: float
    material_efficiency_percentage: float
    total_cost: float
    waste_area: float
    placements_json: list[dict]
    svg_data_json: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class CutJobResponse(BaseModel):
    id: int
    name: str
    material_id: int | None
    material_name: str | None = None
    sheet_width: float
    sheet_height: float
    blade_kerf: float
    kerf_unit: str
    cut_orientation: str
    cutting_method: str
    optimization_priority: str
    units: str
    status: str
    parts: list[CutPartResponse] = []
    result: CutResultResponse | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CutJobListItem(BaseModel):
    id: int
    name: str
    material_name: str | None = None
    sheet_width: float
    sheet_height: float
    units: str
    status: str
    parts_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class MaterialResponse(BaseModel):
    id: int
    name: str
    sheet_width: float | None
    sheet_height: float | None
    price_per_sheet: float

    model_config = {"from_attributes": True}
