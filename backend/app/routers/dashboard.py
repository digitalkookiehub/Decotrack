from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func, desc, case
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_admin, require_any
from app.models.client import Client
from app.models.cutting import CuttingPattern, JobType as CutJobType, CutOrderStatus
from app.models.dispatch import Dispatch, DispatchStatus
from app.models.grn import GoodsReceivedNote
from app.models.inventory import InventoryMovement
from app.models.production import WastageLog
from app.models.purchase_order import POStatus, PurchaseOrder
from app.models.raw_material import RawMaterial
from app.models.project import Project, ProjectStatus
from app.models.user import User
from app.models.vendor import Vendor
from app.models.work_order import WOStatus, WorkOrder, WorkOrderItem

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/employee")
async def employee_dashboard(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    # Reorder alerts
    reorder_count = (
        db.query(func.count(RawMaterial.id))
        .filter(RawMaterial.is_active == True, RawMaterial.current_stock <= RawMaterial.reorder_level)
        .scalar()
    )

    # Pending approvals
    pending_po = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status == POStatus.PENDING_APPROVAL).scalar()
    pending_wo = db.query(func.count(WorkOrder.id)).filter(WorkOrder.status == WOStatus.PENDING_APPROVAL).scalar()
    pending_dsp = db.query(func.count(Dispatch.id)).filter(Dispatch.status == DispatchStatus.PENDING_APPROVAL).scalar()

    # Active work orders
    active_wos = db.query(func.count(WorkOrder.id)).filter(WorkOrder.status.in_([WOStatus.APPROVED, WOStatus.IN_PROGRESS])).scalar()

    # Active projects
    active_projects = db.query(func.count(Project.id)).filter(Project.status.in_([ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS])).scalar()
    total_projects = db.query(func.count(Project.id)).scalar()

    # Stock summary
    total_materials = db.query(func.count(RawMaterial.id)).filter(RawMaterial.is_active == True).scalar()
    stock_value = db.query(func.sum(RawMaterial.current_stock * RawMaterial.last_purchase_rate)).filter(RawMaterial.is_active == True).scalar() or 0

    # Counts
    total_vendors = db.query(func.count(Vendor.id)).filter(Vendor.is_active == True).scalar()
    total_clients = db.query(func.count(Client.id)).scalar()
    total_pos = db.query(func.count(PurchaseOrder.id)).scalar()
    total_wos = db.query(func.count(WorkOrder.id)).scalar()
    total_dispatches = db.query(func.count(Dispatch.id)).scalar()
    total_grns = db.query(func.count(GoodsReceivedNote.id)).scalar()

    # Recent POs
    recent_pos = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.vendor))
        .order_by(desc(PurchaseOrder.created_at))
        .limit(5)
        .all()
    )

    # Recent WOs
    recent_wos = (
        db.query(WorkOrder)
        .options(joinedload(WorkOrder.project))
        .order_by(desc(WorkOrder.created_at))
        .limit(5)
        .all()
    )

    # Recent movements
    recent_movements = (
        db.query(InventoryMovement)
        .order_by(desc(InventoryMovement.created_at))
        .limit(5)
        .all()
    )

    return {
        "reorder_alerts": reorder_count,
        "pending_approvals": {
            "purchase_orders": pending_po,
            "work_orders": pending_wo,
            "dispatches": pending_dsp,
            "total": pending_po + pending_wo + pending_dsp,
        },
        "active_work_orders": active_wos,
        "active_projects": active_projects,
        "stock_summary": {
            "total_materials": total_materials,
            "total_value": float(stock_value),
        },
        "counts": {
            "projects": total_projects,
            "vendors": total_vendors,
            "clients": total_clients,
            "purchase_orders": total_pos,
            "work_orders": total_wos,
            "dispatches": total_dispatches,
            "grns": total_grns,
        },
        "recent_pos": [
            {
                "id": po.id,
                "po_number": po.po_number,
                "vendor_name": po.vendor.name if po.vendor else None,
                "status": po.status.value,
                "total_amount": float(po.total_amount),
                "created_at": str(po.created_at),
            }
            for po in recent_pos
        ],
        "recent_wos": [
            {
                "id": wo.id,
                "wo_number": wo.wo_number,
                "project_name": wo.project.name if wo.project else None,
                "status": wo.status.value,
                "created_at": str(wo.created_at),
            }
            for wo in recent_wos
        ],
        "recent_movements": [
            {
                "id": m.id,
                "movement_type": m.movement_type.value,
                "quantity": float(m.quantity),
                "created_at": str(m.created_at),
            }
            for m in recent_movements
        ],
    }


