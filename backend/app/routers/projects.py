import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_any
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/")
async def list_projects(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str | None = None,
    search: str | None = None,
):
    projects, total = project_service.get_projects(db, page, per_page, status, search)
    items = []
    for p in projects:
        resp = ProjectResponse(
            id=p.id,
            project_number=p.project_number,
            name=p.name,
            client_id=p.client_id,
            client_name=p.client.name if p.client else None,
            site_address=p.site_address,
            city=p.city,
            status=p.status.value if hasattr(p.status, "value") else p.status,
            estimated_cost=float(p.estimated_cost or 0),
            actual_cost=float(p.actual_cost or 0),
            start_date=p.start_date,
            target_completion_date=p.target_completion_date,
            actual_completion_date=p.actual_completion_date,
            notes=p.notes,
            created_at=p.created_at,
            items_count=len(p.items) if p.items else 0,
        )
        items.append(resp)

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    project = project_service.create_project(db, data, user.id)
    return ProjectResponse(
        id=project.id,
        project_number=project.project_number,
        name=project.name,
        client_id=project.client_id,
        site_address=project.site_address,
        city=project.city,
        status=project.status.value,
        estimated_cost=float(project.estimated_cost or 0),
        actual_cost=float(project.actual_cost or 0),
        start_date=project.start_date,
        target_completion_date=project.target_completion_date,
        actual_completion_date=project.actual_completion_date,
        notes=project.notes,
        created_at=project.created_at,
        items_count=len(project.items),
    )


@router.get("/{project_id}")
async def get_project(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    project = project_service.get_project(db, project_id)
    rooms = project_service.get_project_items_by_room(db, project_id)
    return {
        "id": project.id,
        "project_number": project.project_number,
        "name": project.name,
        "client": {"id": project.client.id, "name": project.client.name} if project.client else None,
        "site_address": project.site_address,
        "city": project.city,
        "status": project.status.value if hasattr(project.status, "value") else project.status,
        "estimated_cost": float(project.estimated_cost or 0),
        "actual_cost": float(project.actual_cost or 0),
        "start_date": str(project.start_date) if project.start_date else None,
        "target_completion_date": str(project.target_completion_date) if project.target_completion_date else None,
        "notes": project.notes,
        "rooms": rooms,
    }


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    project = project_service.update_project(db, project_id, data)
    return ProjectResponse(
        id=project.id,
        project_number=project.project_number,
        name=project.name,
        client_id=project.client_id,
        site_address=project.site_address,
        city=project.city,
        status=project.status.value,
        estimated_cost=float(project.estimated_cost or 0),
        actual_cost=float(project.actual_cost or 0),
        start_date=project.start_date,
        target_completion_date=project.target_completion_date,
        actual_completion_date=project.actual_completion_date,
        notes=project.notes,
        created_at=project.created_at,
    )
