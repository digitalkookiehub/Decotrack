import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_any
from app.models.user import User
from app.schemas.grn import GRNCreate
from app.services import grn_service

router = APIRouter(prefix="/grn", tags=["GRN"])


def _grn_to_response(grn) -> dict:
    return {
        "id": grn.id,
        "grn_number": grn.grn_number,
        "po_id": grn.po_id,
        "po_number": grn.purchase_order.po_number if grn.purchase_order else None,
        "vendor_id": grn.vendor_id,
        "vendor_name": grn.vendor.name if grn.vendor else None,
        "received_by": grn.received_by,
        "receiver_name": grn.receiver.full_name if grn.receiver else None,
        "received_date": str(grn.received_date),
        "notes": grn.notes,
        "created_at": grn.created_at,
        "items": [
            {
                "id": item.id,
                "raw_material_id": item.raw_material_id,
                "material_name": item.raw_material.name if item.raw_material else None,
                "material_sku": item.raw_material.sku if item.raw_material else None,
                "ordered_qty": float(item.ordered_qty),
                "received_qty": float(item.received_qty),
                "accepted_qty": float(item.accepted_qty),
                "rejected_qty": float(item.rejected_qty or 0),
                "quality_status": item.quality_status.value if hasattr(item.quality_status, "value") else item.quality_status,
                "rejection_reason": item.rejection_reason,
                "rate": float(item.rate),
            }
            for item in (grn.items or [])
        ],
    }


@router.get("/")
async def list_grns(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    po_id: int | None = None,
):
    grns, total = grn_service.get_grns(db, page, per_page, po_id)
    return {
        "items": [_grn_to_response(g) for g in grns],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", status_code=201)
async def create_grn(
    data: GRNCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    grn = grn_service.create_grn(db, data, user.id)
    return _grn_to_response(grn_service.get_grn(db, grn.id))


@router.get("/{grn_id}")
async def get_grn(
    grn_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    grn = grn_service.get_grn(db, grn_id)
    return _grn_to_response(grn)
