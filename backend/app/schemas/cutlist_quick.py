"""Schemas for the quick calculate endpoint (no save, instant results)."""

from pydantic import BaseModel, field_validator


class QuickPanel(BaseModel):
    label: str = ""
    length: float
    width: float
    quantity: int = 1
    grain_locked: bool = False
    rotation_locked: bool = False

    @field_validator("quantity")
    @classmethod
    def qty_range(cls, v: int) -> int:
        if v < 1 or v > 999:
            raise ValueError("Quantity must be 1–999")
        return v


class QuickStockSheet(BaseModel):
    length: float
    width: float
    quantity: int = 99


class QuickCalculateRequest(BaseModel):
    panels: list[QuickPanel]
    stock_sheets: list[QuickStockSheet]
    blade_kerf: float = 0
    labels_on_panels: bool = True
    use_only_one_sheet_size: bool = False
    consider_material_grain: bool = False
    cutting_method: str = "GUILLOTINE"

    @field_validator("panels")
    @classmethod
    def at_least_one(cls, v: list) -> list:
        if not v:
            raise ValueError("At least 1 panel required")
        return v

    @field_validator("stock_sheets")
    @classmethod
    def at_least_one_sheet(cls, v: list) -> list:
        if not v:
            raise ValueError("At least 1 stock sheet required")
        return v


class QuickPlacement(BaseModel):
    sheet_index: int
    sheet_length: float
    sheet_width: float
    label: str
    x: float
    y: float
    w: float
    h: float
    rotated: bool


class QuickSheetResult(BaseModel):
    sheet_index: int
    sheet_length: float
    sheet_width: float
    pieces: list[QuickPlacement]
    used_area: float
    waste_area: float
    waste_percent: float
    svg: str


class QuickCalculateResponse(BaseModel):
    sheets: list[QuickSheetResult]
    summary: dict
