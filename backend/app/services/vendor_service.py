import logging

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models.vendor import Vendor
from app.schemas.vendor import VendorCreate, VendorUpdate

logger = logging.getLogger(__name__)


def create_vendor(db: Session, data: VendorCreate) -> Vendor:
    vendor = Vendor(**data.model_dump())
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    logger.info("Vendor created: %s", vendor.name)
    return vendor


def get_vendors(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    search: str | None = None,
    active_only: bool = True,
) -> tuple[list[Vendor], int]:
    query = db.query(Vendor)
    if active_only:
        query = query.filter(Vendor.is_active == True)
    if search:
        query = query.filter(Vendor.name.ilike(f"%{search}%"))

    total = query.count()
    vendors = (
        query.order_by(Vendor.name)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return vendors, total


def get_vendor(db: Session, vendor_id: int) -> Vendor:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise NotFoundError("Vendor")
    return vendor


def update_vendor(db: Session, vendor_id: int, data: VendorUpdate) -> Vendor:
    vendor = get_vendor(db, vendor_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vendor, field, value)
    db.commit()
    db.refresh(vendor)
    return vendor


def delete_vendor(db: Session, vendor_id: int) -> Vendor:
    vendor = get_vendor(db, vendor_id)
    vendor.is_active = False
    db.commit()
    db.refresh(vendor)
    logger.info("Vendor deactivated: %s", vendor.name)
    return vendor
