from datetime import datetime

from pydantic import BaseModel, EmailStr


class ClientCreate(BaseModel):
    name: str
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    gstin: str | None = None
    notes: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    gstin: str | None = None
    notes: str | None = None


class ClientResponse(BaseModel):
    id: int
    name: str
    phone: str | None
    email: str | None
    address: str | None
    city: str | None
    state: str | None
    gstin: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
