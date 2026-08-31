import logging
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.exceptions import BadRequestError, NotFoundError
from app.models.grn import GRNItem, GoodsReceivedNote, QualityStatus
from app.models.purchase_order import POStatus, PurchaseOrder, PurchaseOrderItem
from app.models.raw_material import RawMaterial
from app.schemas.grn import GRNCreate
from app.services import inventory_service
from app.services.numbering_service import generate_number

logger = logging.getLogger(__name__)


def create_grn(db: Session, data: GRNCreate, user_id: int) -> GoodsReceivedNote:
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == data.po_id).first()
    if not po:
        raise NotFoundError("Purchase order")
    if po.status not in (POStatus.APPROVED, POStatus.SENT_TO_VENDOR, POStatus.PARTIALLY_RECEIVED):
        raise BadRequestError("PO must be approved/sent before receiving goods")

    grn_number = generate_number(db, "GRN", GoodsReceivedNote.grn_number, GoodsReceivedNote)

    grn = GoodsReceivedNote(
        grn_number=grn_number,
        po_id=data.po_id,
        vendor_id=po.vendor_id,
        received_by=user_id,
        received_date=data.received_date,
        notes=data.notes,
    )
    db.add(grn)
    db.flush()

    for item_data in data.items:
        grn_item = GRNItem(
            grn_id=grn.id,
            po_item_id=item_data.po_item_id,
            raw_material_id=item_data.raw_material_id,
            ordered_qty=Decimal(str(item_data.received_qty)),
            received_qty=Decimal(str(item_data.received_qty)),
            accepted_qty=Decimal(str(item_data.accepted_qty)),
            rejected_qty=Decimal(str(item_data.rejected_qty)),
            quality_status=QualityStatus(item_data.quality_status),
            rejection_reason=item_data.rejection_reason,
            rate=Decimal(str(item_data.rate)),
        )
        db.add(grn_item)
        db.flush()

        # Receive accepted stock into inventory
        if grn_item.accepted_qty > 0:
            batch_number = f"{grn_number}-{grn_item.raw_material_id}"
            inventory_service.receive_stock(
                db=db,
                material_id=grn_item.raw_material_id,
                quantity=grn_item.accepted_qty,
                rate=grn_item.rate,
                grn_id=grn.id,
                batch_number=batch_number,
                user_id=user_id,
            )

        # Update PO item received qty
        po_item = db.query(PurchaseOrderItem).filter(
            PurchaseOrderItem.id == item_data.po_item_id
        ).first()
        if po_item:
            po_item.received_qty = (po_item.received_qty or Decimal("0")) + grn_item.received_qty

    # Update PO status based on receipt completeness
    _update_po_receipt_status(db, po)

    db.commit()
    db.refresh(grn)
    logger.info("GRN created: %s for PO %s", grn.grn_number, po.po_number)
    return grn


def _update_po_receipt_status(db: Session, po: PurchaseOrder) -> None:
    items = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.po_id == po.id).all()
    all_received = all(
        (item.received_qty or 0) >= item.quantity for item in items
    )
    any_received = any((item.received_qty or 0) > 0 for item in items)

    if all_received:
        po.status = POStatus.FULLY_RECEIVED
    elif any_received:
        po.status = POStatus.PARTIALLY_RECEIVED


def get_grns(
    db: Session, page: int = 1, per_page: int = 20, po_id: int | None = None
) -> tuple[list[GoodsReceivedNote], int]:
    query = db.query(GoodsReceivedNote).options(
        joinedload(GoodsReceivedNote.vendor),
        joinedload(GoodsReceivedNote.receiver),
    )
    if po_id:
        query = query.filter(GoodsReceivedNote.po_id == po_id)

    total = query.count()
    grns = (
        query.order_by(GoodsReceivedNote.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return grns, total


def get_grn(db: Session, grn_id: int) -> GoodsReceivedNote:
    grn = (
        db.query(GoodsReceivedNote)
        .options(
            joinedload(GoodsReceivedNote.vendor),
            joinedload(GoodsReceivedNote.receiver),
            joinedload(GoodsReceivedNote.items).joinedload(GRNItem.raw_material),
            joinedload(GoodsReceivedNote.purchase_order),
        )
        .filter(GoodsReceivedNote.id == grn_id)
        .first()
    )
    if not grn:
        raise NotFoundError("GRN")
    return grn
