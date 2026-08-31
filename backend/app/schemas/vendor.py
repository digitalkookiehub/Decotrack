from datetime import datetime

from pydantic import BaseModel, EmailStr


class VendorCreate(BaseModel):
    name: str
    contact_person: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    gstin: str | None = None
    supply_categories: list[str] | None = None
    payment_terms: str | None = None
    notes: str | None = None


class VendorUpdate(BaseModel):
    name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    gstin: str | None = None
    supply_categories: list[str] | None = None
    payment_terms: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class VendorResponse(BaseModel):
    id: int
    name: str
    contact_person: str | None
    phone: str | None
    email: str | None
    address: str | None
    city: str | None
    state: str | None
    gstin: str | None
    supply_categories: list[str] | None
    payment_terms: str | None
    notes: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
