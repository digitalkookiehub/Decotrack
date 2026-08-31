import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.user import User
from app.schemas.client import ClientCreate, ClientResponse, ClientUpdate
from app.services import client_service

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("/")
async def list_clients(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    clients, total = client_service.get_clients(db, page, per_page, search)
    return {
        "items": [ClientResponse.model_validate(c) for c in clients],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", response_model=ClientResponse, status_code=201)
async def create_client(
    data: ClientCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return client_service.create_client(db, data)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return client_service.get_client(db, client_id)


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    data: ClientUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return client_service.update_client(db, client_id, data)
