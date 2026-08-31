import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.user import User
from app.schemas.product import (
    BOMItemResponse,
    BOMUpdateRequest,
    MaterialCheckItem,
    ProductCategoryCreate,
    ProductCategoryResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from app.services import product_service

router = APIRouter(tags=["Products"])


# ── Product Categories ─────────────────────────────────────────
@router.get("/product-categories", response_model=list[ProductCategoryResponse])
async def list_categories(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return product_service.get_categories(db)


@router.post("/product-categories", response_model=ProductCategoryResponse, status_code=201)
async def create_category(
    data: ProductCategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return product_service.create_category(db, data)


@router.put("/product-categories/{cat_id}", response_model=ProductCategoryResponse)
async def update_category(
    cat_id: int,
    data: ProductCategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return product_service.update_category(db, cat_id, data)


# ── Finished Products ──────────────────────────────────────────
@router.get("/finished-products")
async def list_products(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category_id: int | None = None,
    search: str | None = None,
):
    products, total = product_service.get_products(db, page, per_page, category_id, search)
    items = []
    for p in products:
        items.append(ProductResponse(
            id=p.id, name=p.name, sku=p.sku,
            category_id=p.category_id,
            category_name=p.category.name if p.category else None,
            description=p.description,
            unit=p.unit.value if hasattr(p.unit, "value") else p.unit,
            created_at=p.created_at,
        ))
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/finished-products", response_model=ProductResponse, status_code=201)
async def create_product(
    data: ProductCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    product = product_service.create_product(db, data)
    return ProductResponse(
        id=product.id, name=product.name, sku=product.sku,
        category_id=product.category_id, description=product.description,
        unit=product.unit.value, created_at=product.created_at,
    )


@router.get("/finished-products/{product_id}")
async def get_product(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    product = product_service.get_product(db, product_id)
    bom = product_service.get_bom(db, product_id)
    return {
        "id": product.id,
        "name": product.name,
        "sku": product.sku,
        "category_id": product.category_id,
        "category_name": product.category.name if product.category else None,
        "production_stages": product.category.production_stages if product.category else [],
        "description": product.description,
        "unit": product.unit.value if hasattr(product.unit, "value") else product.unit,
        "created_at": product.created_at,
        "bom": bom,
    }


@router.put("/finished-products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    product = product_service.update_product(db, product_id, data)
    return ProductResponse(
        id=product.id, name=product.name, sku=product.sku,
        category_id=product.category_id, description=product.description,
        unit=product.unit.value, created_at=product.created_at,
    )


@router.get("/finished-products/{product_id}/bom", response_model=list[BOMItemResponse])
async def get_bom(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return product_service.get_bom(db, product_id)


@router.put("/finished-products/{product_id}/bom", response_model=list[BOMItemResponse])
async def update_bom(
    product_id: int,
    data: BOMUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return product_service.update_bom(db, product_id, data.items)


@router.get("/finished-products/{product_id}/material-check", response_model=list[MaterialCheckItem])
async def check_material_availability(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    qty: int = Query(1, ge=1),
):
    return product_service.check_material_availability(db, product_id, qty)
