import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    RefreshRequest,
    Token,
    UserResponse,
    UserUpdateRequest,
)
from app.schemas.common import MessageResponse
from app.services import auth_service

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    user = auth_service.authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    tokens = auth_service.create_tokens(db, user)
    logger.info("User logged in: %s", user.email)
    return tokens


@router.post("/login/json", response_model=Token)
async def login_json(
    data: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    user = auth_service.authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return auth_service.create_tokens(db, user)


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    data: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[User, Depends(require_admin)],
):
    from app.schemas.auth import RegisterRequest
    reg_data = RegisterRequest(
        email=data.email, password=data.password, full_name=str(data.email).split("@")[0]
    )
    user = auth_service.register_user(db, reg_data)
    return user


@router.post("/refresh", response_model=Token)
async def refresh_token(
    data: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
):
    return auth_service.refresh_tokens(db, data.refresh_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    data: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
):
    auth_service.revoke_refresh_token(db, data.refresh_token)
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: Annotated[User, Depends(get_current_user)],
):
    return user


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/password", response_model=MessageResponse)
async def change_password(
    data: PasswordChangeRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    auth_service.change_password(db, user, data.current_password, data.new_password)
    return MessageResponse(message="Password changed successfully")
