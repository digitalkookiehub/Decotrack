"""Cutlist Optimizer — uses rectpack MaxRects for 2D bin packing.

Supports guillotine cutting, grain direction lock, rotation lock,
edge banding tracking, and per-sheet SVG diagram generation.
"""

import logging
import math
from decimal import Decimal

import rectpack
from sqlalchemy.orm import Session

from app.exceptions import BadRequestError, NotFoundError
from app.models.cutlist import (
    CutJob,
    CutJobStatus,
    CutPart,
    CutResult,
    CuttingMethod,
    OptimizationPriority,
)
from app.models.raw_material import RawMaterial
from app.schemas.cutlist import CutJobCreate, CutJobUpdate

logger = logging.getLogger(__name__)

# Colors for SVG pieces (cycle through)
SVG_COLORS = [
    "#dbeafe", "#fce7f3", "#fef3c7", "#d1fae5", "#e0e7ff",
    "#ede9fe", "#fee2e2", "#ccfbf1", "#ffedd5", "#cffafe",
    "#ecfccb", "#f5d0fe", "#fed7aa", "#a5f3fc", "#d9f99d",
]
SVG_BORDERS = [
    "#3b82f6", "#ec4899", "#f59e0b", "#10b981", "#6366f1",
    "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
    "#84cc16", "#e879f9", "#fb923c", "#22d3ee", "#a3e635",
]


# ── CRUD ─────────────────────────────────────────────────────


def create_job(db: Session, data: CutJobCreate, user_id: int | None = None) -> CutJob:
    job = CutJob(
        name=data.name,
        material_id=data.material_id,
        sheet_width=data.sheet_width,
        sheet_height=data.sheet_height,
        blade_kerf=data.blade_kerf,
        kerf_unit=data.kerf_unit,
        cut_orientation=data.cut_orientation,
        cutting_method=data.cutting_method,
        optimization_priority=data.optimization_priority,
        units=data.units,
        status=CutJobStatus.PENDING,
        created_by=user_id,
    )
    db.add(job)
    db.flush()

    for p in data.parts:
        # Validate part dims vs sheet dims
        if p.length > data.sheet_width and p.length > data.sheet_height:
            raise BadRequestError(f"Part '{p.label}' length {p.length} exceeds sheet dimensions")
        if p.width > data.sheet_width and p.width > data.sheet_height:
            raise BadRequestError(f"Part '{p.label}' width {p.width} exceeds sheet dimensions")

        part = CutPart(
            cut_job_id=job.id,
            label=p.label,
            length=p.length,
            width=p.width,
            quantity=p.quantity,
            grain_locked=p.grain_locked,
            edge_banding_l1=p.edge_banding_l1,
            edge_banding_l2=p.edge_banding_l2,
            edge_banding_w1=p.edge_banding_w1,
            edge_banding_w2=p.edge_banding_w2,
            rotation_locked=p.rotation_locked,
        )
        db.add(part)

    db.commit()
    db.refresh(job)
    logger.info("Cut job created: id=%d, name=%s, parts=%d", job.id, job.name, len(job.parts))
    return job


def get_job(db: Session, job_id: int) -> CutJob:
    job = db.query(CutJob).filter(CutJob.id == job_id).first()
    if not job:
        raise NotFoundError("Cut Job")
    return job


def list_jobs(db: Session, page: int = 1, per_page: int = 20) -> tuple[list[CutJob], int]:
    query = db.query(CutJob).order_by(CutJob.created_at.desc())
    total = query.count()
    jobs = query.offset((page - 1) * per_page).limit(per_page).all()
    return jobs, total


