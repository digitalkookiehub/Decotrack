"""PDF export for cutlist optimizer using ReportLab."""

import io
import logging
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.graphics.shapes import Drawing, Rect, String, Group
from reportlab.graphics import renderPDF

from app.models.cutlist import CutJob

logger = logging.getLogger(__name__)

# Colors matching SVG
PART_COLORS = [
    colors.HexColor("#dbeafe"), colors.HexColor("#fce7f3"),
    colors.HexColor("#fef3c7"), colors.HexColor("#d1fae5"),
    colors.HexColor("#e0e7ff"), colors.HexColor("#ede9fe"),
    colors.HexColor("#fee2e2"), colors.HexColor("#ccfbf1"),
]
PART_BORDERS = [
    colors.HexColor("#3b82f6"), colors.HexColor("#ec4899"),
    colors.HexColor("#f59e0b"), colors.HexColor("#10b981"),
    colors.HexColor("#6366f1"), colors.HexColor("#8b5cf6"),
    colors.HexColor("#ef4444"), colors.HexColor("#14b8a6"),
]


def generate_pdf(job: CutJob) -> bytes:
    """Generate a PDF with summary page + per-sheet cutting diagrams."""
    if not job.result:
        return b""

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=16, spaceAfter=6)
    normal = styles["Normal"]

    elements: list = []

    # ── Page 1: Summary ──
    elements.append(Paragraph(f"Cut Job: {job.name}", title_style))
    elements.append(Spacer(1, 4 * mm))

    # Job info table
    mat_name = job.material.name if job.material else "—"
    info_data = [
        ["Material", mat_name, "Date", datetime.now().strftime("%d/%m/%Y")],
        ["Sheet Size", f"{float(job.sheet_width)} x {float(job.sheet_height)} {job.units.value}",
         "Blade Kerf", f"{float(job.blade_kerf)} {job.kerf_unit.value}"],
        ["Orientation", job.cut_orientation.value.replace("_", " "),
         "Method", job.cutting_method.value],
        ["Priority", job.optimization_priority.value.replace("_", " "),
         "Status", job.status.value],
    ]
    info_table = Table(info_data, colWidths=[70, 140, 70, 140])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 6 * mm))

    # Parts table
    elements.append(Paragraph("Parts List", styles["Heading3"]))
    parts_header = ["#", "Label", "Length", "Width", "Qty", "Grain", "Edge Banding"]
    parts_data = [parts_header]
    for i, part in enumerate(job.parts, 1):
        eb_sides = []
        if part.edge_banding_l1: eb_sides.append("L1")
        if part.edge_banding_l2: eb_sides.append("L2")
        if part.edge_banding_w1: eb_sides.append("W1")
        if part.edge_banding_w2: eb_sides.append("W2")
        eb_str = ", ".join(eb_sides) if eb_sides else "—"
        grain_str = "Locked" if part.grain_locked else "Free"
        parts_data.append([
            str(i), part.label, f"{float(part.length)}", f"{float(part.width)}",
            str(part.quantity), grain_str, eb_str,
        ])

    parts_table = Table(parts_data, colWidths=[25, 80, 55, 55, 30, 45, 80])
    parts_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(parts_table)
    elements.append(Spacer(1, 8 * mm))

    # Summary box
    result = job.result
    elements.append(Paragraph("Optimization Results", styles["Heading3"]))
    summary_data = [
        ["Sheets Used", str(result.sheets_used),
         "Efficiency", f"{float(result.material_efficiency_percentage)}%"],
        ["Waste Area", f"{float(result.waste_area):.1f} mm\u00b2",
         "Waste %", f"{float(result.waste_percentage)}%"],
        ["Total Cost", f"\u20b9{float(result.total_cost):,.2f}",
         "", ""],
    ]
    summary_table = Table(summary_data, colWidths=[70, 100, 70, 100])
    summary_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#4f46e5")),
        ("FONTSIZE", (1, 0), (1, -1), 11),
        ("FONTSIZE", (3, 0), (3, -1), 11),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#6366f1")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eef2ff")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)

    # ── Pages 2+: Sheet diagrams ──
    placements = result.placements_json
    sheets_used = result.sheets_used
    sw = float(job.sheet_width)
    sh = float(job.sheet_height)

    # Build color map
    part_ids = sorted({p["part_id"] for p in placements})
    color_map = {}
    for i, pid in enumerate(part_ids):
        color_map[pid] = (PART_COLORS[i % len(PART_COLORS)], PART_BORDERS[i % len(PART_BORDERS)])

    for sheet_num in range(1, sheets_used + 1):
        elements.append(Spacer(1, 0))  # force page break via KeepTogether later

        sheet_pieces = [p for p in placements if p["sheet"] == sheet_num]
        used_area = sum(p["w"] * p["h"] for p in sheet_pieces)
        waste_pct = ((sw * sh - used_area) / (sw * sh) * 100) if sw * sh > 0 else 0

        # Calculate scale to fit A4 page
        page_draw_w = 170 * mm
        page_draw_h = 220 * mm
        scale = min(page_draw_w / sw, page_draw_h / sh)
        dw = sw * scale
        dh = sh * scale

        drawing = Drawing(dw + 20 * mm, dh + 25 * mm)

        # Header text
        drawing.add(String(dw / 2 + 5 * mm, dh + 18 * mm,
                           f"Sheet {sheet_num} of {sheets_used}  —  Waste: {waste_pct:.1f}%",
                           fontSize=11, fontName="Helvetica-Bold", textAnchor="middle"))

        ox = 5 * mm
        oy = 5 * mm

        # Sheet outline
        drawing.add(Rect(ox, oy, dw, dh, fillColor=colors.HexColor("#f9fafb"),
                         strokeColor=colors.black, strokeWidth=1))

        # Dimension labels
        drawing.add(String(ox + dw / 2, oy + dh + 4 * mm, f"{sw} mm",
                           fontSize=8, fontName="Helvetica-Bold", textAnchor="middle"))
        # Left dimension — vertical text
        drawing.add(String(ox - 4 * mm, oy + dh / 2, f"{sh} mm",
                           fontSize=8, fontName="Helvetica-Bold", textAnchor="middle"))

        # Draw pieces
        for p in sheet_pieces:
            px = ox + p["x"] * scale
            # ReportLab y-axis is bottom-up, so invert
            py = oy + dh - (p["y"] + p["h"]) * scale
            pw = p["w"] * scale
            ph = p["h"] * scale

            fill, stroke = color_map.get(p["part_id"], (PART_COLORS[0], PART_BORDERS[0]))
            drawing.add(Rect(px, py, pw, ph, fillColor=fill, strokeColor=stroke, strokeWidth=0.8))

            # Label
            min_dim = min(pw, ph)
            if min_dim > 8 * mm:
                fs = max(5, min(min_dim / (3 * mm) * 3, 10))
                drawing.add(String(px + pw / 2, py + ph / 2 - fs * 0.15,
                                   p["label"], fontSize=fs, fontName="Helvetica-Bold",
                                   textAnchor="middle", fillColor=stroke))
                # Dimensions
                if pw > 15 * mm and ph > 10 * mm:
                    dfs = max(4, fs * 0.6)
                    drawing.add(String(px + pw / 2, py + ph - dfs - 1,
                                       f"{p['w']:.0f}", fontSize=dfs,
                                       textAnchor="middle", fillColor=colors.HexColor("#555")))

        elements.append(drawing)

    doc.build(elements)
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes
