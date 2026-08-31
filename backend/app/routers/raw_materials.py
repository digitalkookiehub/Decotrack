import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_any
from app.models.user import User
from app.schemas.inventory import (
    BatchResponse,
    CategoryResponse,
    MovementResponse,
    RawMaterialCreate,
    RawMaterialResponse,
    RawMaterialUpdate,
    ReorderAlertResponse,
    StockAdjustRequest,
)
from app.services import inventory_service

router = APIRouter(tags=["Raw Materials"])


@router.get("/item-categories", response_model=list[CategoryResponse])
async def list_categories(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return inventory_service.get_categories(db)


@router.get("/raw-materials")
async def list_materials(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category_id: int | None = None,
    search: str | None = None,
):
    materials, total = inventory_service.get_materials(
        db, page, per_page, category_id, search
    )
    return {
        "items": [RawMaterialResponse.model_validate(m) for m in materials],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/raw-materials", response_model=RawMaterialResponse, status_code=201)
async def create_material(
    data: RawMaterialCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return inventory_service.create_material(db, data)


@router.get("/raw-materials/{material_id}", response_model=RawMaterialResponse)
async def get_material(
    material_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return inventory_service.get_material(db, material_id)


@router.put("/raw-materials/{material_id}", response_model=RawMaterialResponse)
async def update_material(
    material_id: int,
    data: RawMaterialUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return inventory_service.update_material(db, material_id, data)


@router.get("/raw-materials/{material_id}/stock")
async def get_material_stock(
    material_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    stock_data = inventory_service.get_material_stock(db, material_id)
    stock_data["batches"] = [
        BatchResponse.model_validate(b) for b in stock_data["batches"]
    ]
    return stock_data


@router.get("/raw-materials/{material_id}/movements")
async def get_material_movements(
    material_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    movements, total = inventory_service.get_material_movements(
        db, material_id, page, per_page
    )
    return {
        "items": [MovementResponse.model_validate(m) for m in movements],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/raw-materials/{material_id}/adjust", response_model=RawMaterialResponse)
async def adjust_stock(
    material_id: int,
    data: StockAdjustRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return inventory_service.adjust_stock(
        db, material_id, data.quantity, data.reason, user.id
    )


@router.get("/inventory/reorder-alerts", response_model=list[ReorderAlertResponse])
async def get_reorder_alerts(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return inventory_service.get_reorder_alerts(db)


@router.get("/inventory/summary")
async def get_inventory_summary(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    from app.models.raw_material import RawMaterial
    from sqlalchemy import func

    total_items = db.query(func.count(RawMaterial.id)).filter(RawMaterial.is_active == True).scalar()
    total_value = (
        db.query(func.sum(RawMaterial.current_stock * RawMaterial.last_purchase_rate))
        .filter(RawMaterial.is_active == True)
        .scalar()
    ) or 0
    below_reorder = (
        db.query(func.count(RawMaterial.id))
        .filter(
            RawMaterial.is_active == True,
            RawMaterial.current_stock <= RawMaterial.reorder_level,
        )
        .scalar()
    )

    return {
        "total_items": total_items,
        "total_value": float(total_value),
        "below_reorder": below_reorder,
    }
