"""Company profile management — singleton settings for the factory."""

import os
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any
from app.models.company_profile import CompanyProfile
from app.models.user import User

router = APIRouter(prefix="/company", tags=["Company Profile"])


def _get_or_create_profile(db: Session) -> CompanyProfile:
    profile = db.query(CompanyProfile).first()
    if not profile:
        profile = CompanyProfile(company_name="DecoTrack Interiors")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


class CompanyProfileUpdate(BaseModel):
    company_name: str | None = None
    tagline: str | None = None
    gstin: str | None = None
    phone: str | None = None
    mobile: str | None = None
    email: str | None = None
    website: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    factory_address_line1: str | None = None
    factory_address_line2: str | None = None
    factory_city: str | None = None
    factory_state: str | None = None
    factory_pincode: str | None = None
    bank_name: str | None = None
    bank_account_name: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_branch: str | None = None
    default_terms: str | None = None
    material_specs: str | None = None
    prepared_by: str | None = None
    owner_name: str | None = None
    owner_phone: str | None = None


@router.get("/profile")
async def get_profile(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    profile = _get_or_create_profile(db)
    return {
        "id": profile.id,
        "company_name": profile.company_name,
        "tagline": profile.tagline,
        "gstin": profile.gstin,
        "phone": profile.phone,
        "mobile": profile.mobile,
        "email": profile.email,
        "website": profile.website,
        "address_line1": profile.address_line1,
        "address_line2": profile.address_line2,
        "city": profile.city,
        "state": profile.state,
        "pincode": profile.pincode,
        "factory_address_line1": profile.factory_address_line1,
        "factory_address_line2": profile.factory_address_line2,
        "factory_city": profile.factory_city,
        "factory_state": profile.factory_state,
        "factory_pincode": profile.factory_pincode,
        "bank_name": profile.bank_name,
        "bank_account_name": profile.bank_account_name,
        "bank_account_number": profile.bank_account_number,
        "bank_ifsc": profile.bank_ifsc,
        "bank_branch": profile.bank_branch,
        "logo_path": profile.logo_path,
        "default_terms": profile.default_terms,
        "material_specs": profile.material_specs,
        "prepared_by": profile.prepared_by,
        "owner_name": profile.owner_name,
        "owner_phone": profile.owner_phone,
    }


@router.put("/profile")
async def update_profile(
    data: CompanyProfileUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    profile = _get_or_create_profile(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return {"message": "Profile updated"}


@router.post("/profile/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_any),
):
    """Upload company logo image."""
    if not file.content_type or not file.content_type.startswith("image/"):
        from app.exceptions import BadRequestError
        raise BadRequestError("Please upload an image file")

    # Save to uploads directory
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "uploads", "logo")
    os.makedirs(uploads_dir, exist_ok=True)

    ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"logo_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(uploads_dir, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    profile = _get_or_create_profile(db)
    profile.logo_path = f"/uploads/logo/{filename}"
    db.commit()

    return {"logo_path": profile.logo_path}
