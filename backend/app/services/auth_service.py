import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.config import settings
from app.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.user import RefreshToken, User, UserRole
from app.schemas.auth import (
    AutoApproveSettings,
    RegisterRequest,
    Token,
    UserAdminUpdateRequest,
    UserCreateRequest,
)

logger = logging.getLogger(__name__)


def register_user(db: Session, data: RegisterRequest) -> User:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise ConflictError(f"Email {data.email} already registered")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=UserRole(data.role),
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("User registered: %s (role: %s)", user.email, user.role.value)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


def create_tokens(db: Session, user: User) -> Token:
    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})

    token_record = RefreshToken(
        user_id=user.id,
        token=refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(token_record)
    db.commit()

    return Token(access_token=access, refresh_token=refresh)


def refresh_tokens(db: Session, refresh_token: str) -> Token:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise BadRequestError("Invalid refresh token")

    token_record = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.revoked == False,
    ).first()

    if not token_record:
        raise BadRequestError("Refresh token not found or revoked")

    if token_record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise BadRequestError("Refresh token expired")

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user or not user.is_active:
        raise BadRequestError("User not found or inactive")

    # Revoke old token
    token_record.revoked = True
    db.commit()

    return create_tokens(db, user)


def revoke_refresh_token(db: Session, token: str) -> None:
    token_record = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if token_record:
        token_record.revoked = True
        db.commit()


def change_password(
    db: Session, user: User, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.hashed_password):
        raise BadRequestError("Current password is incorrect")
    if len(new_password) < 8:
        raise BadRequestError("New password must be at least 8 characters")

    user.hashed_password = hash_password(new_password)
    db.commit()
    logger.info("Password changed for user: %s", user.email)


def get_all_users(
    db: Session, page: int = 1, per_page: int = 20
) -> tuple[list[User], int]:
    query = db.query(User)
    total = query.count()
    users = query.offset((page - 1) * per_page).limit(per_page).all()
    return users, total


def create_user_admin(db: Session, data: UserCreateRequest) -> User:
    return register_user(
        db,
        RegisterRequest(
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            phone=data.phone,
            role=data.role,
        ),
    )


def update_user_admin(
    db: Session, user_id: int, data: UserAdminUpdateRequest
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError("User")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "role" and value is not None:
            setattr(user, field, UserRole(value))
        else:
            setattr(user, field, value)

    db.commit()
    db.refresh(user)
    logger.info("User %s updated by admin", user.email)
    return user


def update_auto_approve_settings(
    db: Session, user: User, data: AutoApproveSettings
) -> User:
    if data.auto_approve_po_threshold is not None:
        user.auto_approve_po_threshold = Decimal(str(data.auto_approve_po_threshold))
    if data.auto_approve_wo_threshold is not None:
        user.auto_approve_wo_threshold = Decimal(str(data.auto_approve_wo_threshold))

    db.commit()
    db.refresh(user)
    return user
