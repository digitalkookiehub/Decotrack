import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.exceptions import ApprovalConflictError, BadRequestError, NotFoundError
from app.models.approval import ApprovalAction, ApprovalLog, EntityType
from app.models.dispatch import Dispatch, DispatchStatus
from app.models.purchase_order import POStatus, PurchaseOrder
from app.models.user import User, UserRole
from app.models.work_order import WOStatus, WorkOrder

logger = logging.getLogger(__name__)

# Map entity types to their models and status fields
_ENTITY_MAP = {
    EntityType.PURCHASE_ORDER: {
        "model": PurchaseOrder,
        "pending_status": POStatus.PENDING_APPROVAL,
        "approved_status": POStatus.APPROVED,
        "rejected_status": POStatus.REJECTED,
    },
    EntityType.WORK_ORDER: {
        "model": WorkOrder,
        "pending_status": WOStatus.PENDING_APPROVAL,
        "approved_status": WOStatus.APPROVED,
        "rejected_status": WOStatus.REJECTED,
    },
    EntityType.DISPATCH: {
        "model": Dispatch,
        "pending_status": DispatchStatus.PENDING_APPROVAL,
        "approved_status": DispatchStatus.APPROVED,
        "rejected_status": DispatchStatus.REJECTED,
    },
}


def _get_entity_for_update(db: Session, entity_type: EntityType, entity_id: int):
    """Get entity with row-level lock for race condition handling."""
    config = _ENTITY_MAP[entity_type]
    model = config["model"]

    try:
        entity = (
            db.query(model)
            .filter(model.id == entity_id)
            .with_for_update(nowait=True)
            .first()
        )
    except OperationalError:
        raise ApprovalConflictError(entity_type.value, "another admin")

    if not entity:
        raise NotFoundError(entity_type.value)
    return entity, config


def submit_for_approval(
    db: Session, entity_type: EntityType, entity_id: int, user_id: int
) -> None:
    config = _ENTITY_MAP[entity_type]
    model = config["model"]
    entity = db.query(model).filter(model.id == entity_id).first()
    if not entity:
        raise NotFoundError(entity_type.value)

    entity.status = config["pending_status"]
    entity.submitted_at = datetime.now(timezone.utc)

    log = ApprovalLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=ApprovalAction.SUBMITTED,
        performed_by=user_id,
    )
    db.add(log)

    # Check auto-approve
    amount = _get_entity_amount(entity, entity_type)
    auto_admin = check_auto_approve(db, entity_type, amount)
    if auto_admin:
        entity.status = config["approved_status"]
        entity.approved_by = auto_admin.id
        entity.approved_at = datetime.now(timezone.utc)
        auto_log = ApprovalLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=ApprovalAction.AUTO_APPROVED,
            performed_by=auto_admin.id,
            auto_approve_reason=f"Amount {amount} within threshold for {auto_admin.full_name}",
        )
        db.add(auto_log)
        logger.info(
            "%s #%d auto-approved by %s (amount: %s)",
            entity_type.value, entity_id, auto_admin.full_name, amount,
        )

    db.commit()
    logger.info("%s #%d submitted for approval by user #%d", entity_type.value, entity_id, user_id)


def approve_entity(
    db: Session,
    entity_type: EntityType,
    entity_id: int,
    admin_id: int,
    comments: str | None = None,
) -> None:
    entity, config = _get_entity_for_update(db, entity_type, entity_id)

    if entity.status != config["pending_status"]:
        approver_name = "unknown"
        if hasattr(entity, "approved_by") and entity.approved_by:
            admin = db.query(User).filter(User.id == entity.approved_by).first()
            approver_name = admin.full_name if admin else "unknown"
        raise ApprovalConflictError(entity_type.value, approver_name)

    entity.status = config["approved_status"]
    entity.approved_by = admin_id
    entity.approved_at = datetime.now(timezone.utc)

    log = ApprovalLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=ApprovalAction.APPROVED,
        performed_by=admin_id,
        comments=comments,
    )
    db.add(log)
    db.commit()

    admin = db.query(User).filter(User.id == admin_id).first()
    logger.info(
        "%s #%d approved by %s",
        entity_type.value, entity_id, admin.full_name if admin else admin_id,
    )


