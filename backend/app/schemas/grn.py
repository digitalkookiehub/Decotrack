from datetime import date, datetime

from pydantic import BaseModel


class GRNItemCreate(BaseModel):
    po_item_id: int
    raw_material_id: int
    received_qty: float
    accepted_qty: float
    rejected_qty: float = 0
    quality_status: str = "ACCEPTED"
    rejection_reason: str | None = None
    rate: float


class GRNCreate(BaseModel):
    po_id: int
    received_date: date
    notes: str | None = None
    items: list[GRNItemCreate]


class GRNItemResponse(BaseModel):
    id: int
    raw_material_id: int
    material_name: str | None = None
    material_sku: str | None = None
    ordered_qty: float
    received_qty: float
    accepted_qty: float
    rejected_qty: float
    quality_status: str
    rejection_reason: str | None
    rate: float

    model_config = {"from_attributes": True}


class GRNResponse(BaseModel):
    id: int
    grn_number: str
    po_id: int
    po_number: str | None = None
    vendor_id: int
    vendor_name: str | None = None
    received_by: int
    receiver_name: str | None = None
    received_date: date
    notes: str | None
    created_at: datetime
    items: list[GRNItemResponse] = []

    model_config = {"from_attributes": True}
