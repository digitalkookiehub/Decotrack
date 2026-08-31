from sqlalchemy import Column, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class BOMItem(Base):
    __tablename__ = "bom_items"
    __table_args__ = (
        UniqueConstraint("product_id", "raw_material_id", name="uq_bom_product_material"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("finished_products.id", ondelete="CASCADE"), index=True, nullable=False)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"), index=True, nullable=False)
    quantity_per_unit = Column(Numeric(10, 4), nullable=False)
    notes = Column(String(200), nullable=True)

    product = relationship("FinishedProduct", back_populates="bom_items")
    raw_material = relationship("RawMaterial", back_populates="bom_items")
