from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class QuotationItem(BaseModel):
    description: str
    pieces_json: list[dict] | None = None  # from elevation
    material_cost: float = 0
    labor_cost: float = 0
    quantity: int = 1
    total: float = 0


class QuotationCreate(BaseModel):
    client_id: int | None = None
    client_name: str
    client_phone: str | None = None
    client_email: str | None = None
    client_address: str | None = None
    project_name: str | None = None
    items: list[QuotationItem]
    tax_percent: float = 18
    discount_percent: float = 0
    terms: str | None = None
    notes: str | None = None
    valid_days: int = 30


class QuotationUpdate(BaseModel):
    client_name: str | None = None
    client_phone: str | None = None
    client_email: str | None = None
    project_name: str | None = None
    items: list[QuotationItem] | None = None
    tax_percent: float | None = None
    discount_percent: float | None = None
    terms: str | None = None
    notes: str | None = None
    status: str | None = None


class QuotationResponse(BaseModel):
    id: int
    quote_number: str
    client_id: int | None
    client_name: str
    client_phone: str | None
    client_email: str | None
    client_address: str | None
    project_name: str | None
    status: str
    valid_until: datetime | None
    items: list[dict]
    subtotal: float
    tax_percent: float
    tax_amount: float
    discount_percent: float
    discount_amount: float
    grand_total: float
    terms: str | None
    notes: str | None
    creator_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
