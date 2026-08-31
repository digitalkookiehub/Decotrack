import logging
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.exceptions import BadRequestError, NotFoundError
from app.models.approval import EntityType
from app.models.purchase_order import POStatus, PurchaseOrder, PurchaseOrderItem
from app.models.raw_material import RawMaterial
from app.schemas.purchase_order import POCreate, POUpdate
from app.services import approval_service
from app.services.numbering_service import generate_number

logger = logging.getLogger(__name__)


def create_po(db: Session, data: POCreate, user_id: int) -> PurchaseOrder:
    po_number = generate_number(db, "PO", PurchaseOrder.po_number, PurchaseOrder)

    po = PurchaseOrder(
        po_number=po_number,
        vendor_id=data.vendor_id,
        created_by=user_id,
        notes=data.notes,
    )
    db.add(po)
    db.flush()

    total = Decimal("0")
    for item_data in data.items:
        material = db.query(RawMaterial).filter(RawMaterial.id == item_data.raw_material_id).first()
        qty = Decimal(str(item_data.quantity))
        rate = Decimal(str(item_data.rate))
        amount = qty * rate

        po_item = PurchaseOrderItem(
            po_id=po.id,
            raw_material_id=item_data.raw_material_id,
            quantity=qty,
            rate=rate,
            amount=amount,
            last_purchase_rate=material.last_purchase_rate if material else Decimal("0"),
            current_stock=material.current_stock if material else Decimal("0"),
        )
        db.add(po_item)
        total += amount

    po.total_amount = total
    db.commit()
    db.refresh(po)
    logger.info("PO created: %s (total: %s)", po.po_number, total)
    return po


def get_pos(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    status: str | None = None,
    vendor_id: int | None = None,
) -> tuple[list[PurchaseOrder], int]:
    query = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor),
        joinedload(PurchaseOrder.creator),
    )
    if status:
        query = query.filter(PurchaseOrder.status == POStatus(status))
    if vendor_id:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)

    total = query.count()
    pos = (
        query.order_by(PurchaseOrder.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return pos, total


def get_po(db: Session, po_id: int) -> PurchaseOrder:
    po = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.vendor),
            joinedload(PurchaseOrder.creator),
            joinedload(PurchaseOrder.approver),
            joinedload(PurchaseOrder.items).joinedload(PurchaseOrderItem.raw_material),
        )
        .filter(PurchaseOrder.id == po_id)
        .first()
    )
    if not po:
        raise NotFoundError("Purchase order")
    return po


def update_po(db: Session, po_id: int, data: POUpdate) -> PurchaseOrder:
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise NotFoundError("Purchase order")
    if po.status not in (POStatus.DRAFT, POStatus.REJECTED):
        raise BadRequestError("Can only edit DRAFT or REJECTED purchase orders")

    if data.vendor_id is not None:
        po.vendor_id = data.vendor_id
    if data.notes is not None:
        po.notes = data.notes

    if data.items is not None:
        # Replace items
        db.query(PurchaseOrderItem).filter(PurchaseOrderItem.po_id == po_id).delete()
        total = Decimal("0")
        for item_data in data.items:
            material = db.query(RawMaterial).filter(RawMaterial.id == item_data.raw_material_id).first()
            qty = Decimal(str(item_data.quantity))
            rate = Decimal(str(item_data.rate))
            amount = qty * rate
            po_item = PurchaseOrderItem(
                po_id=po.id,
                raw_material_id=item_data.raw_material_id,
                quantity=qty, rate=rate, amount=amount,
                last_purchase_rate=material.last_purchase_rate if material else Decimal("0"),
                current_stock=material.current_stock if material else Decimal("0"),
            )
            db.add(po_item)
            total += amount
        po.total_amount = total

    db.commit()
    db.refresh(po)
    return po


def submit_po(db: Session, po_id: int, user_id: int) -> PurchaseOrder:
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise NotFoundError("Purchase order")
    if po.status not in (POStatus.DRAFT, POStatus.REJECTED):
        raise BadRequestError("Can only submit DRAFT or REJECTED purchase orders")

    approval_service.submit_for_approval(db, EntityType.PURCHASE_ORDER, po_id, user_id)
    db.refresh(po)
    return po


def approve_po(db: Session, po_id: int, admin_id: int, comments: str | None = None) -> PurchaseOrder:
    approval_service.approve_entity(db, EntityType.PURCHASE_ORDER, po_id, admin_id, comments)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    return po


def reject_po(db: Session, po_id: int, admin_id: int, comments: str | None = None) -> PurchaseOrder:
    approval_service.reject_entity(db, EntityType.PURCHASE_ORDER, po_id, admin_id, comments)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    return po


def resubmit_po(db: Session, po_id: int, user_id: int) -> PurchaseOrder:
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise NotFoundError("Purchase order")
    if po.status != POStatus.REJECTED:
        raise BadRequestError("Can only resubmit REJECTED purchase orders")

    from app.models.approval import ApprovalAction, ApprovalLog
    log = ApprovalLog(
        entity_type=EntityType.PURCHASE_ORDER,
        entity_id=po_id,
        action=ApprovalAction.RESUBMITTED,
        performed_by=user_id,
    )
    db.add(log)

    approval_service.submit_for_approval(db, EntityType.PURCHASE_ORDER, po_id, user_id)
    db.refresh(po)
    return po


def mark_sent(db: Session, po_id: int) -> PurchaseOrder:
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise NotFoundError("Purchase order")
    if po.status != POStatus.APPROVED:
        raise BadRequestError("Can only mark APPROVED orders as sent")

    po.status = POStatus.SENT_TO_VENDOR
    db.commit()
    db.refresh(po)
    logger.info("PO %s marked as sent to vendor", po.po_number)
    return po
