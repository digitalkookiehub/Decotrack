import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.user import User
from app.schemas.quotation import QuotationCreate, QuotationResponse, QuotationUpdate
from app.services import quotation_service

router = APIRouter(prefix="/quotations", tags=["Quotations"])


@router.get("/")
async def list_quotations(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    items, total = quotation_service.list_quotations(db, page, per_page)
    return {
        "items": [{
            **QuotationResponse.model_validate(q).model_dump(),
            "creator_name": q.creator.full_name if q.creator else None,
        } for q in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", response_model=QuotationResponse, status_code=201)
async def create_quotation(
    data: QuotationCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_any)],
):
    q = quotation_service.create_quotation(db, data, user)
    resp = QuotationResponse.model_validate(q)
    resp.creator_name = user.full_name
    return resp


@router.get("/{quote_id}", response_model=QuotationResponse)
async def get_quotation(
    quote_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    q = quotation_service.get_quotation(db, quote_id)
    resp = QuotationResponse.model_validate(q)
    resp.creator_name = q.creator.full_name if q.creator else None
    return resp


@router.put("/{quote_id}", response_model=QuotationResponse)
async def update_quotation(
    quote_id: int,
    data: QuotationUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    q = quotation_service.update_quotation(db, quote_id, data)
    resp = QuotationResponse.model_validate(q)
    resp.creator_name = q.creator.full_name if q.creator else None
    return resp


@router.delete("/{quote_id}", status_code=204)
async def delete_quotation(
    quote_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    quotation_service.delete_quotation(db, quote_id)


@router.get("/{quote_id}/pdf")
async def download_pdf(
    quote_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    from app.models.company_profile import CompanyProfile
    from app.services.quotation_pdf_v2 import generate_quotation_pdf

    q = quotation_service.get_quotation(db, quote_id)
    profile = db.query(CompanyProfile).first()
    if not profile:
        profile = CompanyProfile(company_name="DecoTrack Interiors")

    pdf_bytes = generate_quotation_pdf(q, profile)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Quote-{q.quote_number}.pdf"'},
    )
