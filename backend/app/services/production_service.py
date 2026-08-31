import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.exceptions import BadRequestError, NotFoundError
from app.models.dispatch import FGStatus, FinishedGoodInventory
from app.models.production import (
    MaterialIssue,
    ProductionStageLog,
    ProductionStatus,
    ProductionUnit,
    StageStatus,
    WastageLog,
)
from app.models.work_order import WOItemStatus, WOStatus, WorkOrder, WorkOrderItem

logger = logging.getLogger(__name__)


def get_production_units(db: Session, wo_id: int) -> list[dict]:
    wo_items = (
        db.query(WorkOrderItem)
        .options(
            joinedload(WorkOrderItem.product),
            joinedload(WorkOrderItem.production_units).joinedload(ProductionUnit.stage_logs),
        )
        .filter(WorkOrderItem.wo_id == wo_id)
        .all()
    )

    result = []
    for wo_item in wo_items:
        for unit in wo_item.production_units:
            result.append({
                "id": unit.id,
                "wo_item_id": unit.wo_item_id,
                "product_name": wo_item.product.name if wo_item.product else None,
                "unit_number": unit.unit_number,
                "total_units": wo_item.quantity,
                "current_stage": unit.current_stage,
                "status": unit.status.value if hasattr(unit.status, "value") else unit.status,
                "started_at": unit.started_at,
                "completed_at": unit.completed_at,
                "stage_logs": [
                    {
                        "id": log.id,
                        "stage_name": log.stage_name,
                        "status": log.status.value if hasattr(log.status, "value") else log.status,
                        "started_at": log.started_at,
                        "completed_at": log.completed_at,
                    }
                    for log in sorted(unit.stage_logs, key=lambda x: x.id)
                ],
            })
    return result


def update_stage(
    db: Session, unit_id: int, stage_name: str, action: str, user_id: int
) -> dict:
    unit = db.query(ProductionUnit).filter(ProductionUnit.id == unit_id).first()
    if not unit:
        raise NotFoundError("Production unit")

    now = datetime.now(timezone.utc)

    if action == "start":
        log = ProductionStageLog(
            production_unit_id=unit.id,
            stage_name=stage_name,
            status=StageStatus.STARTED,
            started_at=now,
        )
        db.add(log)
        unit.current_stage = stage_name
        if unit.status == ProductionStatus.NOT_STARTED:
            unit.status = ProductionStatus.IN_PROGRESS
            unit.started_at = now

            # Mark WO item as in progress
            wo_item = db.query(WorkOrderItem).filter(WorkOrderItem.id == unit.wo_item_id).first()
            if wo_item and wo_item.status == WOItemStatus.PENDING:
                wo_item.status = WOItemStatus.IN_PROGRESS
                wo = db.query(WorkOrder).filter(WorkOrder.id == wo_item.wo_id).first()
                if wo and wo.status == WOStatus.APPROVED:
                    wo.status = WOStatus.IN_PROGRESS

    elif action == "complete":
        log = (
            db.query(ProductionStageLog)
            .filter(
                ProductionStageLog.production_unit_id == unit.id,
                ProductionStageLog.stage_name == stage_name,
                ProductionStageLog.status == StageStatus.STARTED,
            )
            .first()
        )
        if not log:
            raise BadRequestError(f"Stage '{stage_name}' not started yet")

        log.status = StageStatus.COMPLETED
        log.completed_at = now
        log.completed_by = user_id

        # Check if this is the final stage (QC)
        if stage_name.upper() == "QC":
            _complete_unit(db, unit, user_id)
    else:
        raise BadRequestError("Action must be 'start' or 'complete'")

    db.commit()
    logger.info("Unit #%d stage '%s' %s", unit.id, stage_name, action)
    return {"message": f"Stage '{stage_name}' {action}d successfully"}


