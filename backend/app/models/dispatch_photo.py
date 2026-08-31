import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class PhotoCheckpoint(str, enum.Enum):
    FACTORY = "FACTORY"
    SITE = "SITE"


class PhotoUploaderRole(str, enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    DRIVER = "DRIVER"


class DispatchPhoto(Base):
    __tablename__ = "dispatch_photos"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id", ondelete="CASCADE"), index=True, nullable=False)
    dispatch_item_id = Column(Integer, ForeignKey("dispatch_items.id", ondelete="SET NULL"), nullable=True, index=True)
    checkpoint = Column(Enum(PhotoCheckpoint), nullable=False)
    item_reference = Column(String(100), nullable=False)
    storage_url = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)
    captured_at = Column(DateTime(timezone=True), nullable=False)
    gps_lat = Column(Numeric(10, 7), nullable=True)
    gps_lng = Column(Numeric(10, 7), nullable=True)
    gps_available = Column(Boolean, default=False, nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_by_role = Column(Enum(PhotoUploaderRole), nullable=False)
    file_size = Column(Integer, nullable=True)
    original_filename = Column(String(300), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    dispatch = relationship("Dispatch", back_populates="photos")
    dispatch_item = relationship("DispatchItem")
    uploader = relationship("User", foreign_keys=[uploaded_by])