def update_job(db: Session, job_id: int, data: CutJobUpdate) -> CutJob:
    job = get_job(db, job_id)
    if job.status != CutJobStatus.PENDING:
        raise BadRequestError("Can only update PENDING jobs")

    for field, value in data.model_dump(exclude_unset=True, exclude={"parts"}).items():
        if value is not None:
            setattr(job, field, value)

    if data.parts is not None:
        # Replace all parts
        db.query(CutPart).filter(CutPart.cut_job_id == job_id).delete()
        sw = float(data.sheet_width or job.sheet_width)
        sh = float(data.sheet_height or job.sheet_height)
        for p in data.parts:
            if p.length > sw and p.length > sh:
                raise BadRequestError(f"Part '{p.label}' length {p.length} exceeds sheet")
            if p.width > sw and p.width > sh:
                raise BadRequestError(f"Part '{p.label}' width {p.width} exceeds sheet")
            part = CutPart(
                cut_job_id=job_id,
                label=p.label, length=p.length, width=p.width,
                quantity=p.quantity, grain_locked=p.grain_locked,
                edge_banding_l1=p.edge_banding_l1, edge_banding_l2=p.edge_banding_l2,
                edge_banding_w1=p.edge_banding_w1, edge_banding_w2=p.edge_banding_w2,
                rotation_locked=p.rotation_locked,
            )
            db.add(part)

    # Clear old result
    if job.result:
        db.delete(job.result)
    job.status = CutJobStatus.PENDING

    db.commit()
    db.refresh(job)
    return job


def delete_job(db: Session, job_id: int) -> None:
    job = get_job(db, job_id)
    db.delete(job)
    db.commit()


# ── OPTIMIZATION ─────────────────────────────────────────────


def optimize_job(db: Session, job_id: int) -> CutResult:
    """Run rectpack MaxRects optimization on a cut job."""
    job = get_job(db, job_id)

    sw = float(job.sheet_width)
    sh = float(job.sheet_height)
    kerf = float(job.blade_kerf)
    is_guillotine = job.cutting_method == CuttingMethod.GUILLOTINE

    # Effective sheet dimensions after kerf
    eff_w = int((sw - kerf) * 100)  # scale to int for rectpack (uses integers)
    eff_h = int((sh - kerf) * 100)

    if eff_w <= 0 or eff_h <= 0:
        raise BadRequestError("Sheet dimensions too small after blade kerf subtraction")

    # Select packing mode
    if is_guillotine:
        pack_algo = rectpack.GuillotineBssfSas
    else:
        pack_algo = rectpack.MaxRectsBssf

    # Build packer
    packer = rectpack.newPacker(
        mode=rectpack.PackingMode.Offline,
        pack_algo=pack_algo,
        rotation=True,
    )

    # Expand parts by quantity and add to packer
    part_map: dict[int, dict] = {}  # rid -> part info
    rid = 0
    unfit_parts: list[str] = []

    for part in job.parts:
        pl = int(float(part.length) * 100)
        pw = int(float(part.width) * 100)

        # Validate part fits sheet (considering rotation)
        can_fit_normal = pl <= eff_w and pw <= eff_h
        can_fit_rotated = pw <= eff_w and pl <= eff_h
        no_rotate = part.rotation_locked or part.grain_locked

        if no_rotate and not can_fit_normal:
            unfit_parts.append(f"{part.label} ({part.length}x{part.width}) - rotation locked")
            continue
        if not can_fit_normal and not can_fit_rotated:
            unfit_parts.append(f"{part.label} ({part.length}x{part.width}) - too large")
            continue

        for q in range(part.quantity):
            part_map[rid] = {
                "part_id": part.id,
                "label": part.label,
                "orig_l": float(part.length),
                "orig_w": float(part.width),
                "no_rotate": no_rotate,
                "q_index": q,
            }
            if no_rotate:
                # Add without allowing rotation — pack as fixed
                packer.add_rect(pl, pw, rid=rid)
            else:
                packer.add_rect(pl, pw, rid=rid)
            rid += 1

    if unfit_parts:
        raise BadRequestError(f"Parts that don't fit the sheet: {'; '.join(unfit_parts)}")

    if rid == 0:
        raise BadRequestError("No parts to optimize")

    # Add enough bins (sheets)
    max_sheets = rid + 1
    for _ in range(max_sheets):
        packer.add_bin(eff_w, eff_h)

    # Run packing
    packer.pack()

    # Collect results using rect_list() — returns (bin_idx, x, y, w, h, rid)
    placements: list[dict] = []
    sheets_used_set: set[int] = set()

    for rect_tuple in packer.rect_list():
        abin_idx, x, y, w, h, rect_rid = rect_tuple
        info = part_map.get(rect_rid, {})
        orig_l = info.get("orig_l", w / 100)
        orig_w = info.get("orig_w", h / 100)

        placed_w = w / 100
        placed_h = h / 100

        # Determine if rotated: if placed dimensions are swapped vs original
        rotated = (abs(placed_w - orig_w) < 0.1 and abs(placed_h - orig_l) < 0.1)

        x_real = x / 100
        y_real = y / 100

        sheets_used_set.add(abin_idx)
        placements.append({
            "sheet": abin_idx + 1,
            "label": info.get("label", f"Part-{rect_rid}"),
            "x": round(x_real, 2),
            "y": round(y_real, 2),
            "w": round(placed_w, 2),
            "h": round(placed_h, 2),
            "rotated": rotated,
            "part_id": info.get("part_id", 0),
        })

    sheets_used = len(sheets_used_set)
    if sheets_used == 0:
        raise BadRequestError("Optimization failed — no parts could be placed")

    # Calculate metrics
    total_part_area = sum(p["w"] * p["h"] for p in placements)
    total_sheet_area = sheets_used * sw * sh
    waste_area = total_sheet_area - total_part_area
    waste_pct = (waste_area / total_sheet_area * 100) if total_sheet_area > 0 else 0
    efficiency_pct = 100 - waste_pct

    # Cost
    price_per_sheet = 0.0
    if job.material:
        price_per_sheet = float(job.material.last_purchase_rate or 0)
    total_cost = sheets_used * price_per_sheet

    # Generate SVG for each sheet
    svg_data = _generate_svgs(placements, sheets_used, sw, sh, job.parts)

    # Save or update result
    if job.result:
        db.delete(job.result)
        db.flush()

    result = CutResult(
        cut_job_id=job_id,
        sheets_used=sheets_used,
        waste_percentage=Decimal(str(round(waste_pct, 2))),
        material_efficiency_percentage=Decimal(str(round(efficiency_pct, 2))),
        total_cost=Decimal(str(round(total_cost, 2))),
        waste_area=Decimal(str(round(waste_area, 2))),
        placements_json=placements,
        svg_data_json=svg_data,
    )
    db.add(result)
    job.status = CutJobStatus.OPTIMIZED
    db.commit()
    db.refresh(result)

    logger.info(
        "Cut job %d optimized: %d sheets, %.1f%% waste, cost=%.2f",
        job_id, sheets_used, waste_pct, total_cost,
    )
    return result


