import logging
import math
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.exceptions import BadRequestError, NotFoundError
from app.models.approval import EntityType
from app.models.dispatch import (
    Dispatch,
    DispatchItem,
    DispatchStatus,
    FGStatus,
    FinishedGoodInventory,
)
from app.models.dispatch_photo import DispatchPhoto, PhotoCheckpoint, PhotoUploaderRole
from app.models.project import Project
from app.schemas.dispatch import DispatchCreate
from app.services import approval_service
from app.services.numbering_service import generate_number

logger = logging.getLogger(__name__)

EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two lat/lng points, in meters."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _geocode_address(address: str, city: str | None) -> tuple[float, float] | None:
    """Best-effort geocode via OpenStreetMap Nominatim. Returns None on any failure —
    never raises, since a bad/informal address must not block dispatch loading."""
    query = ", ".join(part for part in [address, city, "India"] if part)
    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": "DecoTrack-ERP/1.0"},
            timeout=5.0,
        )
        resp.raise_for_status()
        results = resp.json()
        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception:
        logger.warning("Geocoding failed for address %r", query, exc_info=True)
        return None


def geofence_check(dispatch: Dispatch, gps_lat: float | None, gps_lng: float | None) -> dict:
    """Distance from a captured GPS point to the dispatch's geocoded delivery
    address. `flagged` is advisory only — never blocks anything."""
    if dispatch.delivery_lat is None or dispatch.delivery_lng is None or gps_lat is None or gps_lng is None:
        return {"distance_m": None, "flagged": False}

    distance = haversine_m(float(dispatch.delivery_lat), float(dispatch.delivery_lng), gps_lat, gps_lng)
    return {"distance_m": round(distance, 1), "flagged": distance > settings.GEOFENCE_RADIUS_M}


def create_dispatch(db: Session, data: DispatchCreate, user_id: int) -> Dispatch:
    dispatch_number = generate_number(db, "DSP", Dispatch.dispatch_number, Dispatch)

    dispatch = Dispatch(
        dispatch_number=dispatch_number,
        project_id=data.project_id,
        created_by=user_id,
        vehicle_number=data.vehicle_number,
        driver_name=data.driver_name,
        driver_phone=data.driver_phone,
        delivery_address=data.delivery_address,
        delivery_city=data.delivery_city,
        notes=data.notes,
    )
    db.add(dispatch)
    db.flush()

    for item_data in data.items:
        item = DispatchItem(
            dispatch_id=dispatch.id,
            project_item_id=item_data.project_item_id,
            product_id=item_data.product_id,
            product_name=item_data.product_name,
            quantity=item_data.quantity,
        )
        db.add(item)

    db.commit()
    db.refresh(dispatch)
    logger.info("Dispatch created: %s", dispatch.dispatch_number)
    return dispatch


