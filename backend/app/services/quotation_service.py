"""Quotation Service — create, manage, and export quotations as PDF."""

import io
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from sqlalchemy.orm import Session

from app.exceptions import BadRequestError, NotFoundError
from app.models.quotation import Quotation, QuotationStatus
from app.models.user import User
from app.schemas.quotation import QuotationCreate, QuotationUpdate
from app.services.numbering_service import generate_number

logger = logging.getLogger(__name__)


def create_quotation(db: Session, data: QuotationCreate, user: User) -> Quotation:
    quote_number = generate_number(db, "QT", Quotation.quote_number, Quotation)

    # Calculate totals
    items_data = []
    subtotal = Decimal("0")
    for item in data.items:
        total = Decimal(str((item.material_cost + item.labor_cost) * item.quantity))
        items_data.append({
            "description": item.description,
            "pieces_json": item.pieces_json,
            "material_cost": item.material_cost,
            "labor_cost": item.labor_cost,
            "quantity": item.quantity,
            "total": float(total),
        })
        subtotal += total

    tax_amount = subtotal * Decimal(str(data.tax_percent)) / 100
    discount_amount = subtotal * Decimal(str(data.discount_percent)) / 100
    grand_total = subtotal + tax_amount - discount_amount

    valid_until = datetime.now(timezone.utc) + timedelta(days=data.valid_days)

    quotation = Quotation(
        quote_number=quote_number,
        client_id=data.client_id,
        client_name=data.client_name,
        client_phone=data.client_phone,
        client_email=data.client_email,
        client_address=data.client_address,
        project_name=data.project_name,
        status=QuotationStatus.DRAFT,
        valid_until=valid_until,
        items=items_data,
        subtotal=subtotal,
        tax_percent=data.tax_percent,
        tax_amount=tax_amount,
        discount_percent=data.discount_percent,
        discount_amount=discount_amount,
        grand_total=grand_total,
        terms=data.terms,
        notes=data.notes,
        created_by=user.id,
    )
    db.add(quotation)
    db.commit()
    db.refresh(quotation)
    logger.info("Quotation %s created for %s", quote_number, data.client_name)
    return quotation


def get_quotation(db: Session, quote_id: int) -> Quotation:
    q = db.query(Quotation).filter(Quotation.id == quote_id).first()
    if not q:
        raise NotFoundError("Quotation")
    return q


def list_quotations(db: Session, page: int = 1, per_page: int = 20) -> tuple[list[Quotation], int]:
    query = db.query(Quotation).order_by(Quotation.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return items, total


def update_quotation(db: Session, quote_id: int, data: QuotationUpdate) -> Quotation:
    q = get_quotation(db, quote_id)
    if q.status not in (QuotationStatus.DRAFT, QuotationStatus.SENT):
        raise BadRequestError("Cannot update accepted/rejected quotation")

    for field, value in data.model_dump(exclude_unset=True, exclude={"items"}).items():
        if value is not None:
            if field == "status":
                setattr(q, field, QuotationStatus(value))
            else:
                setattr(q, field, value)

    if data.items is not None:
        items_data = []
        subtotal = Decimal("0")
        for item in data.items:
            total = Decimal(str((item.material_cost + item.labor_cost) * item.quantity))
            items_data.append({
                "description": item.description, "pieces_json": item.pieces_json,
                "material_cost": item.material_cost, "labor_cost": item.labor_cost,
                "quantity": item.quantity, "total": float(total),
            })
            subtotal += total
        q.items = items_data
        q.subtotal = subtotal
        tp = Decimal(str(data.tax_percent or float(q.tax_percent)))
        dp = Decimal(str(data.discount_percent or float(q.discount_percent)))
        q.tax_amount = subtotal * tp / 100
        q.discount_amount = subtotal * dp / 100
        q.grand_total = subtotal + q.tax_amount - q.discount_amount

    db.commit()
    db.refresh(q)
    return q


def delete_quotation(db: Session, quote_id: int) -> None:
    q = get_quotation(db, quote_id)
    db.delete(q)
    db.commit()


def generate_pdf(quotation: Quotation) -> bytes:
    """Generate professional quotation PDF."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=15*mm, bottomMargin=15*mm, leftMargin=15*mm, rightMargin=15*mm)
    styles = getSampleStyleSheet()
    elements = []

    # Header
    elements.append(Paragraph("QUOTATION", styles["Title"]))
    elements.append(Spacer(1, 3*mm))

    # Quote info
    info = [
        ["Quote #", quotation.quote_number, "Date", datetime.now().strftime("%d/%m/%Y")],
        ["Client", quotation.client_name, "Valid Until", quotation.valid_until.strftime("%d/%m/%Y") if quotation.valid_until else "—"],
        ["Phone", quotation.client_phone or "—", "Project", quotation.project_name or "—"],
    ]
    if quotation.client_address:
        info.append(["Address", quotation.client_address, "", ""])

    t = Table(info, colWidths=[55, 140, 55, 140])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 6*mm))

    # Items table
    items_header = ["#", "Description", "Material (₹)", "Labor (₹)", "Qty", "Total (₹)"]
    items_data = [items_header]
    for i, item in enumerate(quotation.items, 1):
        items_data.append([
            str(i), item["description"],
            f"₹{item['material_cost']:,.2f}", f"₹{item['labor_cost']:,.2f}",
            str(item["quantity"]), f"₹{item['total']:,.2f}",
        ])

    it = Table(items_data, colWidths=[20, 150, 65, 60, 25, 70])
    it.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(it)
    elements.append(Spacer(1, 4*mm))

    # Totals
    totals = [
        ["", "", "", "", "Subtotal", f"₹{float(quotation.subtotal):,.2f}"],
        ["", "", "", "", f"GST ({float(quotation.tax_percent)}%)", f"₹{float(quotation.tax_amount):,.2f}"],
    ]
    if float(quotation.discount_amount) > 0:
        totals.append(["", "", "", "", f"Discount ({float(quotation.discount_percent)}%)", f"-₹{float(quotation.discount_amount):,.2f}"])
    totals.append(["", "", "", "", "GRAND TOTAL", f"₹{float(quotation.grand_total):,.2f}"])

    tt = Table(totals, colWidths=[20, 150, 65, 60, 75, 70])
    tt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (4, -1), (5, -1), "Helvetica-Bold"),
        ("FONTSIZE", (4, -1), (5, -1), 11),
        ("ALIGN", (4, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (4, -1), (-1, -1), 1, colors.black),
        ("TEXTCOLOR", (5, -1), (5, -1), colors.HexColor("#4f46e5")),
    ]))
    elements.append(tt)
    elements.append(Spacer(1, 8*mm))

    # Terms
    if quotation.terms:
        elements.append(Paragraph("<b>Terms & Conditions:</b>", styles["Normal"]))
        for line in quotation.terms.split("\n"):
            elements.append(Paragraph(f"• {line}", styles["Normal"]))
    if quotation.notes:
        elements.append(Spacer(1, 4*mm))
        elements.append(Paragraph(f"<b>Notes:</b> {quotation.notes}", styles["Normal"]))

    # Footer
    elements.append(Spacer(1, 15*mm))
    elements.append(Paragraph("Generated by DecoTrack", styles["Normal"]))

    doc.build(elements)
    result = buf.getvalue()
    buf.close()
    return result