# ── SVG GENERATION ───────────────────────────────────────────


def _generate_svgs(
    placements: list[dict],
    sheets_used: int,
    sheet_w: float,
    sheet_h: float,
    parts: list,
) -> list[str]:
    """Generate one SVG string per sheet."""
    # Build part color map
    part_ids = list({p["part_id"] for p in placements})
    color_map: dict[int, tuple[str, str]] = {}
    for i, pid in enumerate(sorted(part_ids)):
        color_map[pid] = (SVG_COLORS[i % len(SVG_COLORS)], SVG_BORDERS[i % len(SVG_BORDERS)])

    svgs: list[str] = []
    pad = 40

    for sheet_num in range(1, sheets_used + 1):
        sheet_pieces = [p for p in placements if p["sheet"] == sheet_num]
        used_area = sum(p["w"] * p["h"] for p in sheet_pieces)
        waste_pct = ((sheet_w * sheet_h - used_area) / (sheet_w * sheet_h) * 100)

        vw = sheet_w + pad * 2
        vh = sheet_h + pad * 2 + 30  # extra for header

        lines: list[str] = []
        lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" '
                      f'width="100%" preserveAspectRatio="xMidYMid meet">')

        # Header
        lines.append(f'<text x="{vw/2}" y="18" text-anchor="middle" font-size="14" '
                      f'font-weight="bold" fill="#111">Sheet {sheet_num} of {sheets_used}'
                      f'  —  Waste: {waste_pct:.1f}%</text>')

        oy = 30  # offset for header

        # Sheet background
        lines.append(f'<rect x="{pad}" y="{pad + oy}" width="{sheet_w}" height="{sheet_h}" '
                      f'fill="#f9fafb" stroke="#374151" stroke-width="2"/>')

        # Hatching for waste
        lines.append(f'<defs><pattern id="hatch-{sheet_num}" patternUnits="userSpaceOnUse" '
                      f'width="8" height="8"><path d="M0,8 L8,0" stroke="#e5e7eb" '
                      f'stroke-width="0.8"/></pattern></defs>')
        lines.append(f'<rect x="{pad}" y="{pad + oy}" width="{sheet_w}" height="{sheet_h}" '
                      f'fill="url(#hatch-{sheet_num})"/>')

        # Dimension labels
        lines.append(f'<text x="{pad + sheet_w/2}" y="{pad + oy - 6}" text-anchor="middle" '
                      f'font-size="11" font-weight="bold" fill="#374151">{sheet_w} mm</text>')
        lines.append(f'<text x="{pad - 8}" y="{pad + oy + sheet_h/2}" text-anchor="middle" '
                      f'font-size="11" font-weight="bold" fill="#374151" '
                      f'transform="rotate(-90,{pad - 8},{pad + oy + sheet_h/2})">{sheet_h} mm</text>')

        # Pieces
        for p in sheet_pieces:
            px = pad + p["x"]
            py = pad + oy + p["y"]
            pw = p["w"]
            ph = p["h"]
            fill, stroke = color_map.get(p["part_id"], ("#dbeafe", "#3b82f6"))

            lines.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" '
                          f'fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')

            # Label + dimensions
            min_dim = min(pw, ph)
            if min_dim > 40:
                fs = max(8, min(min_dim * 0.15, 14))
                lines.append(f'<text x="{px + pw/2}" y="{py + ph/2}" text-anchor="middle" '
                              f'dominant-baseline="middle" font-size="{fs}" font-weight="bold" '
                              f'fill="{stroke}">{p["label"]}</text>')
                if pw > 60 and ph > 30:
                    dfs = max(6, fs * 0.65)
                    lines.append(f'<text x="{px + pw/2}" y="{py + dfs + 2}" text-anchor="middle" '
                                  f'font-size="{dfs}" fill="#555">{pw:.0f}</text>')
                    lines.append(f'<text x="{px + dfs}" y="{py + ph/2}" text-anchor="middle" '
                                  f'font-size="{dfs}" fill="#555" '
                                  f'transform="rotate(-90,{px + dfs},{py + ph/2})">{ph:.0f}</text>')

        lines.append("</svg>")
        svgs.append("\n".join(lines))

    return svgs


