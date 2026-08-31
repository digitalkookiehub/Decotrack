import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin, require_any
from app.models.approval import EntityType
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.purchase_order import ApprovalRequest, POCreate, POResponse, POUpdate
from app.services import approval_service, purchase_order_service

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])


def _po_to_response(po) -> dict:
    return {
        "id": po.id,
        "po_number": po.po_number,
        "vendor_id": po.vendor_id,
        "vendor_name": po.vendor.name if po.vendor else None,
        "created_by": po.created_by,
        "creator_name": po.creator.full_name if po.creator else None,
        "status": po.status.value if hasattr(po.status, "value") else po.status,
        "total_amount": float(po.total_amount or 0),
        "notes": po.notes,
        "rejection_reason": po.rejection_reason,
        "rejection_count": po.rejection_count,
        "approved_by": po.approved_by,
        "approver_name": po.approver.full_name if hasattr(po, "approver") and po.approver else None,
        "approved_at": po.approved_at,
        "submitted_at": po.submitted_at,
        "created_at": po.created_at,
        "items": [
            {
                "id": item.id,
                "raw_material_id": item.raw_material_id,
                "material_name": item.raw_material.name if item.raw_material else None,
                "material_sku": item.raw_material.sku if item.raw_material else None,
                "material_unit": item.raw_material.unit.value if item.raw_material and hasattr(item.raw_material.unit, "value") else None,
                "quantity": float(item.quantity),
                "rate": float(item.rate),
                "amount": float(item.amount),
                "last_purchase_rate": float(item.last_purchase_rate or 0),
                "current_stock": float(item.current_stock or 0),
                "received_qty": float(item.received_qty or 0),
            }
            for item in (po.items or [])
        ],
    }


@router.get("/")
async def list_pos(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = None,
    vendor_id: int | None = None,
):
    pos, total = purchase_order_service.get_pos(db, page, per_page, status, vendor_id)
    return {
        "items": [_po_to_response(po) for po in pos],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", status_code=201)
async def create_po(
    data: POCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    po = purchase_order_service.create_po(db, data, user.id)
    return _po_to_response(purchase_order_service.get_po(db, po.id))


@router.get("/{po_id}")
async def get_po(
    po_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    po = purchase_order_service.get_po(db, po_id)
    result = _po_to_response(po)
    result["approval_history"] = approval_service.get_approval_history(
        db, EntityType.PURCHASE_ORDER, po_id
    )
    return result


@router.put("/{po_id}")
async def update_po(
    po_id: int,
    data: POUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    po = purchase_order_service.update_po(db, po_id, data)
    return _po_to_response(purchase_order_service.get_po(db, po.id))


@router.post("/{po_id}/submit", response_model=MessageResponse)
async def submit_po(
    po_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    purchase_order_service.submit_po(db, po_id, user.id)
    return MessageResponse(message="Purchase order submitted for approval")


@router.post("/{po_id}/approve", response_model=MessageResponse)
async def approve_po(
    po_id: int,
    data: ApprovalRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    purchase_order_service.approve_po(db, po_id, admin.id, data.comments)
    return MessageResponse(message="Purchase order approved")


@router.post("/{po_id}/reject", response_model=MessageResponse)
async def reject_po(
    po_id: int,
    data: ApprovalRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    purchase_order_service.reject_po(db, po_id, admin.id, data.comments)
    return MessageResponse(message="Purchase order rejected")


@router.post("/{po_id}/resubmit", response_model=MessageResponse)
async def resubmit_po(
    po_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    purchase_order_service.resubmit_po(db, po_id, user.id)
    return MessageResponse(message="Purchase order resubmitted")


@router.post("/{po_id}/mark-sent", response_model=MessageResponse)
async def mark_sent(
    po_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    purchase_order_service.mark_sent(db, po_id)
    return MessageResponse(message="Purchase order marked as sent to vendor")
