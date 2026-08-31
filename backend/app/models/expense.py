import enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin


class ExpenseCategory(str, enum.Enum):
    ELECTRICITY = "ELECTRICITY"
    RENT = "RENT"
    LABOUR_WAGES = "LABOUR_WAGES"
    TRANSPORT = "TRANSPORT"
    FUEL = "FUEL"
    MACHINE_MAINTENANCE = "MACHINE_MAINTENANCE"
    TOOLS = "TOOLS"
    CONSUMABLES = "CONSUMABLES"
    PACKAGING = "PACKAGING"
    FOOD_REFRESHMENTS = "FOOD_REFRESHMENTS"
    TELEPHONE_INTERNET = "TELEPHONE_INTERNET"
    INSURANCE = "INSURANCE"
    TAXES_FEES = "TAXES_FEES"
    SITE_INSTALLATION = "SITE_INSTALLATION"
    MISCELLANEOUS = "MISCELLANEOUS"


class PaymentMode(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    BANK_TRANSFER = "BANK_TRANSFER"
    CHEQUE = "CHEQUE"
    CREDIT_CARD = "CREDIT_CARD"


class Expense(Base, TimestampMixin):
    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_date", "expense_date"),
        Index("ix_expenses_category", "category"),
        Index("ix_expenses_project", "project_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    expense_date = Column(Date, nullable=False)
    category = Column(Enum(ExpenseCategory), nullable=False)
    description = Column(String(300), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_mode = Column(Enum(PaymentMode), default=PaymentMode.CASH, nullable=False)
    reference_number = Column(String(100), nullable=True)  # bill/receipt number
    vendor_name = Column(String(200), nullable=True)  # who was paid
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    receipt_url = Column(String(500), nullable=True)  # photo of receipt
    created_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    is_recurring = Column(Boolean, default=False, nullable=False)

    project = relationship("Project", foreign_keys=[project_id])
    work_order = relationship("WorkOrder", foreign_keys=[work_order_id])
    creator = relationship("User", foreign_keys=[created_by])
