import logging
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.exceptions import NotFoundError
from app.models.client import Client
from app.models.project import Project, ProjectItem, ProjectStatus
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services.numbering_service import generate_client_scoped_number

logger = logging.getLogger(__name__)


def create_project(db: Session, data: ProjectCreate, user_id: int) -> Project:
    client = db.query(Client).filter(Client.id == data.client_id).first()
    if not client:
        raise NotFoundError("Client")

    project_number = generate_client_scoped_number(db, client.name, Project.project_number, Project)

    project = Project(
        project_number=project_number,
        name=data.name,
        client_id=data.client_id,
        site_address=data.site_address,
        city=data.city,
        estimated_cost=Decimal(str(data.estimated_cost)),
        start_date=data.start_date,
        target_completion_date=data.target_completion_date,
        notes=data.notes,
        created_by=user_id,
    )
    db.add(project)
    db.flush()

    for item_data in data.items:
        item = ProjectItem(
            project_id=project.id,
            room=item_data.room,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            notes=item_data.notes,
        )
        db.add(item)

    db.commit()
    db.refresh(project)
    logger.info("Project created: %s (%s)", project.name, project.project_number)
    return project


def get_projects(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Project], int]:
    query = db.query(Project).options(joinedload(Project.client))
    if status:
        query = query.filter(Project.status == ProjectStatus(status))
    if search:
        query = query.filter(Project.name.ilike(f"%{search}%"))

    total = query.count()
    projects = (
        query.order_by(Project.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return projects, total


def get_project(db: Session, project_id: int) -> Project:
    project = (
        db.query(Project)
        .options(
            joinedload(Project.client),
            joinedload(Project.items).joinedload(ProjectItem.product),
        )
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise NotFoundError("Project")
    return project


def update_project(db: Session, project_id: int, data: ProjectUpdate) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise NotFoundError("Project")

    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "status" and value:
            setattr(project, field, ProjectStatus(value))
        elif field == "estimated_cost" and value is not None:
            setattr(project, field, Decimal(str(value)))
        else:
            setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


def get_project_items_by_room(db: Session, project_id: int) -> dict[str, list]:
    project = get_project(db, project_id)
    rooms: dict[str, list] = {}
    for item in project.items:
        room = item.room
        if room not in rooms:
            rooms[room] = []
        rooms[room].append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else None,
            "quantity": item.quantity,
            "status": item.status.value if hasattr(item.status, "value") else item.status,
            "notes": item.notes,
        })
    return rooms
