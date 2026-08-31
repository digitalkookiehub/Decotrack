from datetime import datetime

from pydantic import BaseModel


class POItemCreate(BaseModel):
    raw_material_id: int
    quantity: float
    rate: float


class POCreate(BaseModel):
    vendor_id: int
    notes: str | None = None
    items: list[POItemCreate]


class POUpdate(BaseModel):
    vendor_id: int | None = None
    notes: str | None = None
    items: list[POItemCreate] | None = None


class POItemResponse(BaseModel):
    id: int
    raw_material_id: int
    material_name: str | None = None
    material_sku: str | None = None
    material_unit: str | None = None
    quantity: float
    rate: float
    amount: float
    last_purchase_rate: float
    current_stock: float
    received_qty: float

    model_config = {"from_attributes": True}


class POResponse(BaseModel):
    id: int
    po_number: str
    vendor_id: int
    vendor_name: str | None = None
    created_by: int
    creator_name: str | None = None
    status: str
    total_amount: float
    notes: str | None
    rejection_reason: str | None
    rejection_count: int
    approved_by: int | None
    approver_name: str | None = None
    approved_at: datetime | None
    submitted_at: datetime | None
    created_at: datetime
    items: list[POItemResponse] = []

    model_config = {"from_attributes": True}


class ApprovalRequest(BaseModel):
    comments: str | None = None


class ApprovalLogResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: str
    performed_by: int
    performer_name: str | None = None
    comments: str | None
    auto_approve_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
