import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class QuotationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class Quotation(Base, TimestampMixin):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String(20), unique=True, nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    client_name = Column(String(200), nullable=False)
    client_phone = Column(String(20), nullable=True)
    client_email = Column(String(255), nullable=True)
    client_address = Column(Text, nullable=True)
    project_name = Column(String(200), nullable=True)
    status = Column(Enum(QuotationStatus), nullable=False, default=QuotationStatus.DRAFT)
    valid_until = Column(DateTime(timezone=True), nullable=True)

    # Line items
    items = Column(JSON, nullable=False)  # [{description, pieces_json, material_cost, labor_cost, quantity, total}]

    # Totals
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    tax_percent = Column(Numeric(5, 2), nullable=False, default=18)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0)
    discount_percent = Column(Numeric(5, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(14, 2), nullable=False, default=0)
    grand_total = Column(Numeric(14, 2), nullable=False, default=0)

    terms = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    client = relationship("Client", foreign_keys=[client_id])
    creator = relationship("User", foreign_keys=[created_by])
