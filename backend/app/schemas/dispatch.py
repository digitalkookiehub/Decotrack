from datetime import datetime

from pydantic import BaseModel


class DispatchItemCreate(BaseModel):
    project_item_id: int | None = None
    product_id: int
    product_name: str
    quantity: int


class DispatchCreate(BaseModel):
    project_id: int
    vehicle_number: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    delivery_address: str | None = None
    delivery_city: str | None = None
    notes: str | None = None
    items: list[DispatchItemCreate]


class DispatchResponse(BaseModel):
    id: int
    dispatch_number: str
    project_id: int
    project_name: str | None = None
    status: str
    vehicle_number: str | None
    driver_name: str | None
    driver_phone: str | None
    delivery_address: str | None
    delivery_city: str | None
    delivery_token: str | None
    notes: str | None
    rejection_reason: str | None
    rejection_count: int
    approved_by: int | None
    approved_at: datetime | None
    loading_confirmed_at: datetime | None
    delivery_confirmed_at: datetime | None
    challan_url: str | None
    submitted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DispatchPhotoUpload(BaseModel):
    item_reference: str
    gps_lat: float | None = None
    gps_lng: float | None = None
    notes: str | None = None


class DriverDeliveryResponse(BaseModel):
    dispatch_number: str
    project_name: str | None
    delivery_address: str | None
    items: list[dict]
    photos_uploaded: int
    min_photos_required: int = 2
    can_complete: bool
