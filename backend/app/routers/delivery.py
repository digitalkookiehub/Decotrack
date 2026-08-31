"""Public delivery endpoints for drivers — NO authentication required."""
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import BadRequestError, NotFoundError
from app.models.dispatch import Dispatch, DispatchStatus
from app.models.dispatch_photo import DispatchPhoto, PhotoCheckpoint, PhotoUploaderRole
from app.services import dispatch_service

router = APIRouter(prefix="/delivery", tags=["Delivery (Public)"])


def _get_dispatch_by_token(db: Session, token: str) -> Dispatch:
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


@router.get("/{token}")
async def get_delivery_info(
    token: str,
    db: Session = Depends(get_db),
):
    """Driver opens delivery link — shows dispatch items and photo upload status."""
    return dispatch_service.get_delivery_by_token(db, token)


@router.post("/{token}/photos")
async def upload_delivery_photo(
    token: str,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    item_reference: str = Form("site_delivery"),
    gps_lat: float | None = Form(None),
    gps_lng: float | None = Form(None),
):
    """Driver uploads a delivery photo — NO auth required, secured by token."""
    dispatch = _get_dispatch_by_token(db, token)

    # Save file locally for dev
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "dispatches", str(dispatch.id))
    os.makedirs(upload_dir, exist_ok=True)

    file_ext = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"
    filename = f"site_{uuid.uuid4().hex}{file_ext}"
    filepath = os.path.join(upload_dir, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    photo = DispatchPhoto(
        dispatch_id=dispatch.id,
        checkpoint=PhotoCheckpoint.SITE,
        item_reference=item_reference,
        storage_url=f"/uploads/dispatches/{dispatch.id}/{filename}",
        thumbnail_url=f"/uploads/dispatches/{dispatch.id}/{filename}",
        captured_at=datetime.now(timezone.utc),
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        gps_available=gps_lat is not None and gps_lng is not None,
        uploaded_by=None,
        uploaded_by_role=PhotoUploaderRole.DRIVER,
        file_size=len(contents),
        original_filename=file.filename,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)

    return {"id": photo.id, "message": "Photo uploaded successfully"}


@router.post("/{token}/verify-item/{item_id}")
async def verify_delivery_item(
    token: str,
    item_id: int,
    db: Session = Depends(get_db),
    delivered_quantity: int = Form(...),
):
    """Driver confirms how many units of this item were actually received at site."""
    return dispatch_service.verify_delivery_item(db, token, item_id, delivered_quantity)


@router.post("/{token}/complete")
async def complete_delivery(
    token: str,
    db: Session = Depends(get_db),
):
    """Driver marks delivery as complete (requires min 2 photos + every item confirmed)."""
    return dispatch_service.complete_delivery(db, token)
