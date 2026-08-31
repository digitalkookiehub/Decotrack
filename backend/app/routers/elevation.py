from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.user import User
from app.schemas.elevation import ElevationRequest, ElevationResponse
from app.services import elevation_service

router = APIRouter(prefix="/elevation", tags=["Elevation Drawing"])


@router.get("/templates")
async def get_templates():
    """List available product types with default values."""
    return elevation_service.get_templates()


@router.post("/generate", response_model=ElevationResponse)
async def generate_elevation(
    data: ElevationRequest,
    _user: Annotated[User, Depends(require_any)],
):
    """Generate 2D elevation SVGs + pieces list for a furniture product."""
    return elevation_service.generate_elevation(data.model_dump())