def reject_entity(
    db: Session,
    entity_type: EntityType,
    entity_id: int,
    admin_id: int,
    comments: str | None = None,
) -> None:
    if not comments:
        raise BadRequestError("Rejection reason is required")

    entity, config = _get_entity_for_update(db, entity_type, entity_id)

    if entity.status != config["pending_status"]:
        approver_name = "unknown"
        if hasattr(entity, "approved_by") and entity.approved_by:
            admin = db.query(User).filter(User.id == entity.approved_by).first()
            approver_name = admin.full_name if admin else "unknown"
        raise ApprovalConflictError(entity_type.value, approver_name)

    entity.status = config["rejected_status"]
    entity.rejection_reason = comments
    entity.rejection_count = (entity.rejection_count or 0) + 1

    log = ApprovalLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=ApprovalAction.REJECTED,
        performed_by=admin_id,
        comments=comments,
    )
    db.add(log)
    db.commit()

    admin = db.query(User).filter(User.id == admin_id).first()
    logger.info(
        "%s #%d rejected by %s: %s",
        entity_type.value, entity_id, admin.full_name if admin else admin_id, comments,
    )


def check_auto_approve(
    db: Session, entity_type: EntityType, amount: Decimal | None
) -> User | None:
    if amount is None:
        return None

    admins = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == True).all()
    for admin in admins:
        if entity_type == EntityType.PURCHASE_ORDER and admin.auto_approve_po_threshold:
            if amount <= admin.auto_approve_po_threshold:
                return admin
        elif entity_type == EntityType.WORK_ORDER and admin.auto_approve_wo_threshold:
            if amount <= admin.auto_approve_wo_threshold:
                return admin
    return None


def get_approval_history(
    db: Session, entity_type: EntityType, entity_id: int
) -> list[dict]:
    logs = (
        db.query(ApprovalLog)
        .filter(
            ApprovalLog.entity_type == entity_type,
            ApprovalLog.entity_id == entity_id,
        )
        .order_by(ApprovalLog.created_at.asc())
        .all()
    )

    result = []
    for log in logs:
        performer = db.query(User).filter(User.id == log.performed_by).first()
        result.append({
            "id": log.id,
            "entity_type": log.entity_type.value,
            "entity_id": log.entity_id,
            "action": log.action.value,
            "performed_by": log.performed_by,
            "performer_name": performer.full_name if performer else None,
            "comments": log.comments,
            "auto_approve_reason": log.auto_approve_reason,
            "created_at": log.created_at,
        })
    return result


def get_pending_approvals(db: Session, page: int = 1, per_page: int = 20) -> list[dict]:
    pending: list[dict] = []

    # POs
    pos = db.query(PurchaseOrder).filter(PurchaseOrder.status == POStatus.PENDING_APPROVAL).all()
    for po in pos:
        pending.append({
            "type": "PURCHASE_ORDER",
            "id": po.id,
            "number": po.po_number,
            "amount": float(po.total_amount),
            "submitted_at": po.submitted_at,
            "details": f"PO {po.po_number} — ₹{po.total_amount:,.2f}",
        })

    # WOs
    wos = db.query(WorkOrder).filter(WorkOrder.status == WOStatus.PENDING_APPROVAL).all()
    for wo in wos:
        pending.append({
            "type": "WORK_ORDER",
            "id": wo.id,
            "number": wo.wo_number,
            "amount": float(wo.estimated_material_cost or 0),
            "submitted_at": wo.submitted_at,
            "details": f"WO {wo.wo_number} — ₹{wo.estimated_material_cost or 0:,.2f}",
        })

    # Dispatches
    dispatches = db.query(Dispatch).filter(Dispatch.status == DispatchStatus.PENDING_APPROVAL).all()
    for d in dispatches:
        pending.append({
            "type": "DISPATCH",
            "id": d.id,
            "number": d.dispatch_number,
            "amount": 0,
            "submitted_at": d.submitted_at,
            "details": f"DSP {d.dispatch_number}",
        })

    pending.sort(key=lambda x: x["submitted_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    total = len(pending)
    start = (page - 1) * per_page
    return pending[start : start + per_page], total


def _get_entity_amount(entity, entity_type: EntityType) -> Decimal | None:
    if entity_type == EntityType.PURCHASE_ORDER:
        return entity.total_amount
    elif entity_type == EntityType.WORK_ORDER:
        return entity.estimated_material_cost
    return None