# ── QUICK CALCULATE (no save, supports multiple stock sheets) ─


def quick_calculate(data: dict) -> dict:
    """Run optimization without saving — supports multiple stock sheet sizes."""
    panels = data["panels"]
    stock_sheets = data["stock_sheets"]
    kerf = data.get("blade_kerf", 0)
    is_guillotine = data.get("cutting_method", "GUILLOTINE") == "GUILLOTINE"
    consider_grain = data.get("consider_material_grain", False)
    labels_on = data.get("labels_on_panels", True)
    use_one_size = data.get("use_only_one_sheet_size", False)

    if is_guillotine:
        pack_algo = rectpack.GuillotineBssfSas
    else:
        pack_algo = rectpack.MaxRectsBssf

    packer = rectpack.newPacker(
        mode=rectpack.PackingMode.Offline,
        pack_algo=pack_algo,
        rotation=True,
    )

    # Add stock sheet bins
    if use_one_size and stock_sheets:
        # Only use the first sheet size
        ss = stock_sheets[0]
        ew = int((ss["length"] - kerf) * 100)
        eh = int((ss["width"] - kerf) * 100)
        for _ in range(ss.get("quantity", 99)):
            packer.add_bin(ew, eh)
    else:
        for ss in stock_sheets:
            ew = int((ss["length"] - kerf) * 100)
            eh = int((ss["width"] - kerf) * 100)
            if ew <= 0 or eh <= 0:
                continue
            for _ in range(ss.get("quantity", 99)):
                packer.add_bin(ew, eh)

    # Expand panels and add rects
    part_map: dict[int, dict] = {}
    rid = 0
    unfit: list[str] = []

    for i, p in enumerate(panels):
        pl = int(p["length"] * 100)
        pw = int(p["width"] * 100)
        no_rotate = p.get("grain_locked", False) or p.get("rotation_locked", False)
        if consider_grain:
            no_rotate = True

        # Check fit against at least one stock sheet
        can_fit = False
        for ss in stock_sheets:
            sel = int((ss["length"] - kerf) * 100)
            seh = int((ss["width"] - kerf) * 100)
            if (pl <= sel and pw <= seh) or (not no_rotate and pw <= sel and pl <= seh):
                can_fit = True
                break
        if not can_fit:
            label = p.get("label", f"Panel {i+1}")
            unfit.append(f"{label} ({p['length']}x{p['width']})")
            continue

        qty = p.get("quantity", 1)
        for q in range(qty):
            label = p.get("label", f"P{i+1}")
            if qty > 1:
                label = f"{label} #{q+1}"
            part_map[rid] = {
                "label": label,
                "orig_l": p["length"],
                "orig_w": p["width"],
                "panel_idx": i,
                "no_rotate": no_rotate,
            }
            packer.add_rect(pl, pw, rid=rid)
            rid += 1

    if unfit:
        from app.exceptions import BadRequestError
        raise BadRequestError(f"Parts too large for any stock sheet: {'; '.join(unfit)}")

    if rid == 0:
        from app.exceptions import BadRequestError
        raise BadRequestError("No panels to optimize")

    packer.pack()

    # Collect results
    placements_by_bin: dict[int, list] = {}
    bin_sizes: dict[int, tuple] = {}

    for rect_tuple in packer.rect_list():
        bin_idx, x, y, w, h, rect_rid = rect_tuple
        info = part_map.get(rect_rid, {})
        placed_w = w / 100
        placed_h = h / 100
        orig_l = info.get("orig_l", placed_w)
        orig_w = info.get("orig_w", placed_h)
        rotated = abs(placed_w - orig_w) < 0.1 and abs(placed_h - orig_l) < 0.1

        if bin_idx not in placements_by_bin:
            placements_by_bin[bin_idx] = []
        placements_by_bin[bin_idx].append({
            "label": info.get("label", ""),
            "x": round(x / 100, 2),
            "y": round(y / 100, 2),
            "w": round(placed_w, 2),
            "h": round(placed_h, 2),
            "rotated": rotated,
            "panel_idx": info.get("panel_idx", 0),
        })

    # Determine bin sizes (from the stock sheet list order)
    bin_counter = 0
    for ss in stock_sheets:
        qty_to_add = ss.get("quantity", 99) if not use_one_size else stock_sheets[0].get("quantity", 99)
        sl = ss["length"]
        sw = ss["width"]
        for _ in range(qty_to_add):
            bin_sizes[bin_counter] = (sl, sw)
            bin_counter += 1
        if use_one_size:
            break

    # Build sheet results with SVGs
    sheet_results = []
    total_used = 0
    total_sheet_area = 0

    for bin_idx in sorted(placements_by_bin.keys()):
        pieces = placements_by_bin[bin_idx]
        sl, sw = bin_sizes.get(bin_idx, (stock_sheets[0]["length"], stock_sheets[0]["width"]))
        sheet_area = sl * sw
        used_area = sum(p["w"] * p["h"] for p in pieces)
        waste = sheet_area - used_area
        waste_pct = (waste / sheet_area * 100) if sheet_area > 0 else 0
        total_used += used_area
        total_sheet_area += sheet_area

        # Generate SVG
        svg = _generate_single_svg(pieces, sl, sw, bin_idx + 1, len(placements_by_bin), waste_pct, labels_on)

        sheet_results.append({
            "sheet_index": bin_idx + 1,
            "sheet_length": sl,
            "sheet_width": sw,
            "pieces": [{**p, "sheet_index": bin_idx + 1, "sheet_length": sl, "sheet_width": sw} for p in pieces],
            "used_area": round(used_area, 2),
            "waste_area": round(waste, 2),
            "waste_percent": round(waste_pct, 1),
            "svg": svg,
        })

    total_waste_pct = ((total_sheet_area - total_used) / total_sheet_area * 100) if total_sheet_area > 0 else 0

    return {
        "sheets": sheet_results,
        "summary": {
            "total_sheets": len(sheet_results),
            "total_panels_placed": sum(len(s["pieces"]) for s in sheet_results),
            "total_panels_requested": rid,
            "efficiency_percent": round(100 - total_waste_pct, 1),
            "waste_percent": round(total_waste_pct, 1),
            "total_used_area": round(total_used, 2),
            "total_sheet_area": round(total_sheet_area, 2),
            "total_waste_area": round(total_sheet_area - total_used, 2),
        },
    }


