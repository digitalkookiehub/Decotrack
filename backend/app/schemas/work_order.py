from datetime import datetime

from pydantic import BaseModel


class WOItemCreate(BaseModel):
    product_id: int
    quantity: int


class WOCreate(BaseModel):
    project_id: int
    notes: str | None = None
    items: list[WOItemCreate]


class WOUpdate(BaseModel):
    notes: str | None = None


class WOItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str | None = None
    quantity: int
    completed_count: int
    status: str

    model_config = {"from_attributes": True}


class WOResponse(BaseModel):
    id: int
    wo_number: str
    project_id: int
    project_name: str | None = None
    created_by: int
    creator_name: str | None = None
    status: str
    estimated_material_cost: float
    notes: str | None
    rejection_reason: str | None
    rejection_count: int
    approved_by: int | None
    approver_name: str | None = None
    approved_at: datetime | None
    submitted_at: datetime | None
    created_at: datetime
    items: list[WOItemResponse] = []

    model_config = {"from_attributes": True}


class StageUpdateRequest(BaseModel):
    stage_name: str
    action: str  # "start" or "complete"


class WastageRequest(BaseModel):
    raw_material_id: int
    quantity: float
    reason: str
    stage_name: str | None = None