@router.get("/admin")
async def admin_dashboard(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
):
    # Pending approvals
    pending_po = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status == POStatus.PENDING_APPROVAL).scalar()
    pending_wo = db.query(func.count(WorkOrder.id)).filter(WorkOrder.status == WOStatus.PENDING_APPROVAL).scalar()
    pending_dsp = db.query(func.count(Dispatch.id)).filter(Dispatch.status == DispatchStatus.PENDING_APPROVAL).scalar()

    # Stock summary
    total_materials = db.query(func.count(RawMaterial.id)).filter(RawMaterial.is_active == True).scalar()
    stock_value = db.query(func.sum(RawMaterial.current_stock * RawMaterial.last_purchase_rate)).filter(RawMaterial.is_active == True).scalar() or 0
    reorder_count = db.query(func.count(RawMaterial.id)).filter(RawMaterial.is_active == True, RawMaterial.current_stock <= RawMaterial.reorder_level).scalar()

    # Project stats
    active_projects = db.query(func.count(Project.id)).filter(Project.status.in_([ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS])).scalar()
    total_projects = db.query(func.count(Project.id)).scalar()

    # WO stats
    active_wos = db.query(func.count(WorkOrder.id)).filter(WorkOrder.status.in_([WOStatus.APPROVED, WOStatus.IN_PROGRESS])).scalar()
    completed_wos = db.query(func.count(WorkOrder.id)).filter(WorkOrder.status == WOStatus.COMPLETED).scalar()

    # Dispatch stats
    in_transit = db.query(func.count(Dispatch.id)).filter(Dispatch.status == DispatchStatus.IN_TRANSIT).scalar()
    delivered = db.query(func.count(Dispatch.id)).filter(Dispatch.status == DispatchStatus.DELIVERED).scalar()

    # Counts
    total_vendors = db.query(func.count(Vendor.id)).filter(Vendor.is_active == True).scalar()
    total_clients = db.query(func.count(Client.id)).scalar()

    return {
        "pending_approvals": {
            "purchase_orders": pending_po,
            "work_orders": pending_wo,
            "dispatches": pending_dsp,
            "total": pending_po + pending_wo + pending_dsp,
        },
        "reorder_alerts": reorder_count,
        "stock_summary": {
            "total_materials": total_materials,
            "total_value": float(stock_value),
        },
        "projects": {
            "active": active_projects,
            "total": total_projects,
        },
        "work_orders": {
            "active": active_wos,
            "completed": completed_wos,
        },
        "dispatches": {
            "in_transit": in_transit,
            "delivered": delivered,
        },
        "counts": {
            "vendors": total_vendors,
            "clients": total_clients,
        },
    }


@router.get("/charts")
async def dashboard_charts(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    """Chart data for dashboard analytics."""
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        dt = now - timedelta(days=30 * i)
        months.append((dt.year, dt.month))

    month_labels = []
    po_amounts = []
    wo_counts = []
    dispatch_counts = []

    for year, month in months:
        label = datetime(year, month, 1).strftime("%b %Y")
        month_labels.append(label)

        # PO total amount per month
        po_sum = db.query(func.coalesce(func.sum(PurchaseOrder.total_amount), 0)).filter(
            extract("year", PurchaseOrder.created_at) == year,
            extract("month", PurchaseOrder.created_at) == month,
        ).scalar()
        po_amounts.append(float(po_sum))

        # WO count per month
        wo_count = db.query(func.count(WorkOrder.id)).filter(
            extract("year", WorkOrder.created_at) == year,
            extract("month", WorkOrder.created_at) == month,
        ).scalar()
        wo_counts.append(wo_count)

        # Dispatch count per month
        dsp_count = db.query(func.count(Dispatch.id)).filter(
            extract("year", Dispatch.created_at) == year,
            extract("month", Dispatch.created_at) == month,
        ).scalar()
        dispatch_counts.append(dsp_count)

    # Project status distribution
    project_statuses = {}
    for s in ProjectStatus:
        c = db.query(func.count(Project.id)).filter(Project.status == s).scalar()
        if c > 0:
            project_statuses[s.value] = c

    # WO status distribution
    wo_statuses = {}
    for s in WOStatus:
        c = db.query(func.count(WorkOrder.id)).filter(WorkOrder.status == s).scalar()
        if c > 0:
            wo_statuses[s.value] = c

    # Top 5 materials by stock value
    top_materials = (
        db.query(
            RawMaterial.name,
            (RawMaterial.current_stock * RawMaterial.last_purchase_rate).label("value"),
        )
        .filter(RawMaterial.is_active.is_(True))
        .order_by(desc("value"))
        .limit(5)
        .all()
    )

    # Cut orders — own vs contract
    own_cuts = db.query(func.count(CuttingPattern.id)).filter(CuttingPattern.job_type == CutJobType.OWN).scalar()
    contract_cuts = db.query(func.count(CuttingPattern.id)).filter(CuttingPattern.job_type == CutJobType.CONTRACT).scalar()

    # Wastage summary
    total_wastage = db.query(func.coalesce(func.sum(WastageLog.quantity), 0)).scalar()

    return {
        "monthly": {
            "labels": month_labels,
            "purchase_amounts": po_amounts,
            "work_orders": wo_counts,
            "dispatches": dispatch_counts,
        },
        "project_statuses": project_statuses,
        "wo_statuses": wo_statuses,
        "top_materials": [{"name": m.name, "value": float(m.value or 0)} for m in top_materials],
        "cut_orders": {"own": own_cuts, "contract": contract_cuts},
        "total_wastage": float(total_wastage),
    }
