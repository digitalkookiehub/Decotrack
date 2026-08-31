from sqlalchemy import Boolean, Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class Vendor(Base, TimestampMixin):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    gstin = Column(String(20), nullable=True)
    supply_categories = Column(JSON, nullable=True)
    payment_terms = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    purchase_orders = relationship("PurchaseOrder", back_populates="vendor")
    grns = relationship("GoodsReceivedNote", back_populates="vendor")
