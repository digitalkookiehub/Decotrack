import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.services import approval_service

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get("/")
async def get_pending_approvals(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    pending, total = approval_service.get_pending_approvals(db, page, per_page)
    return {
        "items": pending,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.get("/history")
async def get_approval_history(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
    entity_type: str | None = None,
    entity_id: int | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    from app.models.approval import ApprovalLog, EntityType as ET

    query = db.query(ApprovalLog)
    if entity_type:
        query = query.filter(ApprovalLog.entity_type == ET(entity_type))
    if entity_id:
        query = query.filter(ApprovalLog.entity_id == entity_id)

    total = query.count()
    logs = (
        query.order_by(ApprovalLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    from app.models.user import User as UserModel
    items = []
    for log in logs:
        performer = db.query(UserModel).filter(UserModel.id == log.performed_by).first()
        items.append({
            "id": log.id,
            "entity_type": log.entity_type.value,
            "entity_id": log.entity_id,
            "action": log.action.value,
            "performed_by": log.performed_by,
            "performer_name": performer.full_name if performer else None,
            "comments": log.comments,
            "auto_approve_reason": log.auto_approve_reason,
            "created_at": log.created_at,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }
