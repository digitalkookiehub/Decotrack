from datetime import date, datetime

from pydantic import BaseModel


class ProjectItemCreate(BaseModel):
    room: str
    product_id: int
    quantity: int = 1
    notes: str | None = None


class ProjectCreate(BaseModel):
    name: str
    client_id: int
    site_address: str | None = None
    city: str | None = None
    estimated_cost: float = 0
    start_date: date | None = None
    target_completion_date: date | None = None
    notes: str | None = None
    items: list[ProjectItemCreate] = []


class ProjectUpdate(BaseModel):
    name: str | None = None
    site_address: str | None = None
    city: str | None = None
    status: str | None = None
    estimated_cost: float | None = None
    start_date: date | None = None
    target_completion_date: date | None = None
    notes: str | None = None


class ProjectItemResponse(BaseModel):
    id: int
    room: str
    product_id: int
    product_name: str | None = None
    quantity: int
    status: str
    notes: str | None

    model_config = {"from_attributes": True}


class ProjectResponse(BaseModel):
    id: int
    project_number: str
    name: str
    client_id: int
    client_name: str | None = None
    site_address: str | None
    city: str | None
    status: str
    estimated_cost: float
    actual_cost: float
    start_date: date | None
    target_completion_date: date | None
    actual_completion_date: date | None
    notes: str | None
    created_at: datetime
    items_count: int = 0

    model_config = {"from_attributes": True}
