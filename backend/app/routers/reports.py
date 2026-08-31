from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.dispatch import Dispatch, DispatchStatus
from app.models.inventory import InventoryMovement
from app.models.production import WastageLog
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.raw_material import RawMaterial
from app.models.user import User
from app.models.work_order import WorkOrder

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/stock-summary")
async def stock_summary(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    materials = db.query(RawMaterial).filter(RawMaterial.is_active == True).order_by(RawMaterial.name).all()
    return [
        {
            "id": m.id,
            "name": m.name,
            "sku": m.sku,
            "unit": m.unit.value,
            "current_stock": float(m.current_stock),
            "reorder_level": float(m.reorder_level),
            "last_purchase_rate": float(m.last_purchase_rate),
            "value": float(m.current_stock * m.last_purchase_rate),
            "below_reorder": m.current_stock <= m.reorder_level,
        }
        for m in materials
    ]


@router.get("/purchase-analytics")
async def purchase_analytics(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    from app.models.vendor import Vendor

    vendor_spend = (
        db.query(
            Vendor.name,
            func.sum(PurchaseOrder.total_amount).label("total_spend"),
            func.count(PurchaseOrder.id).label("po_count"),
        )
        .join(PurchaseOrder, PurchaseOrder.vendor_id == Vendor.id)
        .filter(PurchaseOrder.status.notin_(["DRAFT", "CANCELLED"]))
        .group_by(Vendor.name)
        .order_by(func.sum(PurchaseOrder.total_amount).desc())
        .all()
    )

    return [
        {"vendor": v[0], "total_spend": float(v[1] or 0), "po_count": v[2]}
        for v in vendor_spend
    ]


@router.get("/wastage")
async def wastage_report(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    wastage = (
        db.query(
            RawMaterial.name,
            func.sum(WastageLog.quantity).label("total_wastage"),
            func.count(WastageLog.id).label("incidents"),
        )
        .join(RawMaterial, RawMaterial.id == WastageLog.raw_material_id)
        .group_by(RawMaterial.name)
        .order_by(func.sum(WastageLog.quantity).desc())
        .all()
    )

    return [
        {"material": w[0], "total_wastage": float(w[1] or 0), "incidents": w[2]}
        for w in wastage
    ]


@router.get("/audit-trail")
async def audit_trail(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    material_id: int | None = None,
    movement_type: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    import math

    query = db.query(InventoryMovement)
    if material_id:
        query = query.filter(InventoryMovement.raw_material_id == material_id)
    if movement_type:
        query = query.filter(InventoryMovement.movement_type == movement_type)

    total = query.count()
    movements = (
        query.order_by(InventoryMovement.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for m in movements:
        material = db.query(RawMaterial).filter(RawMaterial.id == m.raw_material_id).first()
        performer = db.query(User).filter(User.id == m.performed_by).first() if m.performed_by else None
        items.append({
            "id": m.id,
            "material_name": material.name if material else None,
            "movement_type": m.movement_type.value if hasattr(m.movement_type, "value") else m.movement_type,
            "quantity": float(m.quantity),
            "qty_before": float(m.qty_before),
            "qty_after": float(m.qty_after),
            "reference_type": m.reference_type,
            "reference_id": m.reference_id,
            "performed_by": performer.full_name if performer else None,
            "notes": m.notes,
            "created_at": m.created_at,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.get("/dispatch-log")
async def dispatch_log(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    dispatches = (
        db.query(Dispatch)
        .order_by(Dispatch.created_at.desc())
        .limit(50)
        .all()
    )
    from app.models.project import Project

    return [
        {
            "id": d.id,
            "dispatch_number": d.dispatch_number,
            "project_name": db.query(Project).filter(Project.id == d.project_id).first().name if d.project_id else None,
            "status": d.status.value if hasattr(d.status, "value") else d.status,
            "driver_name": d.driver_name,
            "vehicle_number": d.vehicle_number,
            "loading_confirmed_at": d.loading_confirmed_at,
            "delivery_confirmed_at": d.delivery_confirmed_at,
            "created_at": d.created_at,
        }
        for d in dispatches
    ]
