from datetime import date, datetime

from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    description: str | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RawMaterialCreate(BaseModel):
    category_id: int | None = None
    name: str
    sku: str
    description: str | None = None
    unit: str = "PCS"
    reorder_level: float = 0
    hsn_code: str | None = None
    gst_rate: float = 18.00


class RawMaterialUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = None
    description: str | None = None
    reorder_level: float | None = None
    hsn_code: str | None = None
    gst_rate: float | None = None
    is_active: bool | None = None


class RawMaterialResponse(BaseModel):
    id: int
    category_id: int | None
    name: str
    sku: str
    description: str | None
    unit: str
    current_stock: float
    reorder_level: float
    last_purchase_rate: float
    hsn_code: str | None
    gst_rate: float
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class StockAdjustRequest(BaseModel):
    quantity: float
    reason: str


class BatchResponse(BaseModel):
    id: int
    batch_number: str
    received_date: date
    quantity_received: float
    quantity_remaining: float
    purchase_rate: float
    created_at: datetime

    model_config = {"from_attributes": True}


class MovementResponse(BaseModel):
    id: int
    movement_type: str
    quantity: float
    qty_before: float
    qty_after: float
    reference_type: str | None
    reference_id: int | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReorderAlertResponse(BaseModel):
    id: int
    name: str
    sku: str
    unit: str
    current_stock: float
    reorder_level: float
    deficit: float
    last_purchase_rate: float
