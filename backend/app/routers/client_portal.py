"""Client Portal — public endpoints for clients to view their project status.

Clients login with phone number + simple PIN.
No internal auth needed — uses a separate token.
"""

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.auth.jwt import create_access_token
from app.database import get_db
from app.models.client import Client
from app.models.dispatch import Dispatch, DispatchStatus
from app.models.project import Project, ProjectStatus
from app.models.quotation import Quotation
from app.models.work_order import WorkOrder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/client-portal", tags=["Client Portal"])


class ClientLoginRequest(BaseModel):
    phone: str


class ClientLoginResponse(BaseModel):
    token: str
    client_id: int
    client_name: str


def _get_client_from_token(token: str, db: Session) -> Client:
    """Verify client portal token."""
    from app.auth.jwt import decode_token
    payload = decode_token(token)
    if not payload or payload.get("type") != "client_portal":
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    client = db.query(Client).filter(Client.id == int(payload["sub"])).first()
    if not client:
        raise HTTPException(status_code=401, detail="Client not found")
    return client


@router.post("/login", response_model=ClientLoginResponse)
async def client_login(
    data: ClientLoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Client login with phone number. No password — phone is the identifier.
    In production, add OTP verification.
    """
    client = db.query(Client).filter(Client.phone == data.phone).first()
    if not client:
        raise HTTPException(status_code=404, detail="No account found with this phone number")

    # Create a client portal token (different type from staff tokens)
    token = create_access_token(
        {"sub": str(client.id), "type": "client_portal"},
        expires_minutes=60 * 24 * 7,  # 7 days
    )

    return {"token": token, "client_id": client.id, "client_name": client.name}


@router.get("/projects")
async def client_projects(
    db: Annotated[Session, Depends(get_db)],
    token: str = Query(...),
):
    """Get all projects for the logged-in client."""
    client = _get_client_from_token(token, db)
    projects = (
        db.query(Project)
        .filter(Project.client_id == client.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return [
        {
            "id": p.id,
            "project_number": p.project_number,
            "name": p.name,
            "status": p.status.value,
            "estimated_cost": float(p.estimated_cost or 0),
            "created_at": str(p.created_at),
        }
        for p in projects
    ]


@router.get("/projects/{project_id}")
async def client_project_detail(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    token: str = Query(...),
):
    """Get project detail with work orders and dispatches."""
    client = _get_client_from_token(token, db)
    project = db.query(Project).filter(Project.id == project_id, Project.client_id == client.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    work_orders = db.query(WorkOrder).filter(WorkOrder.project_id == project_id).all()
    dispatches = db.query(Dispatch).filter(Dispatch.project_id == project_id).all()

    return {
        "id": project.id,
        "project_number": project.project_number,
        "name": project.name,
        "status": project.status.value,
        "estimated_cost": float(project.estimated_cost or 0),
        "created_at": str(project.created_at),
        "work_orders": [
            {"id": wo.id, "wo_number": wo.wo_number, "status": wo.status.value, "created_at": str(wo.created_at)}
            for wo in work_orders
        ],
        "dispatches": [
            {
                "id": d.id, "dispatch_number": d.dispatch_number, "status": d.status.value,
                "vehicle_number": d.vehicle_number, "created_at": str(d.created_at),
            }
            for d in dispatches
        ],
    }


@router.get("/quotations")
async def client_quotations(
    db: Annotated[Session, Depends(get_db)],
    token: str = Query(...),
):
    """Get quotations for the logged-in client."""
    client = _get_client_from_token(token, db)
    quotes = (
        db.query(Quotation)
        .filter(Quotation.client_id == client.id)
        .order_by(Quotation.created_at.desc())
        .all()
    )
    return [
        {
            "id": q.id,
            "quote_number": q.quote_number,
            "project_name": q.project_name,
            "status": q.status.value,
            "grand_total": float(q.grand_total),
            "valid_until": str(q.valid_until) if q.valid_until else None,
            "created_at": str(q.created_at),
        }
        for q in quotes
    ]