def _complete_unit(db: Session, unit: ProductionUnit, user_id: int) -> None:
    now = datetime.now(timezone.utc)
    unit.status = ProductionStatus.COMPLETED
    unit.completed_at = now

    wo_item = db.query(WorkOrderItem).filter(WorkOrderItem.id == unit.wo_item_id).first()
    if not wo_item:
        return

    wo_item.completed_count += 1

    # Auto-create finished good inventory
    fg = FinishedGoodInventory(
        product_id=wo_item.product_id,
        project_id=db.query(WorkOrder).filter(WorkOrder.id == wo_item.wo_id).first().project_id,
        wo_id=wo_item.wo_id,
        wo_item_id=wo_item.id,
        quantity=Decimal("1"),
        status=FGStatus.IN_STOCK,
        completed_at=now,
    )
    db.add(fg)
    logger.info("Auto-created FG inventory for product #%d (unit QC complete)", wo_item.product_id)

    # Check if all units of this WO item are done
    if wo_item.completed_count >= wo_item.quantity:
        wo_item.status = WOItemStatus.COMPLETED

        # Check if all WO items are complete
        wo = db.query(WorkOrder).filter(WorkOrder.id == wo_item.wo_id).first()
        if wo:
            all_items = db.query(WorkOrderItem).filter(WorkOrderItem.wo_id == wo.id).all()
            if all(item.status == WOItemStatus.COMPLETED for item in all_items):
                wo.status = WOStatus.COMPLETED
                logger.info("WO %s auto-completed — all items done", wo.wo_number)


def log_wastage(
    db: Session,
    unit_id: int,
    raw_material_id: int,
    quantity: float,
    reason: str,
    stage_name: str | None,
    user_id: int,
) -> WastageLog:
    unit = db.query(ProductionUnit).filter(ProductionUnit.id == unit_id).first()
    if not unit:
        raise NotFoundError("Production unit")

    wo_item = db.query(WorkOrderItem).filter(WorkOrderItem.id == unit.wo_item_id).first()

    wastage = WastageLog(
        production_unit_id=unit_id,
        wo_id=wo_item.wo_id if wo_item else 0,
        raw_material_id=raw_material_id,
        stage_name=stage_name,
        quantity=Decimal(str(quantity)),
        reason=reason,
        logged_by=user_id,
    )
    db.add(wastage)
    db.commit()
    db.refresh(wastage)
    logger.info("Wastage logged: %s qty=%s at stage %s", raw_material_id, quantity, stage_name)
    return wastage


def get_wastage(db: Session, wo_id: int) -> list[dict]:
    logs = (
        db.query(WastageLog)
        .filter(WastageLog.wo_id == wo_id)
        .order_by(WastageLog.created_at.desc())
        .all()
    )
    from app.models.raw_material import RawMaterial
    result = []
    for log in logs:
        material = db.query(RawMaterial).filter(RawMaterial.id == log.raw_material_id).first()
        result.append({
            "id": log.id,
            "raw_material_id": log.raw_material_id,
            "material_name": material.name if material else None,
            "stage_name": log.stage_name,
            "quantity": float(log.quantity),
            "reason": log.reason,
            "created_at": log.created_at,
        })
    return result


def get_active_production(db: Session) -> list[dict]:
    wos = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.project),
            joinedload(WorkOrder.items).joinedload(WorkOrderItem.product),
        )
        .filter(WorkOrder.status.in_([WOStatus.APPROVED, WOStatus.IN_PROGRESS]))
        .order_by(WorkOrder.created_at.desc())
        .all()
    )

    result = []
    for wo in wos:
        total_units = sum(item.quantity for item in wo.items)
        completed_units = sum(item.completed_count for item in wo.items)
        result.append({
            "id": wo.id,
            "wo_number": wo.wo_number,
            "project_name": wo.project.name if wo.project else None,
            "status": wo.status.value,
            "total_units": total_units,
            "completed_units": completed_units,
            "progress": round(completed_units / total_units * 100, 1) if total_units > 0 else 0,
            "items": [
                {
                    "product_name": item.product.name if item.product else None,
                    "quantity": item.quantity,
                    "completed_count": item.completed_count,
                    "status": item.status.value,
                }
                for item in wo.items
            ],
        })
    return result
