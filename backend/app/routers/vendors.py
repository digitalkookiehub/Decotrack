import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.vendor import VendorCreate, VendorResponse, VendorUpdate
from app.services import vendor_service

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.get("/")
async def list_vendors(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    vendors, total = vendor_service.get_vendors(db, page, per_page, search)
    return {
        "items": [VendorResponse.model_validate(v) for v in vendors],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", response_model=VendorResponse, status_code=201)
async def create_vendor(
    data: VendorCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return vendor_service.create_vendor(db, data)


@router.get("/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return vendor_service.get_vendor(db, vendor_id)


@router.put("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: int,
    data: VendorUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return vendor_service.update_vendor(db, vendor_id, data)


@router.delete("/{vendor_id}", response_model=MessageResponse)
async def delete_vendor(
    vendor_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    vendor_service.delete_vendor(db, vendor_id)
    return MessageResponse(message="Vendor deactivated")
