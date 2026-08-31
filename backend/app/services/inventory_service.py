import logging
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.exceptions import BadRequestError, InsufficientStockError, NotFoundError
from app.models.inventory import InventoryBatch, InventoryMovement, MovementType
from app.models.production import MaterialIssue
from app.models.raw_material import ItemCategory, MaterialUnit, RawMaterial
from app.schemas.inventory import CategoryCreate, RawMaterialCreate, RawMaterialUpdate

logger = logging.getLogger(__name__)


# ── Categories ─────────────────────────────────────────────────
def create_category(db: Session, data: CategoryCreate) -> ItemCategory:
    cat = ItemCategory(name=data.name, description=data.description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def get_categories(db: Session) -> list[ItemCategory]:
    return db.query(ItemCategory).order_by(ItemCategory.name).all()


def update_category(db: Session, cat_id: int, data: CategoryCreate) -> ItemCategory:
    cat = db.query(ItemCategory).filter(ItemCategory.id == cat_id).first()
    if not cat:
        raise NotFoundError("Category")
    cat.name = data.name
    if data.description is not None:
        cat.description = data.description
    db.commit()
    db.refresh(cat)
    return cat


# ── Raw Materials ──────────────────────────────────────────────
def create_material(db: Session, data: RawMaterialCreate) -> RawMaterial:
    existing = db.query(RawMaterial).filter(RawMaterial.sku == data.sku).first()
    if existing:
        raise BadRequestError(f"SKU {data.sku} already exists")

    material = RawMaterial(
        category_id=data.category_id,
        name=data.name,
        sku=data.sku,
        description=data.description,
        unit=MaterialUnit(data.unit),
        reorder_level=Decimal(str(data.reorder_level)),
        hsn_code=data.hsn_code,
        gst_rate=Decimal(str(data.gst_rate)),
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    logger.info("Material created: %s (%s)", material.name, material.sku)
    return material


def get_materials(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    category_id: int | None = None,
    search: str | None = None,
    active_only: bool = True,
) -> tuple[list[RawMaterial], int]:
    query = db.query(RawMaterial)
    if active_only:
        query = query.filter(RawMaterial.is_active == True)
    if category_id:
        query = query.filter(RawMaterial.category_id == category_id)
    if search:
        query = query.filter(
            RawMaterial.name.ilike(f"%{search}%")
            | RawMaterial.sku.ilike(f"%{search}%")
        )

    total = query.count()
    materials = (
        query.order_by(RawMaterial.name)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return materials, total


def get_material(db: Session, material_id: int) -> RawMaterial:
    material = db.query(RawMaterial).filter(RawMaterial.id == material_id).first()
    if not material:
        raise NotFoundError("Raw material")
    return material


def update_material(
    db: Session, material_id: int, data: RawMaterialUpdate
) -> RawMaterial:
    material = get_material(db, material_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "reorder_level" and value is not None:
            setattr(material, field, Decimal(str(value)))
        elif field == "gst_rate" and value is not None:
            setattr(material, field, Decimal(str(value)))
        else:
            setattr(material, field, value)

    db.commit()
    db.refresh(material)
    return material


# ── Stock & Batches ────────────────────────────────────────────
def get_material_stock(db: Session, material_id: int) -> dict:
    material = get_material(db, material_id)
    batches = (
        db.query(InventoryBatch)
        .filter(
            InventoryBatch.raw_material_id == material_id,
            InventoryBatch.quantity_remaining > 0,
        )
        .order_by(InventoryBatch.received_date.asc())
        .all()
    )
    return {
        "material_id": material.id,
        "name": material.name,
        "current_stock": float(material.current_stock),
        "unit": material.unit.value,
        "batches": batches,
    }


def get_material_movements(
    db: Session, material_id: int, page: int = 1, per_page: int = 20
) -> tuple[list[InventoryMovement], int]:
    query = db.query(InventoryMovement).filter(
        InventoryMovement.raw_material_id == material_id
    )
    total = query.count()
    movements = (
        query.order_by(InventoryMovement.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return movements, total


def adjust_stock(
    db: Session, material_id: int, quantity: float, reason: str, user_id: int
) -> RawMaterial:
    material = get_material(db, material_id)
    qty = Decimal(str(quantity))
    new_stock = material.current_stock + qty

    if new_stock < 0:
        raise InsufficientStockError(
            material.name, abs(qty), material.current_stock
        )

    movement = InventoryMovement(
        raw_material_id=material_id,
        movement_type=MovementType.ADJUSTMENT,
        quantity=qty,
        qty_before=material.current_stock,
        qty_after=new_stock,
        performed_by=user_id,
        notes=reason,
    )
    db.add(movement)
    material.current_stock = new_stock
    db.commit()
    db.refresh(material)
    logger.info(
        "Stock adjusted for %s: %s (reason: %s)", material.name, quantity, reason
    )
    return material


# ── Reorder Alerts ─────────────────────────────────────────────
def get_reorder_alerts(db: Session) -> list[dict]:
    materials = (
        db.query(RawMaterial)
        .filter(
            RawMaterial.is_active == True,
            RawMaterial.current_stock <= RawMaterial.reorder_level,
        )
        .order_by(RawMaterial.name)
        .all()
    )
    return [
        {
            "id": m.id,
            "name": m.name,
            "sku": m.sku,
            "unit": m.unit.value,
            "current_stock": float(m.current_stock),
            "reorder_level": float(m.reorder_level),
            "deficit": float(m.reorder_level - m.current_stock),
            "last_purchase_rate": float(m.last_purchase_rate),
        }
        for m in materials
    ]


# ── FIFO Consumption ──────────────────────────────────────────
def consume_fifo(
    db: Session,
    material_id: int,
    quantity: Decimal,
    reference_type: str,
    reference_id: int,
    user_id: int,
    wo_id: int | None = None,
) -> list[MaterialIssue]:
    material = get_material(db, material_id)

    if material.current_stock < quantity:
        raise InsufficientStockError(
            material.name, quantity, material.current_stock
        )

    batches = (
        db.query(InventoryBatch)
        .filter(
            InventoryBatch.raw_material_id == material_id,
            InventoryBatch.quantity_remaining > 0,
        )
        .order_by(InventoryBatch.received_date.asc())
        .all()
    )

    remaining = quantity
    issues: list[MaterialIssue] = []

    for batch in batches:
        if remaining <= 0:
            break

        issue_qty = min(batch.quantity_remaining, remaining)
        batch.quantity_remaining -= issue_qty
        remaining -= issue_qty

        movement = InventoryMovement(
            raw_material_id=material_id,
            batch_id=batch.id,
            movement_type=MovementType.WO_ISSUE,
            quantity=-issue_qty,
            qty_before=material.current_stock,
            qty_after=material.current_stock - issue_qty,
            reference_type=reference_type,
            reference_id=reference_id,
            performed_by=user_id,
        )
        db.add(movement)
        material.current_stock -= issue_qty

        if wo_id:
            issue = MaterialIssue(
                wo_id=wo_id,
                raw_material_id=material_id,
                batch_id=batch.id,
                quantity_issued=issue_qty,
                issued_by=user_id,
            )
            db.add(issue)
            issues.append(issue)

    db.flush()
    logger.info(
        "FIFO consumed %s of %s for %s #%d",
        quantity, material.name, reference_type, reference_id,
    )
    return issues


# ── Receive Stock ──────────────────────────────────────────────
def receive_stock(
    db: Session,
    material_id: int,
    quantity: Decimal,
    rate: Decimal,
    grn_id: int,
    batch_number: str,
    user_id: int,
) -> InventoryBatch:
    material = get_material(db, material_id)

    batch = InventoryBatch(
        raw_material_id=material_id,
        batch_number=batch_number,
        received_date=date.today(),
        quantity_received=quantity,
        quantity_remaining=quantity,
        purchase_rate=rate,
        grn_id=grn_id,
    )
    db.add(batch)

    movement = InventoryMovement(
        raw_material_id=material_id,
        movement_type=MovementType.GRN_IN,
        quantity=quantity,
        qty_before=material.current_stock,
        qty_after=material.current_stock + quantity,
        reference_type="GRN",
        reference_id=grn_id,
        performed_by=user_id,
    )
    db.add(movement)

    material.current_stock += quantity
    material.last_purchase_rate = rate

    db.flush()
    logger.info(
        "Stock received: %s qty=%s rate=%s GRN#%d",
        material.name, quantity, rate, grn_id,
    )
    return batch
