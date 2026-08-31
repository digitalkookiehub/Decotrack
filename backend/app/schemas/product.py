from datetime import datetime

from pydantic import BaseModel


class ProductCategoryCreate(BaseModel):
    name: str
    production_stages: list[str] = []


class ProductCategoryResponse(BaseModel):
    id: int
    name: str
    production_stages: list[str] | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str
    sku: str
    category_id: int | None = None
    description: str | None = None
    unit: str = "PCS"
    length: float | None = None
    width: float | None = None
    height: float | None = None
    depth: float | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    category_id: int | None = None
    description: str | None = None
    length: float | None = None
    width: float | None = None
    height: float | None = None
    depth: float | None = None


class ProductResponse(BaseModel):
    id: int
    name: str
    sku: str
    category_id: int | None
    category_name: str | None = None
    description: str | None
    unit: str
    length: float | None = None
    width: float | None = None
    height: float | None = None
    depth: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BOMItemCreate(BaseModel):
    raw_material_id: int
    quantity_per_unit: float
    notes: str | None = None


class BOMItemResponse(BaseModel):
    id: int
    raw_material_id: int
    material_name: str | None = None
    material_sku: str | None = None
    material_unit: str | None = None
    quantity_per_unit: float
    notes: str | None

    model_config = {"from_attributes": True}


class BOMUpdateRequest(BaseModel):
    items: list[BOMItemCreate]


class MaterialCheckItem(BaseModel):
    material_name: str
    material_sku: str
    unit: str
    required: float
    available: float
    sufficient: bool
    deficit: float
