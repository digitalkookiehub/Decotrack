import math
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin, require_any
from app.models.approval import EntityType
from app.models.dispatch_photo import DispatchPhoto, PhotoCheckpoint, PhotoUploaderRole
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.dispatch import DispatchCreate
from app.schemas.purchase_order import ApprovalRequest
from app.services import approval_service, dispatch_service

router = APIRouter(prefix="/dispatches", tags=["Dispatch"])


def _dispatch_to_response(d) -> dict:
    return {
        "id": d.id,
        "dispatch_number": d.dispatch_number,
        "project_id": d.project_id,
        "project_name": d.project.name if d.project else None,
        "status": d.status.value if hasattr(d.status, "value") else d.status,
        "vehicle_number": d.vehicle_number,
        "driver_name": d.driver_name,
        "driver_phone": d.driver_phone,
        "delivery_address": d.delivery_address,
        "delivery_city": d.delivery_city,
        "delivery_geocoded": d.delivery_lat is not None and d.delivery_lng is not None,
        "notes": d.notes,
        "rejection_reason": d.rejection_reason,
        "rejection_count": d.rejection_count,
        "approved_by": d.approved_by,
        "approved_at": d.approved_at,
        "loading_confirmed_at": d.loading_confirmed_at,
        "delivery_confirmed_at": d.delivery_confirmed_at,
        "challan_url": d.challan_url,
        "submitted_at": d.submitted_at,
        "created_at": d.created_at,
        "items": [
            {
                "id": item.id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "factory_verified": item.factory_verified,
                "delivered_quantity": item.delivered_quantity,
                "site_verified": item.site_verified,
                "notes": item.notes,
            }
            for item in (d.items or [])
        ],
        "photos": [
            {
                "id": p.id,
                "checkpoint": p.checkpoint.value if hasattr(p.checkpoint, "value") else p.checkpoint,
                "item_reference": p.item_reference,
                "storage_url": p.storage_url,
                "thumbnail_url": p.thumbnail_url,
                "gps_lat": float(p.gps_lat) if p.gps_lat else None,
                "gps_lng": float(p.gps_lng) if p.gps_lng else None,
                "gps_available": p.gps_available,
                "captured_at": p.captured_at,
                "notes": p.notes,
                **(
                    dispatch_service.geofence_check(d, float(p.gps_lat), float(p.gps_lng))
                    if p.checkpoint == PhotoCheckpoint.SITE and p.gps_lat and p.gps_lng
                    else {"distance_m": None, "flagged": False}
                ),
            }
            for p in (d.photos or [])
        ] if hasattr(d, "photos") and d.photos else [],
    }


@router.get("/")
async def list_dispatches(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = None,
    project_id: int | None = None,
):
    dispatches, total = dispatch_service.get_dispatches(db, page, per_page, status, project_id)
    return {
        "items": [_dispatch_to_response(d) for d in dispatches],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", status_code=201)
async def create_dispatch(
    data: DispatchCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    dispatch = dispatch_service.create_dispatch(db, data, user.id)
    return _dispatch_to_response(dispatch_service.get_dispatch(db, dispatch.id))


@router.get("/{dispatch_id}")
async def get_dispatch(
    dispatch_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    dispatch = dispatch_service.get_dispatch(db, dispatch_id)
    result = _dispatch_to_response(dispatch)
    result["approval_history"] = approval_service.get_approval_history(
        db, EntityType.DISPATCH, dispatch_id
    )
    return result


@router.post("/{dispatch_id}/submit", response_model=MessageResponse)
async def submit_dispatch(
    dispatch_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    dispatch_service.submit_dispatch(db, dispatch_id, user.id)
    return MessageResponse(message="Dispatch submitted for approval")


@router.post("/{dispatch_id}/approve", response_model=MessageResponse)
async def approve_dispatch(
    dispatch_id: int,
    data: ApprovalRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    dispatch_service.approve_dispatch(db, dispatch_id, admin.id, data.comments)
    return MessageResponse(message="Dispatch approved — proceed to loading verification")


@router.post("/{dispatch_id}/reject", response_model=MessageResponse)
async def reject_dispatch(
    dispatch_id: int,
    data: ApprovalRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    dispatch_service.reject_dispatch(db, dispatch_id, admin.id, data.comments)
    return MessageResponse(message="Dispatch rejected")


@router.post("/{dispatch_id}/verify-item/{item_id}")
async def verify_item(
    dispatch_id: int,
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    item = dispatch_service.verify_item(db, dispatch_id, item_id)
    return {"id": item.id, "factory_verified": item.factory_verified}


@router.post("/{dispatch_id}/photos")
async def upload_factory_photo(
    dispatch_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
    item_reference: str = Form("item"),
    dispatch_item_id: int | None = Form(None),
    gps_lat: float | None = Form(None),
    gps_lng: float | None = Form(None),
    notes: str | None = Form(None),
):
    """Upload a factory loading photo. Stores metadata in DB (file stored locally for dev)."""
    import os
    import uuid

    # Save file locally for dev (production would use S3)
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "dispatches", str(dispatch_id))
    os.makedirs(upload_dir, exist_ok=True)

    file_ext = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{file_ext}"
    filepath = os.path.join(upload_dir, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    photo = DispatchPhoto(
        dispatch_id=dispatch_id,
        dispatch_item_id=dispatch_item_id,
        checkpoint=PhotoCheckpoint.FACTORY,
        item_reference=item_reference,
        storage_url=f"/uploads/dispatches/{dispatch_id}/{filename}",
        thumbnail_url=f"/uploads/dispatches/{dispatch_id}/{filename}",
        captured_at=datetime.now(timezone.utc),
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        gps_available=gps_lat is not None and gps_lng is not None,
        uploaded_by=user.id,
        uploaded_by_role=PhotoUploaderRole.EMPLOYEE,
        file_size=len(contents),
        original_filename=file.filename,
        notes=notes,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)

    return {
        "id": photo.id,
        "dispatch_id": dispatch_id,
        "checkpoint": "FACTORY",
        "item_reference": item_reference,
        "storage_url": photo.storage_url,
    }


@router.post("/{dispatch_id}/confirm-loading", response_model=MessageResponse)
async def confirm_loading(
    dispatch_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    dispatch_service.confirm_loading(db, dispatch_id, user.id)
    return MessageResponse(message="Loading confirmed — dispatch in transit")


@router.post("/{dispatch_id}/regenerate-link")
async def regenerate_link(
    dispatch_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    dispatch = dispatch_service.regenerate_link(db, dispatch_id)
    from app.config import settings
    return {
        "delivery_url": f"{settings.APP_BASE_URL}/delivery/{dispatch.delivery_token}",
        "expires_at": dispatch.token_expires_at,
    }


@router.post("/{dispatch_id}/confirm-delivery", response_model=MessageResponse)
async def confirm_delivery(
    dispatch_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    dispatch_service.confirm_delivery(db, dispatch_id, user.id)
    return MessageResponse(message="Delivery confirmed")
