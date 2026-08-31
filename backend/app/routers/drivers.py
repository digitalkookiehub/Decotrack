import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.driver import Driver
from app.models.user import User
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/drivers", tags=["Drivers"])


class DriverCreate(BaseModel):
    name: str
    phone: str
    license_number: str | None = None
    vehicle_number: str | None = None


class DriverUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    license_number: str | None = None
    vehicle_number: str | None = None
    is_active: bool | None = None


class DriverResponse(BaseModel):
    id: int
    name: str
    phone: str
    license_number: str | None
    vehicle_number: str | None
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("/")
async def list_drivers(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    active_only: bool = True,
):
    query = db.query(Driver)
    if active_only:
        query = query.filter(Driver.is_active == True)
    total = query.count()
    drivers = query.order_by(Driver.name).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [DriverResponse.model_validate(d) for d in drivers],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", response_model=DriverResponse, status_code=201)
async def create_driver(
    data: DriverCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    driver = Driver(**data.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


@router.get("/{driver_id}", response_model=DriverResponse)
async def get_driver(
    driver_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        from app.exceptions import NotFoundError
        raise NotFoundError("Driver")
    return driver


@router.put("/{driver_id}", response_model=DriverResponse)
async def update_driver(
    driver_id: int,
    data: DriverUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        from app.exceptions import NotFoundError
        raise NotFoundError("Driver")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(driver, field, value)
    db.commit()
    db.refresh(driver)
    return driver


@router.delete("/{driver_id}", response_model=MessageResponse)
async def delete_driver(
    driver_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if driver:
        driver.is_active = False
        db.commit()
    return MessageResponse(message="Driver deactivated")
