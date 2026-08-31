from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class CompanyProfile(Base, TimestampMixin):
    """Singleton — one row for the whole company. Created on first access."""
    __tablename__ = "company_profile"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(300), nullable=False, default="DecoTrack Interiors")
    tagline = Column(String(300), nullable=True)
    gstin = Column(String(20), nullable=True)
    phone = Column(String(20), nullable=True)
    mobile = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    address_line1 = Column(String(300), nullable=True)
    address_line2 = Column(String(300), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)

    # Factory Address
    factory_address_line1 = Column(String(300), nullable=True)
    factory_address_line2 = Column(String(300), nullable=True)
    factory_city = Column(String(100), nullable=True)
    factory_state = Column(String(100), nullable=True)
    factory_pincode = Column(String(10), nullable=True)

    # Bank details (for quotation)
    bank_name = Column(String(200), nullable=True)
    bank_account_name = Column(String(200), nullable=True)
    bank_account_number = Column(String(50), nullable=True)
    bank_ifsc = Column(String(20), nullable=True)
    bank_branch = Column(String(200), nullable=True)

    # Logo (stored as file path)
    logo_path = Column(String(500), nullable=True)

    # Quotation defaults
    default_terms = Column(Text, nullable=True)
    material_specs = Column(Text, nullable=True)  # JSON or multi-line text
    prepared_by = Column(String(200), nullable=True)
    owner_name = Column(String(200), nullable=True)
    owner_phone = Column(String(20), nullable=True)
