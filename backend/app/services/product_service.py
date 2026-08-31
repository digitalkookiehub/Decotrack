import logging
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.exceptions import BadRequestError, NotFoundError
from app.models.bom import BOMItem
from app.models.finished_product import FinishedProduct, ProductCategory, ProductUnit
from app.models.raw_material import RawMaterial
from app.schemas.product import BOMItemCreate, ProductCategoryCreate, ProductCreate, ProductUpdate

logger = logging.getLogger(__name__)


# ── Product Categories ─────────────────────────────────────────
def create_category(db: Session, data: ProductCategoryCreate) -> ProductCategory:
    cat = ProductCategory(name=data.name, production_stages=data.production_stages)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def get_categories(db: Session) -> list[ProductCategory]:
    return db.query(ProductCategory).order_by(ProductCategory.name).all()


def update_category(db: Session, cat_id: int, data: ProductCategoryCreate) -> ProductCategory:
    cat = db.query(ProductCategory).filter(ProductCategory.id == cat_id).first()
    if not cat:
        raise NotFoundError("Product category")
    cat.name = data.name
    cat.production_stages = data.production_stages
    db.commit()
    db.refresh(cat)
    return cat


# ── Finished Products ──────────────────────────────────────────
def create_product(db: Session, data: ProductCreate) -> FinishedProduct:
    existing = db.query(FinishedProduct).filter(FinishedProduct.sku == data.sku).first()
    if existing:
        raise BadRequestError(f"SKU {data.sku} already exists")

    product = FinishedProduct(
        name=data.name,
        sku=data.sku,
        category_id=data.category_id,
        description=data.description,
        unit=ProductUnit(data.unit),
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    logger.info("Product created: %s (%s)", product.name, product.sku)
    return product


def get_products(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    category_id: int | None = None,
    search: str | None = None,
) -> tuple[list[FinishedProduct], int]:
    query = db.query(FinishedProduct).options(joinedload(FinishedProduct.category))
    if category_id:
        query = query.filter(FinishedProduct.category_id == category_id)
    if search:
        query = query.filter(
            FinishedProduct.name.ilike(f"%{search}%")
            | FinishedProduct.sku.ilike(f"%{search}%")
        )

    total = query.count()
    products = query.order_by(FinishedProduct.name).offset((page - 1) * per_page).limit(per_page).all()
    return products, total


def get_product(db: Session, product_id: int) -> FinishedProduct:
    product = (
        db.query(FinishedProduct)
        .options(
            joinedload(FinishedProduct.category),
            joinedload(FinishedProduct.bom_items).joinedload(BOMItem.raw_material),
        )
        .filter(FinishedProduct.id == product_id)
        .first()
    )
    if not product:
        raise NotFoundError("Product")
    return product


def update_product(db: Session, product_id: int, data: ProductUpdate) -> FinishedProduct:
    product = db.query(FinishedProduct).filter(FinishedProduct.id == product_id).first()
    if not product:
        raise NotFoundError("Product")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


# ── BOM ────────────────────────────────────────────────────────
def get_bom(db: Session, product_id: int) -> list[dict]:
    items = (
        db.query(BOMItem)
        .options(joinedload(BOMItem.raw_material))
        .filter(BOMItem.product_id == product_id)
        .all()
    )
    return [
        {
            "id": item.id,
            "raw_material_id": item.raw_material_id,
            "material_name": item.raw_material.name if item.raw_material else None,
            "material_sku": item.raw_material.sku if item.raw_material else None,
            "material_unit": item.raw_material.unit.value if item.raw_material else None,
            "quantity_per_unit": float(item.quantity_per_unit),
            "notes": item.notes,
        }
        for item in items
    ]


def update_bom(db: Session, product_id: int, items: list[BOMItemCreate]) -> list[dict]:
    product = db.query(FinishedProduct).filter(FinishedProduct.id == product_id).first()
    if not product:
        raise NotFoundError("Product")

    # Delete existing BOM items
    db.query(BOMItem).filter(BOMItem.product_id == product_id).delete()

    # Create new ones
    for item_data in items:
        bom_item = BOMItem(
            product_id=product_id,
            raw_material_id=item_data.raw_material_id,
            quantity_per_unit=Decimal(str(item_data.quantity_per_unit)),
            notes=item_data.notes,
        )
        db.add(bom_item)

    db.commit()
    logger.info("BOM updated for product #%d with %d items", product_id, len(items))
    return get_bom(db, product_id)


# ── Material Availability Check ────────────────────────────────
def check_material_availability(
    db: Session, product_id: int, quantity: int
) -> list[dict]:
    bom_items = (
        db.query(BOMItem)
        .options(joinedload(BOMItem.raw_material))
        .filter(BOMItem.product_id == product_id)
        .all()
    )

    result = []
    for item in bom_items:
        required = float(item.quantity_per_unit) * quantity
        available = float(item.raw_material.current_stock) if item.raw_material else 0
        deficit = max(0, required - available)
        result.append({
            "material_name": item.raw_material.name if item.raw_material else "Unknown",
            "material_sku": item.raw_material.sku if item.raw_material else "",
            "unit": item.raw_material.unit.value if item.raw_material else "",
            "required": required,
            "available": available,
            "sufficient": available >= required,
            "deficit": deficit,
        })

    return result
