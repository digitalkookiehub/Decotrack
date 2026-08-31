import logging
import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.schemas.auth import (
    AutoApproveSettings,
    UserAdminUpdateRequest,
    UserCreateRequest,
    UserResponse,
)
from app.schemas.common import MessageResponse
from app.services import auth_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users")
async def list_users(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    users, total = auth_service.get_all_users(db, page, per_page)
    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
):
    user = auth_service.create_user_admin(db, data)
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserAdminUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
):
    return auth_service.update_user_admin(db, user_id, data)


@router.put("/settings", response_model=UserResponse)
async def update_settings(
    data: AutoApproveSettings,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_admin)],
):
    return auth_service.update_auto_approve_settings(db, admin, data)
