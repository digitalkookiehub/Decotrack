"""Quotation PDF matching SDM reference format — ReportLab."""

import io
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer, Paragraph, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.models.quotation import Quotation
from app.models.company_profile import CompanyProfile

YELLOW = colors.HexColor("#FFD700")
LIGHT_YELLOW = colors.HexColor("#FFF8DC")
HEADER_BG = colors.HexColor("#FFD700")
BORDER = colors.HexColor("#999999")


def generate_quotation_pdf(quotation: Quotation, profile: CompanyProfile) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=8*mm, bottomMargin=8*mm, leftMargin=10*mm, rightMargin=10*mm)
    styles = getSampleStyleSheet()
    elements = []
    pw = A4[0] - 20*mm  # page width minus margins

    bold_sm = ParagraphStyle("BoldSm", parent=styles["Normal"], fontSize=7, fontName="Helvetica-Bold")
    normal_sm = ParagraphStyle("NormalSm", parent=styles["Normal"], fontSize=7)
    center_bold = ParagraphStyle("CenterBold", parent=styles["Normal"], fontSize=7, fontName="Helvetica-Bold", alignment=1)

    # ── HEADER ──
    # GSTIN row
    gstin_data = [[f"GSTIN: {profile.gstin or ''}", ""]]
    gt = Table(gstin_data, colWidths=[pw * 0.7, pw * 0.3])
    gt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), YELLOW),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(gt)

    # Company name
    elements.append(Spacer(1, 2*mm))
    company_name = Paragraph(f"<b>{profile.company_name or 'Company Name'}</b>", ParagraphStyle("CompName", parent=styles["Title"], fontSize=14, alignment=1))
    elements.append(company_name)

    # Tagline
    if profile.tagline:
        elements.append(Paragraph(f"<i>{profile.tagline}</i>", ParagraphStyle("Tag", parent=styles["Normal"], fontSize=8, alignment=1)))

    # Addresses
    reg_addr = ", ".join(filter(None, [profile.address_line1, profile.address_line2, profile.city, profile.state, profile.pincode]))
    factory_addr = ", ".join(filter(None, [profile.factory_address_line1, profile.factory_address_line2, profile.factory_city, profile.factory_state, profile.factory_pincode]))
    if reg_addr:
        elements.append(Paragraph(f"<b>Registered Office:</b> {reg_addr}", ParagraphStyle("Addr", parent=styles["Normal"], fontSize=6.5, alignment=1)))
    if factory_addr:
        elements.append(Paragraph(f"<b>Factory:</b> {factory_addr}", ParagraphStyle("Addr2", parent=styles["Normal"], fontSize=6.5, alignment=1)))

    # Contact
    contacts = []
    if profile.phone: contacts.append(f"Ph: {profile.phone}")
    if profile.mobile: contacts.append(f"Cell: {profile.mobile}")
    if profile.email: contacts.append(f"Email: {profile.email}")
    if contacts:
        elements.append(Paragraph(" | ".join(contacts), ParagraphStyle("Contact", parent=styles["Normal"], fontSize=6.5, alignment=1)))
    elements.append(Spacer(1, 3*mm))

    # ── CLIENT INFO ROW ──
    notes_text = quotation.notes or ""
    area = ""
    follow_up = ""
    for line in notes_text.split("\n"):
        if line.startswith("Area:"): area = line.replace("Area:", "").strip()
        if line.startswith("Follow up:"): follow_up = line.replace("Follow up:", "").strip()

    client_data = [
        [f"Follow up by: {follow_up}", f"Area: {area}", f"Phone: {quotation.client_phone or ''}"],
        [f"Client's name: {quotation.client_name}", f"Area: {area}", f"Date: {datetime.now().strftime('%d/%m/%Y')}    Bill No: {quotation.quote_number}"],
    ]
    if quotation.project_name:
        client_data.append([f"Description: {quotation.project_name}", "", ""])

    ct = Table(client_data, colWidths=[pw * 0.4, pw * 0.3, pw * 0.3])
    ct.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(ct)
    elements.append(Spacer(1, 2*mm))

    # ── ITEMS TABLE ──
    # Header
    header = ["No.", "Description", "Height in\n(ft)", "Width in\n(ft)", "Depth in\n(ft)", "Sft", "Price / sft\n(amount)", "Amount"]
    col_widths = [pw*0.05, pw*0.35, pw*0.08, pw*0.08, pw*0.08, pw*0.08, pw*0.13, pw*0.15]

    all_rows = [header]
    row_styles = []  # (row_index, is_room_header, is_item)

    # Parse items back into rooms
    rooms: dict[str, list] = {}
    for item in quotation.items:
        desc = item.get("description", "")
        room = "General"
        if desc.startswith("[") and "]" in desc:
            room = desc[1:desc.index("]")]
            desc = desc[desc.index("]") + 2:]

        if room not in rooms:
            rooms[room] = []
        rooms[room].append({**item, "clean_desc": desc})

    item_no = 1
    for room_name, room_items in rooms.items():
        # Room header row
        all_rows.append([f"", f"    {room_name}", "", "", "", "", "", ""])
        row_styles.append(("room", len(all_rows) - 1))

        for item in room_items:
            pieces = item.get("pieces_json", {}) or {}
            h = pieces.get("height_ft", "")
            w = pieces.get("width_ft", "")
            d = pieces.get("depth_ft", "")
            sft = pieces.get("sft", "")
            rate = pieces.get("price_per_sft", "")
            amount = item.get("total", item.get("material_cost", 0))

            # Format description with wrapping
            desc_text = item.get("clean_desc", item.get("description", ""))
            all_rows.append([
                str(item_no), desc_text,
                str(h) if h else "", str(w) if w else "", str(d) if d else "",
                str(sft) if sft else "",
                str(rate) if rate else "",
                f"{float(amount):,.0f}" if amount else "",
            ])
            row_styles.append(("item", len(all_rows) - 1))
            item_no += 1

    # Build table
    t = Table(all_rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), YELLOW),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        # All cells
        ("FONTSIZE", (0, 1), (-1, -1), 7),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("ALIGN", (2, 1), (5, -1), "CENTER"),
        ("ALIGN", (6, 1), (7, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]

    for kind, row_idx in row_styles:
        if kind == "room":
            style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), LIGHT_YELLOW))
            style_cmds.append(("FONTNAME", (0, row_idx), (-1, row_idx), "Helvetica-Bold"))
            style_cmds.append(("SPAN", (1, row_idx), (5, row_idx)))

    t.setStyle(TableStyle(style_cmds))
    elements.append(t)
    elements.append(Spacer(1, 3*mm))

    # ── TOTALS ──
    subtotal = float(quotation.subtotal)
    discount = float(quotation.discount_amount)
    tax = float(quotation.tax_amount)
    transport = 0
    for line in notes_text.split("\n"):
        if line.startswith("Transport:"): transport = float(line.split("₹")[-1].strip() or 0)
        if line.startswith("Discount:"): discount = float(line.split("₹")[-1].strip() or 0)

    grand = float(quotation.grand_total)

    totals_data = [
        ["", "", "", "TOTAL", f"₹{subtotal:,.0f}"],
        ["", "", "", "Final Amount", f"₹{subtotal:,.0f}"],
        ["", "", "", f"Discount", f"₹{discount:,.0f}"],
        ["", "", "", f"GST {float(quotation.tax_percent)}%", f"₹{tax:,.0f}"],
        ["", "", "", "Transportation Fee", f"₹{transport:,.0f}"],
        ["", "", "", "GSFT", ""],
        ["", "", "", "Sub Total", f"₹{grand:,.0f}"],
    ]
    tt = Table(totals_data, colWidths=[pw*0.2, pw*0.2, pw*0.15, pw*0.25, pw*0.2])
    tt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (3, 0), (4, -1), "RIGHT"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("FONTNAME", (4, -1), (4, -1), "Helvetica-Bold"),
        ("FONTSIZE", (4, -1), (4, -1), 10),
        ("LINEABOVE", (3, -1), (4, -1), 1, colors.black),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(tt)

    # ── PAGE 2: TERMS + MATERIALS ──
    elements.append(Spacer(1, 8*mm))

    # Terms
    if profile.default_terms or quotation.terms:
        terms_text = quotation.terms or profile.default_terms or ""
        elements.append(Paragraph("<b>TECHNICAL TERMS</b>", center_bold))
        elements.append(Spacer(1, 2*mm))

        terms_rows = []
        for i, line in enumerate(terms_text.strip().split("\n"), 1):
            line = line.strip()
            if line:
                terms_rows.append([str(i), line])
        if terms_rows:
            terms_t = Table(terms_rows, colWidths=[pw*0.05, pw*0.95])
            terms_t.setStyle(TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("BOX", (0, 0), (-1, -1), 0.3, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#dddddd")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            elements.append(terms_t)

    # Bank details in terms
    if profile.bank_account_name:
        elements.append(Spacer(1, 2*mm))
        bank_text = f"<b>Account Name: {profile.bank_account_name}, Current Account Number</b>"
        if profile.bank_account_number:
            bank_text += f"<br/><b>; {profile.bank_account_number}, IFSC CODE ; {profile.bank_ifsc or ''}, {profile.bank_name or ''}, Branch ; {profile.bank_branch or ''}</b>"
        elements.append(Paragraph(bank_text, ParagraphStyle("Bank", parent=styles["Normal"], fontSize=7)))

    elements.append(Spacer(1, 6*mm))

    # Material Used table
    if profile.material_specs:
        elements.append(Paragraph("<b>MATERIAL USED</b>", center_bold))
        elements.append(Spacer(1, 2*mm))

        mat_rows = [["#", "Material", "Specification"]]
        for i, line in enumerate(profile.material_specs.strip().split("\n"), 1):
            parts = line.split(":", 1) if ":" in line else [line, ""]
            mat_rows.append([str(i), parts[0].strip(), f": {parts[1].strip()}" if len(parts) > 1 else ""])

        mt = Table(mat_rows, colWidths=[pw*0.05, pw*0.40, pw*0.55])
        mt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), YELLOW),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("BOX", (0, 0), (-1, -1), 0.3, BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#dddddd")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
        ]))
        elements.append(mt)

    elements.append(Spacer(1, 6*mm))

    # Footer
    if profile.prepared_by:
        elements.append(Paragraph(f"<b>Prepared By : {profile.prepared_by}</b>", normal_sm))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(f"<b>From {profile.company_name or ''}</b>", ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", alignment=2)))
    if profile.owner_name:
        footer_text = profile.owner_name
        if profile.owner_phone: footer_text += f" {profile.owner_phone}"
        elements.append(Paragraph(f"<b>{footer_text}</b>", ParagraphStyle("Footer2", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", alignment=2)))

    doc.build(elements)
    result = buf.getvalue()
    buf.close()
    return result
