import math
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, extract
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_any
from app.exceptions import NotFoundError
from app.models.expense import Expense, ExpenseCategory, PaymentMode
from app.models.project import Project
from app.models.user import User
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/expenses", tags=["Expenses"])


class ExpenseCreate(BaseModel):
    expense_date: date
    category: str
    description: str
    amount: float
    payment_mode: str = "CASH"
    reference_number: str | None = None
    vendor_name: str | None = None
    project_id: int | None = None
    work_order_id: int | None = None
    notes: str | None = None
    is_recurring: bool = False


class ExpenseUpdate(BaseModel):
    expense_date: date | None = None
    category: str | None = None
    description: str | None = None
    amount: float | None = None
    payment_mode: str | None = None
    reference_number: str | None = None
    vendor_name: str | None = None
    project_id: int | None = None
    work_order_id: int | None = None
    notes: str | None = None
    is_recurring: bool | None = None


class ExpenseResponse(BaseModel):
    id: int
    expense_date: date
    category: str
    description: str
    amount: float
    payment_mode: str
    reference_number: str | None
    vendor_name: str | None
    project_id: int | None
    project_name: str | None = None
    work_order_id: int | None
    notes: str | None
    is_recurring: bool
    created_by: int
    creator_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


def _expense_to_response(exp: Expense) -> dict:
    return {
        "id": exp.id,
        "expense_date": str(exp.expense_date),
        "category": exp.category.value if hasattr(exp.category, "value") else exp.category,
        "description": exp.description,
        "amount": float(exp.amount),
        "payment_mode": exp.payment_mode.value if hasattr(exp.payment_mode, "value") else exp.payment_mode,
        "reference_number": exp.reference_number,
        "vendor_name": exp.vendor_name,
        "project_id": exp.project_id,
        "project_name": exp.project.name if exp.project else None,
        "work_order_id": exp.work_order_id,
        "notes": exp.notes,
        "is_recurring": exp.is_recurring,
        "created_by": exp.created_by,
        "creator_name": exp.creator.full_name if exp.creator else None,
        "created_at": exp.created_at,
    }