def get_dispatches(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    status: str | None = None,
    project_id: int | None = None,
) -> tuple[list[Dispatch], int]:
    query = db.query(Dispatch).options(
        joinedload(Dispatch.project),
        joinedload(Dispatch.items),
    )
    if status:
        query = query.filter(Dispatch.status == DispatchStatus(status))
    if project_id:
        query = query.filter(Dispatch.project_id == project_id)

    total = query.count()
    dispatches = (
        query.order_by(Dispatch.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return dispatches, total


def get_dispatch(db: Session, dispatch_id: int) -> Dispatch:
    dispatch = (
        db.query(Dispatch)
        .options(
            joinedload(Dispatch.project),
            joinedload(Dispatch.creator),
            joinedload(Dispatch.items),
            joinedload(Dispatch.photos),
        )
        .filter(Dispatch.id == dispatch_id)
        .first()
    )
    if not dispatch:
        raise NotFoundError("Dispatch")
    return dispatch


def submit_dispatch(db: Session, dispatch_id: int, user_id: int) -> Dispatch:
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise NotFoundError("Dispatch")
    if dispatch.status not in (DispatchStatus.DRAFT, DispatchStatus.REJECTED):
        raise BadRequestError("Can only submit DRAFT or REJECTED dispatches")

    approval_service.submit_for_approval(db, EntityType.DISPATCH, dispatch_id, user_id)
    db.refresh(dispatch)
    return dispatch


def approve_dispatch(db: Session, dispatch_id: int, admin_id: int, comments: str | None = None) -> Dispatch:
    approval_service.approve_entity(db, EntityType.DISPATCH, dispatch_id, admin_id, comments)
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    dispatch.status = DispatchStatus.LOADING_VERIFICATION
    db.commit()
    db.refresh(dispatch)
    logger.info("Dispatch %s approved — entering loading verification", dispatch.dispatch_number)
    return dispatch


def reject_dispatch(db: Session, dispatch_id: int, admin_id: int, comments: str | None = None) -> Dispatch:
    approval_service.reject_entity(db, EntityType.DISPATCH, dispatch_id, admin_id, comments)
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    return dispatch


def verify_item(db: Session, dispatch_id: int, item_id: int) -> DispatchItem:
    item = db.query(DispatchItem).filter(
        DispatchItem.dispatch_id == dispatch_id,
        DispatchItem.id == item_id,
    ).first()
    if not item:
        raise NotFoundError("Dispatch item")
    item.factory_verified = True
    db.commit()
    db.refresh(item)
    return item


def confirm_loading(db: Session, dispatch_id: int, user_id: int) -> Dispatch:
    dispatch = get_dispatch(db, dispatch_id)
    if dispatch.status != DispatchStatus.LOADING_VERIFICATION:
        raise BadRequestError("Dispatch must be in LOADING_VERIFICATION status")

    # Check all items verified and have photos
    for item in dispatch.items:
        if not item.factory_verified:
            raise BadRequestError(f"Item '{item.product_name}' not factory-verified")
        item_photos = [p for p in dispatch.photos if p.dispatch_item_id == item.id and p.checkpoint == PhotoCheckpoint.FACTORY]
        if not item_photos:
            raise BadRequestError(f"Item '{item.product_name}' has no factory photos")

    now = datetime.now(timezone.utc)

    # Generate delivery token
    token = secrets.token_urlsafe(32)
    dispatch.delivery_token = token
    dispatch.token_expires_at = now + timedelta(hours=48)
    dispatch.loading_confirmed_at = now
    dispatch.loading_confirmed_by = user_id
    dispatch.status = DispatchStatus.IN_TRANSIT

    # Best-effort geocode of the delivery address for the geofence check on
    # delivery photos — failure here must never block the truck from leaving.
    if dispatch.delivery_address and dispatch.delivery_lat is None:
        coords = _geocode_address(dispatch.delivery_address, dispatch.delivery_city)
        if coords:
            dispatch.delivery_lat, dispatch.delivery_lng = coords

    # Deduct finished goods from inventory
    for item in dispatch.items:
        fg_entries = (
            db.query(FinishedGoodInventory)
            .filter(
                FinishedGoodInventory.product_id == item.product_id,
                FinishedGoodInventory.project_id == dispatch.project_id,
                FinishedGoodInventory.status == FGStatus.IN_STOCK,
            )
            .all()
        )
        remaining = item.quantity
        for fg in fg_entries:
            if remaining <= 0:
                break
            deduct = min(int(fg.quantity), remaining)
            fg.quantity -= deduct
            if fg.quantity <= 0:
                fg.status = FGStatus.DISPATCHED
            remaining -= deduct

    db.commit()
    db.refresh(dispatch)
    logger.info(
        "Dispatch %s loading confirmed — token generated, FG deducted, status IN_TRANSIT",
        dispatch.dispatch_number,
    )
    return dispatch


def regenerate_link(db: Session, dispatch_id: int) -> Dispatch:
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise NotFoundError("Dispatch")

    now = datetime.now(timezone.utc)
    dispatch.delivery_token = secrets.token_urlsafe(32)
    dispatch.token_expires_at = now + timedelta(hours=48)
    dispatch.token_used = False
    db.commit()
    db.refresh(dispatch)
    logger.info("Delivery link regenerated for %s", dispatch.dispatch_number)
    return dispatch


# ── Driver delivery (public, token-based) ─────────────────────
def _get_valid_dispatch_by_token(db: Session, token: str) -> Dispatch:
    dispatch = db.query(Dispatch).filter(Dispatch.delivery_token == token).first()
    if not dispatch:
        raise NotFoundError("Delivery link")
    now = datetime.now(timezone.utc)
    if dispatch.token_expires_at and dispatch.token_expires_at.replace(tzinfo=timezone.utc) < now:
        raise BadRequestError("Delivery link has expired")
    if dispatch.token_used:
        raise BadRequestError("Delivery already completed")
    if dispatch.status not in (DispatchStatus.IN_TRANSIT, DispatchStatus.DELIVERY_VERIFICATION):
        raise BadRequestError("Delivery not available")
    return dispatch


def get_delivery_by_token(db: Session, token: str) -> dict:
    dispatch = _get_valid_dispatch_by_token(db, token)

    project = db.query(Project).filter(Project.id == dispatch.project_id).first()
    items = db.query(DispatchItem).filter(DispatchItem.dispatch_id == dispatch.id).all()
    photos = db.query(DispatchPhoto).filter(
        DispatchPhoto.dispatch_id == dispatch.id,
        DispatchPhoto.checkpoint == PhotoCheckpoint.SITE,
    ).count()
    all_items_verified = all(i.site_verified for i in items)

    return {
        "dispatch_number": dispatch.dispatch_number,
        "project_name": project.name if project else None,
        "delivery_address": dispatch.delivery_address,
        "items": [
            {
                "id": i.id,
                "product_name": i.product_name,
                "quantity": i.quantity,
                "delivered_quantity": i.delivered_quantity,
                "site_verified": i.site_verified,
            }
            for i in items
        ],
        "photos_uploaded": photos,
        "min_photos_required": 2,
        "all_items_verified": all_items_verified,
        "can_complete": photos >= 2 and all_items_verified,
    }


def verify_delivery_item(db: Session, token: str, item_id: int, delivered_quantity: int) -> dict:
    dispatch = _get_valid_dispatch_by_token(db, token)

    item = db.query(DispatchItem).filter(
        DispatchItem.dispatch_id == dispatch.id,
        DispatchItem.id == item_id,
    ).first()
    if not item:
        raise NotFoundError("Dispatch item")
    if delivered_quantity < 0 or delivered_quantity > item.quantity:
        raise BadRequestError(f"Delivered quantity must be between 0 and {item.quantity}")

    item.delivered_quantity = delivered_quantity
    item.site_verified = True
    db.commit()
    db.refresh(item)

    if delivered_quantity < item.quantity:
        logger.warning(
            "Delivery shortfall on %s: %s got %d/%d",
            dispatch.dispatch_number, item.product_name, delivered_quantity, item.quantity,
        )

    return {
        "id": item.id,
        "delivered_quantity": item.delivered_quantity,
        "site_verified": item.site_verified,
    }


def complete_delivery(db: Session, token: str) -> dict:
    dispatch = db.query(Dispatch).filter(Dispatch.delivery_token == token).first()
    if not dispatch:
        raise NotFoundError("Delivery link")

    items = db.query(DispatchItem).filter(DispatchItem.dispatch_id == dispatch.id).all()
    for item in items:
        if not item.site_verified:
            raise BadRequestError(f"Item '{item.product_name}' not confirmed — enter quantity received")

    photos_count = db.query(DispatchPhoto).filter(
        DispatchPhoto.dispatch_id == dispatch.id,
        DispatchPhoto.checkpoint == PhotoCheckpoint.SITE,
    ).count()

    if photos_count < 2:
        raise BadRequestError("Minimum 2 delivery photos required")

    now = datetime.now(timezone.utc)
    dispatch.status = DispatchStatus.DELIVERY_VERIFICATION
    dispatch.delivery_marked_at = now
    dispatch.token_used = True
    db.commit()

    logger.info("Delivery marked by driver for %s", dispatch.dispatch_number)
    return {"message": "Delivery marked successfully. Awaiting employee confirmation."}


def confirm_delivery(db: Session, dispatch_id: int, user_id: int) -> Dispatch:
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise NotFoundError("Dispatch")
    if dispatch.status != DispatchStatus.DELIVERY_VERIFICATION:
        raise BadRequestError("Dispatch must be in DELIVERY_VERIFICATION status")

    dispatch.status = DispatchStatus.DELIVERED
    dispatch.delivery_confirmed_at = datetime.now(timezone.utc)
    dispatch.delivery_confirmed_by = user_id
    db.commit()
    db.refresh(dispatch)
    logger.info("Delivery confirmed for %s", dispatch.dispatch_number)
    return dispatch
