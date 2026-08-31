import math
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.exceptions import BadRequestError
from app.models.user import User
from app.schemas.cutlist import (
    CutJobCreate,
    CutJobListItem,
    CutJobResponse,
    CutJobUpdate,
    CutResultResponse,
    MaterialResponse,
)
from app.services import cutlist_ocr_service, cutlist_service
from app.services.cutlist_pdf_service import generate_pdf

from app.schemas.cutlist_quick import QuickCalculateRequest, QuickCalculateResponse

router = APIRouter(prefix="/cutlist", tags=["Cutlist Optimizer"])


# ── Quick Calculate (no save) ─────────────────────────────────


@router.post("/calculate", response_model=QuickCalculateResponse)
async def quick_calculate(
    data: QuickCalculateRequest,
    _user: Annotated[User, Depends(require_any)],
):
    """Instant calculate — no save. Supports multiple stock sheet sizes."""
    return cutlist_service.quick_calculate(data.model_dump())


# ── AI Vision: read a photographed cutting list ───────────────


@router.post("/ocr-panels")
async def ocr_panels(
    _user: Annotated[User, Depends(require_any)],
    file: UploadFile = File(...),
):
    """Extract panel rows (label/length/width/quantity) from a photo of a
    handwritten or printed cutting list, via Gemini Vision."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise BadRequestError("Upload an image file")

    contents = await file.read()
    panels = cutlist_ocr_service.extract_panels_from_image(contents, file.content_type)
    return {"panels": panels}


# ── Jobs CRUD ────────────────────────────────────────────────


@router.get("/jobs")
async def list_jobs(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    jobs, total = cutlist_service.list_jobs(db, page, per_page)
    items = []
    for j in jobs:
        item = CutJobListItem.model_validate(j)
        item.material_name = j.material.name if j.material else None
        item.parts_count = len(j.parts)
        items.append(item)
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/jobs", response_model=CutJobResponse, status_code=201)
async def create_job(
    data: CutJobCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
):
    job = cutlist_service.create_job(db, data, user.id)
    resp = CutJobResponse.model_validate(job)
    resp.material_name = job.material.name if job.material else None
    return resp


@router.get("/jobs/{job_id}", response_model=CutJobResponse)
async def get_job(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    job = cutlist_service.get_job(db, job_id)
    resp = CutJobResponse.model_validate(job)
    resp.material_name = job.material.name if job.material else None
    return resp


@router.put("/jobs/{job_id}", response_model=CutJobResponse)
async def update_job(
    job_id: int,
    data: CutJobUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    job = cutlist_service.update_job(db, job_id, data)
    resp = CutJobResponse.model_validate(job)
    resp.material_name = job.material.name if job.material else None
    return resp


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    cutlist_service.delete_job(db, job_id)


# ── Optimization ─────────────────────────────────────────────


@router.post("/jobs/{job_id}/optimize", response_model=CutResultResponse)
async def optimize_job(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    result = cutlist_service.optimize_job(db, job_id)
    return CutResultResponse.model_validate(result)


# ── PDF Export ───────────────────────────────────────────────


@router.get("/jobs/{job_id}/pdf")
async def export_pdf(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    job = cutlist_service.get_job(db, job_id)
    if not job.result:
        from app.exceptions import NotFoundError
        raise NotFoundError("Optimization result not found — run optimization first")

    pdf_bytes = generate_pdf(job)
    filename = f"CutJob-{job.name.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Materials ────────────────────────────────────────────────


@router.get("/materials")
async def list_materials(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    return cutlist_service.list_materials(db)
