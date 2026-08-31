from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_any
from app.models.user import User
from app.schemas.work_order import StageUpdateRequest, WastageRequest
from app.services import production_service

router = APIRouter(prefix="/production", tags=["Production"])


@router.get("/")
async def get_active_production(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return production_service.get_active_production(db)


@router.post("/{unit_id}/stage")
async def update_stage(
    unit_id: int,
    data: StageUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return production_service.update_stage(db, unit_id, data.stage_name, data.action, user.id)


@router.post("/{unit_id}/wastage")
async def log_wastage(
    unit_id: int,
    data: WastageRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return production_service.log_wastage(
        db, unit_id, data.raw_material_id, data.quantity, data.reason, data.stage_name, user.id
    )
