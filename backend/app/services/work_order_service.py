import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.exceptions import BadRequestError, NotFoundError
from app.models.approval import EntityType
from app.models.bom import BOMItem
from app.models.dispatch import FGStatus, FinishedGoodInventory
from app.models.finished_product import FinishedProduct
from app.models.production import ProductionStatus, ProductionUnit
from app.models.work_order import WOItemStatus, WOStatus, WorkOrder, WorkOrderItem
from app.schemas.work_order import WOCreate
from app.services import approval_service, inventory_service
from app.services.numbering_service import generate_number
from app.services.product_service import check_material_availability

logger = logging.getLogger(__name__)


def create_wo(db: Session, data: WOCreate, user_id: int) -> WorkOrder:
    wo_number = generate_number(db, "WO", WorkOrder.wo_number, WorkOrder)

    wo = WorkOrder(
        wo_number=wo_number,
        project_id=data.project_id,
        created_by=user_id,
        notes=data.notes,
    )
    db.add(wo)
    db.flush()

    total_cost = Decimal("0")
    for item_data in data.items:
        wo_item = WorkOrderItem(
            wo_id=wo.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
        )
        db.add(wo_item)

        # Calculate estimated material cost from BOM
        bom_items = db.query(BOMItem).filter(BOMItem.product_id == item_data.product_id).all()
        for bom in bom_items:
            material = db.query(FinishedProduct).filter(FinishedProduct.id == item_data.product_id).first()
            from app.models.raw_material import RawMaterial
            raw_mat = db.query(RawMaterial).filter(RawMaterial.id == bom.raw_material_id).first()
            if raw_mat:
                total_cost += bom.quantity_per_unit * item_data.quantity * raw_mat.last_purchase_rate

    wo.estimated_material_cost = total_cost
    db.commit()
    db.refresh(wo)
    logger.info("WO created: %s (estimated cost: %s)", wo.wo_number, total_cost)
    return wo


def get_wos(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    status: str | None = None,
    project_id: int | None = None,
) -> tuple[list[WorkOrder], int]:
    query = db.query(WorkOrder).options(
        joinedload(WorkOrder.project),
        joinedload(WorkOrder.creator),
        joinedload(WorkOrder.items).joinedload(WorkOrderItem.product),
    )
    if status:
        query = query.filter(WorkOrder.status == WOStatus(status))
    if project_id:
        query = query.filter(WorkOrder.project_id == project_id)

    total = query.count()
    wos = (
        query.order_by(WorkOrder.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return wos, total


def get_wo(db: Session, wo_id: int) -> WorkOrder:
    wo = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.project),
            joinedload(WorkOrder.creator),
            joinedload(WorkOrder.approver),
            joinedload(WorkOrder.items).joinedload(WorkOrderItem.product),
        )
        .filter(WorkOrder.id == wo_id)
        .first()
    )
    if not wo:
        raise NotFoundError("Work order")
    return wo


def submit_wo(db: Session, wo_id: int, user_id: int) -> WorkOrder:
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise NotFoundError("Work order")
    if wo.status not in (WOStatus.DRAFT, WOStatus.REJECTED):
        raise BadRequestError("Can only submit DRAFT or REJECTED work orders")

    # Block submission if materials are insufficient
    material_checks = check_wo_materials(db, wo_id)
    short_materials = [m for m in material_checks if not m["sufficient"]]
    if short_materials:
        names = ", ".join(f"{m['material_name']} (need {m['required']}, have {m['available']})" for m in short_materials[:3])
        suffix = f" and {len(short_materials) - 3} more" if len(short_materials) > 3 else ""
        raise BadRequestError(f"Cannot submit — insufficient materials: {names}{suffix}")

    approval_service.submit_for_approval(db, EntityType.WORK_ORDER, wo_id, user_id)
    db.refresh(wo)

    # If auto-approved, run the approval side effects (BOM snapshot, FIFO issue, production units)
    if wo.status == WOStatus.APPROVED:
        _run_approval_side_effects(db, wo_id, wo.approved_by or user_id)

    return wo


def approve_wo(db: Session, wo_id: int, admin_id: int, comments: str | None = None) -> WorkOrder:
    # Approve via approval service (handles race condition)
    approval_service.approve_entity(db, EntityType.WORK_ORDER, wo_id, admin_id, comments)

    # Run side effects
    _run_approval_side_effects(db, wo_id, admin_id)

    return get_wo(db, wo_id)


def _run_approval_side_effects(db: Session, wo_id: int, admin_id: int) -> None:
    """Freeze BOM, issue materials via FIFO, create production units."""
    from app.models.raw_material import RawMaterial

    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        return

    # 1. Freeze BOM snapshot
    wo_items = db.query(WorkOrderItem).filter(WorkOrderItem.wo_id == wo_id).all()
    bom_snapshot = {}
    for wo_item in wo_items:
        bom_items = db.query(BOMItem).filter(BOMItem.product_id == wo_item.product_id).all()
        bom_snapshot[str(wo_item.product_id)] = [
            {
                "raw_material_id": b.raw_material_id,
                "material_name": (db.query(RawMaterial).filter(RawMaterial.id == b.raw_material_id).first() or type("", (), {"name": None})).name,
                "quantity_per_unit": float(b.quantity_per_unit),
            }
            for b in bom_items
        ]
    wo.bom_snapshot = bom_snapshot

    # 2. Issue materials via FIFO
    for wo_item in wo_items:
        bom_items = db.query(BOMItem).filter(BOMItem.product_id == wo_item.product_id).all()
        for bom in bom_items:
            total_needed = bom.quantity_per_unit * wo_item.quantity
            try:
                inventory_service.consume_fifo(
                    db=db,
                    material_id=bom.raw_material_id,
                    quantity=total_needed,
                    reference_type="WORK_ORDER",
                    reference_id=wo_id,
                    user_id=admin_id,
                    wo_id=wo_id,
                )
            except Exception as e:
                logger.warning("FIFO issue failed for material %d: %s", bom.raw_material_id, e)

    # 3. Create production units
    for wo_item in wo_items:
        for unit_num in range(1, wo_item.quantity + 1):
            unit = ProductionUnit(
                wo_item_id=wo_item.id,
                unit_number=unit_num,
                status=ProductionStatus.NOT_STARTED,
            )
            db.add(unit)

    db.commit()
    logger.info("WO #%d side effects complete — BOM frozen, materials issued, %d production units created",
                wo_id, sum(item.quantity for item in wo_items))


def reject_wo(db: Session, wo_id: int, admin_id: int, comments: str | None = None) -> WorkOrder:
    approval_service.reject_entity(db, EntityType.WORK_ORDER, wo_id, admin_id, comments)
    return get_wo(db, wo_id)


def check_wo_materials(db: Session, wo_id: int) -> list[dict]:
    wo = get_wo(db, wo_id)
    all_checks: list[dict] = []

    for wo_item in wo.items:
        checks = check_material_availability(db, wo_item.product_id, wo_item.quantity)
        for check in checks:
            check["product_name"] = wo_item.product.name if wo_item.product else None
        all_checks.extend(checks)

    return all_checks
