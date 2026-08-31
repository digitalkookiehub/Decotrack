import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
async def list_notifications(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = db.query(Notification).filter(Notification.user_id == user.id)
    total = query.count()
    notifications = (
        query.order_by(Notification.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "items": [
            {
                "id": n.id,
                "type": n.type.value if hasattr(n.type, "value") else n.type,
                "title": n.title,
                "message": n.message,
                "entity_type": n.entity_type,
                "entity_id": n.entity_id,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in notifications
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.put("/{notification_id}/read", response_model=MessageResponse)
async def mark_read(
    notification_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    from datetime import datetime, timezone

    n = db.query(Notification).filter(
        Notification.id == notification_id, Notification.user_id == user.id
    ).first()
    if n:
        n.is_read = True
        n.read_at = datetime.now(timezone.utc)
        db.commit()
    return MessageResponse(message="Notification marked as read")


@router.put("/read-all", response_model=MessageResponse)
async def mark_all_read(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    from datetime import datetime, timezone

    db.query(Notification).filter(
        Notification.user_id == user.id, Notification.is_read == False
    ).update({"is_read": True, "read_at": datetime.now(timezone.utc)})
    db.commit()
    return MessageResponse(message="All notifications marked as read")


@router.get("/unread-count")
async def unread_count(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    from sqlalchemy import func

    count = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user.id, Notification.is_read == False)
        .scalar()
    )
    return {"count": count}
