from sqlalchemy import Boolean, Column, Integer, String

from app.database import Base
from app.models.base import TimestampMixin


class Driver(Base, TimestampMixin):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    license_number = Column(String(50), nullable=True)
    vehicle_number = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
