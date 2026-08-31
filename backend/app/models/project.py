import enum

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class ProjectStatus(str, enum.Enum):
    PLANNING = "PLANNING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    ON_HOLD = "ON_HOLD"
    CANCELLED = "CANCELLED"


class ProjectItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PRODUCTION = "IN_PRODUCTION"
    COMPLETED = "COMPLETED"
    DISPATCHED = "DISPATCHED"
    DELIVERED = "DELIVERED"


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_number = Column(String(30), unique=True, index=True, nullable=False)
    name = Column(String(300), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), index=True, nullable=False)
    site_address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.PLANNING, nullable=False)
    estimated_cost = Column(Numeric(14, 2), default=0)
    actual_cost = Column(Numeric(14, 2), default=0)
    start_date = Column(Date, nullable=True)
    target_completion_date = Column(Date, nullable=True)
    actual_completion_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)

    client = relationship("Client", back_populates="projects")
    creator = relationship("User", foreign_keys=[created_by])
    items = relationship("ProjectItem", back_populates="project", cascade="all, delete-orphan")
    work_orders = relationship("WorkOrder", back_populates="project")
    dispatches = relationship("Dispatch", back_populates="project")


class ProjectItem(Base):
    __tablename__ = "project_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    room = Column(String(100), nullable=False)
    product_id = Column(Integer, ForeignKey("finished_products.id"), index=True, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    status = Column(Enum(ProjectItemStatus), default=ProjectItemStatus.PENDING, nullable=False)
    notes = Column(Text, nullable=True)

    project = relationship("Project", back_populates="items")
    product = relationship("FinishedProduct")
