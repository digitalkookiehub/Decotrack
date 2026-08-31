import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin, require_any
from app.models.approval import EntityType
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.purchase_order import ApprovalRequest
from app.schemas.work_order import WOCreate, WOUpdate
from app.services import approval_service, work_order_service

router = APIRouter(prefix="/work-orders", tags=["Work Orders"])


def _wo_to_response(wo) -> dict:
    return {
        "id": wo.id,
        "wo_number": wo.wo_number,
        "project_id": wo.project_id,
        "project_name": wo.project.name if wo.project else None,
        "created_by": wo.created_by,
        "creator_name": wo.creator.full_name if wo.creator else None,
        "status": wo.status.value if hasattr(wo.status, "value") else wo.status,
        "estimated_material_cost": float(wo.estimated_material_cost or 0),
        "notes": wo.notes,
        "rejection_reason": wo.rejection_reason,
        "rejection_count": wo.rejection_count,
        "approved_by": wo.approved_by,
        "approver_name": wo.approver.full_name if hasattr(wo, "approver") and wo.approver else None,
        "approved_at": wo.approved_at,
        "submitted_at": wo.submitted_at,
        "created_at": wo.created_at,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else None,
                "quantity": item.quantity,
                "completed_count": item.completed_count,
                "status": item.status.value if hasattr(item.status, "value") else item.status,
            }
            for item in (wo.items or [])
        ],
    }


@router.get("/")
async def list_wos(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = None,
    project_id: int | None = None,
):
    wos, total = work_order_service.get_wos(db, page, per_page, status, project_id)
    return {
        "items": [_wo_to_response(wo) for wo in wos],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", status_code=201)
async def create_wo(
    data: WOCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    wo = work_order_service.create_wo(db, data, user.id)
    return _wo_to_response(work_order_service.get_wo(db, wo.id))


@router.get("/{wo_id}")
async def get_wo(
    wo_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    wo = work_order_service.get_wo(db, wo_id)
    result = _wo_to_response(wo)
    result["approval_history"] = approval_service.get_approval_history(
        db, EntityType.WORK_ORDER, wo_id
    )
    return result


@router.get("/{wo_id}/material-check")
async def check_materials(
    wo_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return work_order_service.check_wo_materials(db, wo_id)


@router.post("/{wo_id}/submit", response_model=MessageResponse)
async def submit_wo(
    wo_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    work_order_service.submit_wo(db, wo_id, user.id)
    return MessageResponse(message="Work order submitted for approval")


@router.post("/{wo_id}/approve", response_model=MessageResponse)
async def approve_wo(
    wo_id: int,
    data: ApprovalRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    work_order_service.approve_wo(db, wo_id, admin.id, data.comments)
    return MessageResponse(message="Work order approved — materials issued")


@router.post("/{wo_id}/reject", response_model=MessageResponse)
async def reject_wo(
    wo_id: int,
    data: ApprovalRequest,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    work_order_service.reject_wo(db, wo_id, admin.id, data.comments)
    return MessageResponse(message="Work order rejected")


@router.get("/{wo_id}/production")
async def get_production(
    wo_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    from app.services import production_service
    return production_service.get_production_units(db, wo_id)


@router.get("/{wo_id}/wastage")
async def get_wastage(
    wo_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    from app.services import production_service
    return production_service.get_wastage(db, wo_id)