def _generate_single_svg(
    pieces: list[dict], sheet_l: float, sheet_w: float,
    sheet_num: int, total_sheets: int, waste_pct: float, labels_on: bool,
) -> str:
    """Generate SVG for a single sheet."""
    pad = 40
    vw = sheet_l + pad * 2
    vh = sheet_w + pad * 2 + 25

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" '
        f'width="100%" preserveAspectRatio="xMidYMid meet">',
        # Header
        f'<text x="{vw/2}" y="16" text-anchor="middle" font-size="13" '
        f'font-weight="bold" fill="#111">Sheet {sheet_num}/{total_sheets}'
        f'  ·  {sheet_l}×{sheet_w} mm  ·  Waste: {waste_pct:.1f}%</text>',
    ]
    oy = 25

    # Sheet outline with hatch
    lines.append(f'<rect x="{pad}" y="{pad+oy}" width="{sheet_l}" height="{sheet_w}" '
                  f'fill="#f3f4f6" stroke="#374151" stroke-width="2"/>')
    lines.append(f'<defs><pattern id="h{sheet_num}" patternUnits="userSpaceOnUse" '
                  f'width="8" height="8"><path d="M0,8 L8,0" stroke="#e5e7eb" stroke-width="0.7"/>'
                  f'</pattern></defs>')
    lines.append(f'<rect x="{pad}" y="{pad+oy}" width="{sheet_l}" height="{sheet_w}" '
                  f'fill="url(#h{sheet_num})"/>')

    # Dimension labels
    lines.append(f'<text x="{pad+sheet_l/2}" y="{pad+oy-6}" text-anchor="middle" '
                  f'font-size="10" font-weight="bold" fill="#374151">{sheet_l} mm</text>')
    lines.append(f'<text x="{pad-8}" y="{pad+oy+sheet_w/2}" text-anchor="middle" '
                  f'font-size="10" font-weight="bold" fill="#374151" '
                  f'transform="rotate(-90,{pad-8},{pad+oy+sheet_w/2})">{sheet_w} mm</text>')

    # Pieces
    for i, p in enumerate(pieces):
        px = pad + p["x"]
        py = pad + oy + p["y"]
        pw = p["w"]
        ph = p["h"]
        cidx = p.get("panel_idx", i) % len(SVG_COLORS)
        fill = SVG_COLORS[cidx]
        stroke = SVG_BORDERS[cidx]

        lines.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" '
                      f'fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')

        if labels_on and min(pw, ph) > 35:
            fs = max(7, min(min(pw, ph) * 0.14, 13))
            lines.append(f'<text x="{px+pw/2}" y="{py+ph/2-fs*0.2}" text-anchor="middle" '
                          f'dominant-baseline="middle" font-size="{fs}" font-weight="bold" '
                          f'fill="{stroke}">{p["label"]}</text>')
            if pw > 50 and ph > 25:
                dfs = max(5, fs * 0.6)
                lines.append(f'<text x="{px+pw/2}" y="{py+ph/2+fs*0.6}" text-anchor="middle" '
                              f'font-size="{dfs}" fill="#666">{pw:.0f}×{ph:.0f}</text>')

    lines.append("</svg>")
    return "\n".join(lines)


# ── MATERIALS ────────────────────────────────────────────────


def list_materials(db: Session) -> list[dict]:
    """Read-only list of materials with sheet dimensions."""
    materials = (
        db.query(RawMaterial)
        .filter(RawMaterial.is_active.is_(True))
        .all()
    )
    return [
        {
            "id": m.id,
            "name": m.name,
            "sheet_width": float(m.sheet_length) if m.sheet_length else None,
            "sheet_height": float(m.sheet_width) if m.sheet_width else None,
            "price_per_sheet": float(m.last_purchase_rate or 0),
        }
        for m in materials
    ]
