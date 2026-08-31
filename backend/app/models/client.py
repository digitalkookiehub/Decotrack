from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    gstin = Column(String(20), nullable=True)
    communication_log = Column(JSON, nullable=True)
    documents = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)

    projects = relationship("Project", back_populates="client")
