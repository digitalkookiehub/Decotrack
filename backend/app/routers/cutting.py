import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.user import User
from app.schemas.cutting import (
    CutOrderResponse,
    CutOrderStatusUpdate,
    CuttingListRequest,
    CuttingListResponse,
    CuttingSaveRequest,
)
from app.services import cutting_service

router = APIRouter(prefix="/cutting", tags=["Cut Planner"])


@router.post("/optimize", response_model=CuttingListResponse)
async def optimize_cutting_list(
    data: CuttingListRequest,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    """Optimize a cutting list — fits pieces into minimum sheets."""
    request_data = {
        "raw_material_id": data.raw_material_id,
        "pieces": [p.model_dump() for p in data.pieces],
        "kerf_mm": data.kerf_mm,
        "label": data.label,
    }
    return cutting_service.calculate_cutting_list(db, request_data)


@router.post("/save", response_model=CutOrderResponse, status_code=201)
async def save_cut_order(
    data: CuttingSaveRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
):
    """Save cut plan as a Cut Order (CO-YYYY-NNNN)."""
    pattern = cutting_service.save_cutting_pattern(db, data.model_dump(), user)
    resp = CutOrderResponse.model_validate(pattern)
    resp.material_name = pattern.raw_material.name if pattern.raw_material else None
    resp.creator_name = pattern.creator.full_name if pattern.creator else None
    resp.wo_number = pattern.work_order.wo_number if pattern.work_order else None
    return resp


@router.get("/orders")
async def list_cut_orders(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    job_type: str | None = None,
    status: str | None = None,
    company_name: str | None = None,
    search: str | None = None,
):
    """List all cut orders with filters."""
    orders, total = cutting_service.get_cut_orders(
        db, page, per_page, job_type, status, company_name, search
    )
    items = []
    for o in orders:
        resp = CutOrderResponse.model_validate(o)
        resp.material_name = o.raw_material.name if o.raw_material else None
        resp.creator_name = o.creator.full_name if o.creator else None
        resp.wo_number = o.work_order.wo_number if o.work_order else None
        items.append(resp)
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.get("/orders/stats")
async def cut_order_stats(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    """Get summary stats — orders, sheets, costs by job type, top contractors."""
    return cutting_service.get_cut_order_stats(db)


@router.get("/orders/{order_id}", response_model=CutOrderResponse)
async def get_cut_order(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    """Get a single cut order."""
    pattern = cutting_service.get_cutting_pattern(db, order_id)
    resp = CutOrderResponse.model_validate(pattern)
    resp.material_name = pattern.raw_material.name if pattern.raw_material else None
    resp.creator_name = pattern.creator.full_name if pattern.creator else None
    resp.wo_number = pattern.work_order.wo_number if pattern.work_order else None
    return resp


@router.get("/orders/{order_id}/layout", response_model=CuttingListResponse)
async def get_cut_order_layout(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    """Return the sheet layout computed when the cut order was saved.

    Falls back to re-optimizing from the material's single sheet size for cut
    orders saved before layout persistence was added — that path only works if
    the linked raw material has sheet dimensions configured.
    """
    pattern = cutting_service.get_cutting_pattern(db, order_id)
    if pattern.layout_result:
        return pattern.layout_result

    request_data = {
        "raw_material_id": pattern.raw_material_id,
        "pieces": pattern.panels,  # saved cutting list
        "kerf_mm": 4,
    }
    return cutting_service.calculate_cutting_list(db, request_data)


@router.put("/orders/{order_id}/status", response_model=CutOrderResponse)
async def update_order_status(
    order_id: int,
    data: CutOrderStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    """Update cut order status (PLANNED → CUTTING → COMPLETED)."""
    pattern = cutting_service.update_cut_order_status(db, order_id, data.status, data.sheets_consumed)
    resp = CutOrderResponse.model_validate(pattern)
    resp.material_name = pattern.raw_material.name if pattern.raw_material else None
    resp.creator_name = pattern.creator.full_name if pattern.creator else None
    resp.wo_number = pattern.work_order.wo_number if pattern.work_order else None
    return resp


@router.get("/sheet-materials")
async def get_sheet_materials(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    """Get all raw materials with sheet dimensions."""
    from app.models.raw_material import RawMaterial
    materials = (
        db.query(RawMaterial)
        .filter(
            RawMaterial.is_active.is_(True),
            RawMaterial.sheet_length.isnot(None),
            RawMaterial.sheet_width.isnot(None),
        )
        .all()
    )
    return [
        {
            "id": m.id,
            "name": m.name,
            "sku": m.sku,
            "sheet_length_mm": int(float(m.sheet_length)),
            "sheet_width_mm": int(float(m.sheet_width)),
            "thickness": float(m.thickness) if m.thickness else None,
            "unit": m.unit.value,
            "current_stock": float(m.current_stock),
            "last_purchase_rate": float(m.last_purchase_rate),
        }
        for m in materials
    ]
