from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.user import User
from app.schemas.inventory import CategoryCreate, CategoryResponse
from app.services import inventory_service

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("/", response_model=list[CategoryResponse])
async def list_categories(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return inventory_service.get_categories(db)


@router.post("/", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return inventory_service.create_category(db, data)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    data: CategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return inventory_service.update_category(db, category_id, data)