@router.get("/")
async def list_expenses(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category: str | None = None,
    project_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    query = db.query(Expense).options(
        joinedload(Expense.project),
        joinedload(Expense.creator),
    )
    if category:
        query = query.filter(Expense.category == ExpenseCategory(category))
    if project_id:
        query = query.filter(Expense.project_id == project_id)
    if date_from:
        query = query.filter(Expense.expense_date >= date_from)
    if date_to:
        query = query.filter(Expense.expense_date <= date_to)

    total = query.count()
    total_amount = db.query(func.sum(Expense.amount)).filter(
        *([Expense.category == ExpenseCategory(category)] if category else []),
        *([Expense.project_id == project_id] if project_id else []),
        *([Expense.expense_date >= date_from] if date_from else []),
        *([Expense.expense_date <= date_to] if date_to else []),
    ).scalar() or 0

    expenses = (
        query.order_by(Expense.expense_date.desc(), Expense.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "items": [_expense_to_response(e) for e in expenses],
        "total": total,
        "total_amount": float(total_amount),
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 1,
    }


@router.post("/", status_code=201)
async def create_expense(
    data: ExpenseCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    expense = Expense(
        expense_date=data.expense_date,
        category=ExpenseCategory(data.category),
        description=data.description,
        amount=Decimal(str(data.amount)),
        payment_mode=PaymentMode(data.payment_mode),
        reference_number=data.reference_number,
        vendor_name=data.vendor_name,
        project_id=data.project_id,
        work_order_id=data.work_order_id,
        notes=data.notes,
        is_recurring=data.is_recurring,
        created_by=user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    # Update project actual_cost if linked
    if expense.project_id:
        _update_project_actual_cost(db, expense.project_id)

    return _expense_to_response(
        db.query(Expense).options(joinedload(Expense.project), joinedload(Expense.creator))
        .filter(Expense.id == expense.id).first()
    )


@router.get("/{expense_id}")
async def get_expense(
    expense_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    expense = (
        db.query(Expense)
        .options(joinedload(Expense.project), joinedload(Expense.creator))
        .filter(Expense.id == expense_id)
        .first()
    )
    if not expense:
        raise NotFoundError("Expense")
    return _expense_to_response(expense)


@router.put("/{expense_id}")
async def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise NotFoundError("Expense")

    old_project_id = expense.project_id

    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "category" and value:
            setattr(expense, field, ExpenseCategory(value))
        elif field == "payment_mode" and value:
            setattr(expense, field, PaymentMode(value))
        elif field == "amount" and value is not None:
            setattr(expense, field, Decimal(str(value)))
        else:
            setattr(expense, field, value)

    db.commit()

    # Update project costs
    if old_project_id:
        _update_project_actual_cost(db, old_project_id)
    if expense.project_id and expense.project_id != old_project_id:
        _update_project_actual_cost(db, expense.project_id)

    return _expense_to_response(
        db.query(Expense).options(joinedload(Expense.project), joinedload(Expense.creator))
        .filter(Expense.id == expense_id).first()
    )


@router.delete("/{expense_id}", response_model=MessageResponse)
async def delete_expense(
    expense_id: int,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise NotFoundError("Expense")
    project_id = expense.project_id
    db.delete(expense)
    db.commit()
    if project_id:
        _update_project_actual_cost(db, project_id)
    return MessageResponse(message="Expense deleted")


# ── Summary / Reports ──────────────────────────────────────────

@router.get("/summary/by-category")
async def expense_summary_by_category(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    date_from: date | None = None,
    date_to: date | None = None,
):
    query = db.query(
        Expense.category,
        func.sum(Expense.amount).label("total"),
        func.count(Expense.id).label("count"),
    )
    if date_from:
        query = query.filter(Expense.expense_date >= date_from)
    if date_to:
        query = query.filter(Expense.expense_date <= date_to)

    results = query.group_by(Expense.category).order_by(func.sum(Expense.amount).desc()).all()

    return [
        {"category": r[0].value if hasattr(r[0], "value") else r[0], "total": float(r[1]), "count": r[2]}
        for r in results
    ]


@router.get("/summary/by-month")
async def expense_summary_by_month(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
    year: int | None = None,
):
    current_year = year or date.today().year
    results = (
        db.query(
            extract("month", Expense.expense_date).label("month"),
            func.sum(Expense.amount).label("total"),
            func.count(Expense.id).label("count"),
        )
        .filter(extract("year", Expense.expense_date) == current_year)
        .group_by(extract("month", Expense.expense_date))
        .order_by(extract("month", Expense.expense_date))
        .all()
    )

    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [
        {"month": months[int(r[0]) - 1], "month_num": int(r[0]), "total": float(r[1]), "count": r[2]}
        for r in results
    ]


@router.get("/summary/by-project")
async def expense_summary_by_project(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_any)],
):
    results = (
        db.query(
            Project.id,
            Project.project_number,
            Project.name,
            Project.estimated_cost,
            func.sum(Expense.amount).label("total_expenses"),
            func.count(Expense.id).label("expense_count"),
        )
        .join(Expense, Expense.project_id == Project.id)
        .group_by(Project.id, Project.project_number, Project.name, Project.estimated_cost)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    return [
        {
            "project_id": r[0],
            "project_number": r[1],
            "project_name": r[2],
            "estimated_cost": float(r[3] or 0),
            "total_expenses": float(r[4]),
            "expense_count": r[5],
            "profit_margin": float((r[3] or 0) - r[4]),
        }
        for r in results
    ]


def _update_project_actual_cost(db: Session, project_id: int) -> None:
    """Recalculate project actual_cost from all linked expenses + material costs."""
    total_expenses = (
        db.query(func.sum(Expense.amount))
        .filter(Expense.project_id == project_id)
        .scalar()
    ) or Decimal("0")

    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        project.actual_cost = total_expenses
        db.commit()
