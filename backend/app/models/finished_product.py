import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin


class ProductUnit(str, enum.Enum):
    PCS = "PCS"
    SQM = "SQM"
    SET = "SET"


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    production_stages = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    products = relationship("FinishedProduct", back_populates="category")


class FinishedProduct(Base, TimestampMixin):
    __tablename__ = "finished_products"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("product_categories.id"), index=True, nullable=True)
    name = Column(String(200), nullable=False)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    unit = Column(Enum(ProductUnit), default=ProductUnit.PCS, nullable=False)

    # Product dimensions (feet) — optional, used by cutting calculator
    length = Column(Numeric(10, 2), nullable=True)
    width = Column(Numeric(10, 2), nullable=True)
    height = Column(Numeric(10, 2), nullable=True)
    depth = Column(Numeric(10, 2), nullable=True)

    category = relationship("ProductCategory", back_populates="products")
    bom_items = relationship("BOMItem", back_populates="product", cascade="all, delete-orphan")
