"""2D Elevation Drawing Service — generates front/side view SVGs for furniture.

Supports: Cupboard/Wardrobe, Kitchen Cabinet, TV Unit, Bookshelf, Study Table, Shoe Rack.
Auto-calculates all panels needed with exact dimensions.
"""

import logging
import math

logger = logging.getLogger(__name__)

TEMPLATES = {
    "cupboard": {"label": "Cupboard / Wardrobe", "defaults": {"width": 1800, "height": 2100, "depth": 550, "doors": 3, "shelves": 2, "partitions": 2}},
    "kitchen_cabinet": {"label": "Kitchen Cabinet", "defaults": {"width": 600, "height": 720, "depth": 550, "doors": 2, "shelves": 1, "drawers": 0, "cabinet_type": "base"}},
    "tv_unit": {"label": "TV Unit", "defaults": {"width": 1500, "height": 500, "depth": 400, "doors": 2, "shelves": 1, "partitions": 1}},
    "bookshelf": {"label": "Bookshelf / Shelf Unit", "defaults": {"width": 800, "height": 1800, "depth": 300, "shelves": 5, "back_panel": True}},
    "study_table": {"label": "Study Table / Dressing Table", "defaults": {"width": 1200, "height": 750, "depth": 600, "drawers": 3}},
    "shoe_rack": {"label": "Shoe Rack", "defaults": {"width": 800, "height": 1000, "depth": 350, "shelves": 4, "doors": 0, "tilted_shelves": True}},
}


def get_templates() -> dict:
    return TEMPLATES


def generate_elevation(data: dict) -> dict:
    """Generate elevation SVGs and pieces list for a furniture product."""
    pt = data["product_type"]
    W = data["width"]
    H = data["height"]
    D = data["depth"]
    t = data.get("material_thickness", 18)
    doors = data.get("doors", 0)
    drawers = data.get("drawers", 0)
    shelves = data.get("shelves", 2)
    partitions = data.get("partitions", 0)
    back = data.get("back_panel", True)

    # Calculate pieces based on product type
    if pt == "cupboard":
        pieces = _calc_cupboard(W, H, D, t, doors, shelves, partitions, back)
    elif pt == "kitchen_cabinet":
        pieces = _calc_kitchen_cabinet(W, H, D, t, doors, drawers, shelves, back, data.get("cabinet_type", "base"))
    elif pt == "tv_unit":
        pieces = _calc_tv_unit(W, H, D, t, doors, shelves, partitions, back)
    elif pt == "bookshelf":
        pieces = _calc_bookshelf(W, H, D, t, shelves, back)
    elif pt == "study_table":
        pieces = _calc_study_table(W, H, D, t, drawers, data.get("keyboard_tray", False))
    elif pt == "shoe_rack":
        pieces = _calc_shoe_rack(W, H, D, t, shelves, doors, back, data.get("tilted_shelves", False))
    else:
        pieces = _calc_cupboard(W, H, D, t, doors, shelves, partitions, back)

    # Generate SVGs
    front_svg = _draw_front_view(pt, W, H, t, doors, drawers, shelves, partitions, data)
    side_svg = _draw_side_view(pt, H, D, t, shelves, back, data)

    total_area = sum(p["length"] * p["width"] * p["quantity"] for p in pieces)
    total_count = sum(p["quantity"] for p in pieces)

    return {
        "front_view_svg": front_svg,
        "side_view_svg": side_svg,
        "pieces": pieces,
        "summary": {
            "total_pieces": total_count,
            "total_area_mm2": round(total_area, 0),
            "product_type": pt,
            "product_label": TEMPLATES.get(pt, {}).get("label", pt),
            "dimensions": f"{W} × {H} × {D} mm",
        },
    }


# ── PIECE CALCULATIONS ───────────────────────────────────────


def _calc_cupboard(W, H, D, t, doors, shelves, partitions, back):
    pieces = [
        {"label": "Top", "length": round(W, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Bottom", "length": round(W, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Left Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Right Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
    ]
    if back:
        pieces.append({"label": "Back Panel", "length": round(W - 2 * t, 1), "width": round(H - 2 * t, 1), "quantity": 1})
    if partitions > 0:
        p_h = round(H - 2 * t, 1)
        p_d = round(D - t, 1)
        pieces.append({"label": "Partition", "length": p_h, "width": p_d, "quantity": partitions})
    if doors > 0:
        compartments = partitions + 1
        door_w = round((W - 2 * t) / doors, 1)
        door_h = round(H - 2 * t, 1)
        pieces.append({"label": "Door", "length": door_h, "width": door_w, "quantity": doors})
    if shelves > 0:
        compartments = max(partitions + 1, 1)
        shelf_w = round((W - 2 * t - partitions * t) / compartments, 1)
        shelf_d = round(D - t, 1)
        pieces.append({"label": "Shelf", "length": shelf_w, "width": shelf_d, "quantity": shelves * compartments})
    return pieces


def _calc_kitchen_cabinet(W, H, D, t, doors, drawers, shelves, back, cab_type):
    pieces = [
        {"label": "Left Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Right Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Top", "length": round(W - 2 * t, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Bottom", "length": round(W - 2 * t, 1), "width": round(D, 1), "quantity": 1},
    ]
    if back:
        pieces.append({"label": "Back Panel", "length": round(W - 2 * t, 1), "width": round(H - 2 * t, 1), "quantity": 1})
    if cab_type == "base":
        pieces.append({"label": "Kick Plate", "length": round(W - 2 * t, 1), "width": round(100, 1), "quantity": 1})
    if doors > 0:
        dw = round((W - 2 * t) / doors, 1)
        dh = round(H - 2 * t - (drawers * 200 if drawers else 0), 1)
        pieces.append({"label": "Door", "length": dh, "width": dw, "quantity": doors})
    if drawers > 0:
        drw = round(W - 2 * t - 26, 1)  # minus slide clearance
        pieces.append({"label": "Drawer Front", "length": round(180, 1), "width": drw, "quantity": drawers})
        pieces.append({"label": "Drawer Side", "length": round(D - 50, 1), "width": round(150, 1), "quantity": drawers * 2})
        pieces.append({"label": "Drawer Bottom", "length": drw, "width": round(D - 50, 1), "quantity": drawers})
    if shelves > 0:
        pieces.append({"label": "Shelf", "length": round(W - 2 * t, 1), "width": round(D - t, 1), "quantity": shelves})
    return pieces


def _calc_tv_unit(W, H, D, t, doors, shelves, partitions, back):
    pieces = [
        {"label": "Top", "length": round(W, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Bottom", "length": round(W, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Left Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Right Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
    ]
    if back:
        pieces.append({"label": "Back Panel", "length": round(W - 2 * t, 1), "width": round(H - 2 * t, 1), "quantity": 1})
    if partitions > 0:
        pieces.append({"label": "Divider", "length": round(H - 2 * t, 1), "width": round(D - t, 1), "quantity": partitions})
    if doors > 0:
        comp = partitions + 1
        dw = round((W - 2 * t - partitions * t) / comp, 1)
        pieces.append({"label": "Door", "length": round(H - 2 * t, 1), "width": dw, "quantity": doors})
    if shelves > 0:
        comp = max(partitions + 1, 1)
        sw = round((W - 2 * t - partitions * t) / comp, 1)
        pieces.append({"label": "Shelf", "length": sw, "width": round(D - t, 1), "quantity": shelves * comp})
    return pieces


def _calc_bookshelf(W, H, D, t, shelves, back):
    pieces = [
        {"label": "Top", "length": round(W, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Bottom", "length": round(W, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Left Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Right Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
    ]
    if back:
        pieces.append({"label": "Back Panel", "length": round(W - 2 * t, 1), "width": round(H - 2 * t, 1), "quantity": 1})
    if shelves > 0:
        pieces.append({"label": "Shelf", "length": round(W - 2 * t, 1), "width": round(D - t, 1), "quantity": shelves})
    return pieces


def _calc_study_table(W, H, D, t, drawers, keyboard_tray):
    pieces = [
        {"label": "Table Top", "length": round(W, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Left Panel", "length": round(H - t, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Right Panel", "length": round(H - t, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Back Rail", "length": round(W - 2 * t, 1), "width": round(100, 1), "quantity": 1},
        {"label": "Modesty Panel", "length": round(W - 2 * t, 1), "width": round(H - t - 200, 1), "quantity": 1},
    ]
    if drawers > 0:
        drw = round((W - 2 * t) / drawers - 26, 1)
        pieces.append({"label": "Drawer Front", "length": round(150, 1), "width": drw, "quantity": drawers})
        pieces.append({"label": "Drawer Side", "length": round(D - 50, 1), "width": round(120, 1), "quantity": drawers * 2})
        pieces.append({"label": "Drawer Bottom", "length": drw, "width": round(D - 50, 1), "quantity": drawers})
    if keyboard_tray:
        pieces.append({"label": "Keyboard Tray", "length": round(W - 2 * t - 50, 1), "width": round(250, 1), "quantity": 1})
    return pieces


def _calc_shoe_rack(W, H, D, t, shelves, doors, back, tilted):
    pieces = [
        {"label": "Top", "length": round(W, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Bottom", "length": round(W, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Left Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
        {"label": "Right Side", "length": round(H, 1), "width": round(D, 1), "quantity": 1},
    ]
    if back:
        pieces.append({"label": "Back Panel", "length": round(W - 2 * t, 1), "width": round(H - 2 * t, 1), "quantity": 1})
    if shelves > 0:
        shelf_w = round(W - 2 * t, 1)
        shelf_d = round(D - t if not tilted else D * 0.7, 1)
        pieces.append({"label": "Shelf" + (" (tilted)" if tilted else ""), "length": shelf_w, "width": shelf_d, "quantity": shelves})
    if doors > 0:
        dw = round((W - 2 * t) / doors, 1)
        pieces.append({"label": "Door", "length": round(H - 2 * t, 1), "width": dw, "quantity": doors})
    return pieces


# ── SVG GENERATION ───────────────────────────────────────────

def _dim_line(x1, y1, x2, y2, label, offset=20, vertical=False):
    """Generate SVG dimension line with arrows and label."""
    lines = []
    if vertical:
        mx = x1 - offset
        lines.append(f'<line x1="{mx}" y1="{y1}" x2="{mx}" y2="{y2}" stroke="#555" stroke-width="0.8"/>')
        lines.append(f'<line x1="{mx-5}" y1="{y1}" x2="{mx+5}" y2="{y1}" stroke="#555" stroke-width="0.8"/>')
        lines.append(f'<line x1="{mx-5}" y1="{y2}" x2="{mx+5}" y2="{y2}" stroke="#555" stroke-width="0.8"/>')
        lines.append(f'<text x="{mx-4}" y="{(y1+y2)/2}" text-anchor="middle" font-size="10" font-weight="bold" fill="#333" transform="rotate(-90,{mx-4},{(y1+y2)/2})">{label}</text>')
    else:
        my = y1 - offset
        lines.append(f'<line x1="{x1}" y1="{my}" x2="{x2}" y2="{my}" stroke="#555" stroke-width="0.8"/>')
        lines.append(f'<line x1="{x1}" y1="{my-5}" x2="{x1}" y2="{my+5}" stroke="#555" stroke-width="0.8"/>')
        lines.append(f'<line x1="{x2}" y1="{my-5}" x2="{x2}" y2="{my+5}" stroke="#555" stroke-width="0.8"/>')
        lines.append(f'<text x="{(x1+x2)/2}" y="{my-6}" text-anchor="middle" font-size="10" font-weight="bold" fill="#333">{label}</text>')
    return "\n".join(lines)


def _draw_front_view(pt, W, H, t, doors, drawers, shelves, partitions, data):
    """Generate front elevation SVG."""
    pad = 50
    scale = min(500 / W, 600 / H)
    sw = W * scale
    sh = H * scale
    vw = sw + pad * 2
    vh = sh + pad * 2 + 20

    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" width="100%" preserveAspectRatio="xMidYMid meet">']
    lines.append(f'<text x="{vw/2}" y="16" text-anchor="middle" font-size="13" font-weight="bold" fill="#111">Front View</text>')
    ox, oy = pad, pad + 20

    # Outer box
    lines.append(f'<rect x="{ox}" y="{oy}" width="{sw}" height="{sh}" fill="#faf5ef" stroke="#333" stroke-width="2"/>')

    # Thickness lines (top/bottom/sides)
    ts = t * scale
    lines.append(f'<rect x="{ox}" y="{oy}" width="{sw}" height="{ts}" fill="#e8dcc8" stroke="#999" stroke-width="0.5"/>')
    lines.append(f'<rect x="{ox}" y="{oy+sh-ts}" width="{sw}" height="{ts}" fill="#e8dcc8" stroke="#999" stroke-width="0.5"/>')
    lines.append(f'<rect x="{ox}" y="{oy}" width="{ts}" height="{sh}" fill="#e8dcc8" stroke="#999" stroke-width="0.5"/>')
    lines.append(f'<rect x="{ox+sw-ts}" y="{oy}" width="{ts}" height="{sh}" fill="#e8dcc8" stroke="#999" stroke-width="0.5"/>')

    # Inner area
    ix, iy = ox + ts, oy + ts
    iw, ih = sw - 2 * ts, sh - 2 * ts

    # Partitions
    if partitions > 0:
        comp = partitions + 1
        for p in range(1, partitions + 1):
            px = ix + (iw / comp) * p - ts / 2
            lines.append(f'<rect x="{px}" y="{iy}" width="{ts}" height="{ih}" fill="#d4c4a8" stroke="#999" stroke-width="0.5"/>')

    # Doors
    drawer_h = drawers * 200 * scale if drawers > 0 else 0
    if doors > 0:
        door_h = ih - drawer_h
        dw = iw / doors
        for d in range(doors):
            dx = ix + d * dw + 2
            lines.append(f'<rect x="{dx}" y="{iy + drawer_h + 2}" width="{dw - 4}" height="{door_h - 4}" fill="none" stroke="#8B7355" stroke-width="1.5" rx="2"/>')
            # Handle
            hx = dx + dw - 15 if d % 2 == 0 else dx + 10
            hy = iy + drawer_h + door_h / 2
            lines.append(f'<line x1="{hx}" y1="{hy-12}" x2="{hx}" y2="{hy+12}" stroke="#666" stroke-width="2.5" stroke-linecap="round"/>')
            # Label
            lines.append(f'<text x="{dx + dw/2}" y="{iy + drawer_h + door_h/2 + 4}" text-anchor="middle" font-size="11" fill="#8B7355" font-weight="bold">D{d+1}</text>')

    # Drawers
    if drawers > 0:
        drh = drawer_h / drawers
        for d in range(drawers):
            dy = iy + d * drh + 2
            lines.append(f'<rect x="{ix + 2}" y="{dy}" width="{iw - 4}" height="{drh - 4}" fill="none" stroke="#8B7355" stroke-width="1.2" rx="1"/>')
            lines.append(f'<circle cx="{ix + iw/2}" cy="{dy + drh/2}" r="3" fill="#666"/>')

    # Shelf lines (dashed) — inside side view only (skip in front for doors)
    if doors == 0 and shelves > 0:
        for s in range(1, shelves + 1):
            sy = iy + (ih / (shelves + 1)) * s
            lines.append(f'<line x1="{ix}" y1="{sy}" x2="{ix + iw}" y2="{sy}" stroke="#999" stroke-width="0.8" stroke-dasharray="6,3"/>')

    # Dimensions
    lines.append(_dim_line(ox, oy, ox + sw, oy, f"{W} mm", offset=18))
    lines.append(_dim_line(ox, oy, ox, oy + sh, f"{H} mm", offset=22, vertical=True))

    lines.append("</svg>")
    return "\n".join(lines)


def _draw_side_view(pt, H, D, t, shelves, back, data):
    """Generate side section SVG."""
    pad = 50
    scale = min(300 / D, 600 / H)
    sd = D * scale
    sh = H * scale
    vw = sd + pad * 2
    vh = sh + pad * 2 + 20

    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" width="100%" preserveAspectRatio="xMidYMid meet">']
    lines.append(f'<text x="{vw/2}" y="16" text-anchor="middle" font-size="13" font-weight="bold" fill="#111">Side Section</text>')
    ox, oy = pad, pad + 20
    ts = t * scale

    # Outer box
    lines.append(f'<rect x="{ox}" y="{oy}" width="{sd}" height="{sh}" fill="#faf5ef" stroke="#333" stroke-width="2"/>')

    # Top/bottom thickness
    lines.append(f'<rect x="{ox}" y="{oy}" width="{sd}" height="{ts}" fill="#e8dcc8" stroke="#999" stroke-width="0.5"/>')
    lines.append(f'<rect x="{ox}" y="{oy+sh-ts}" width="{sd}" height="{ts}" fill="#e8dcc8" stroke="#999" stroke-width="0.5"/>')

    # Side panel
    lines.append(f'<rect x="{ox}" y="{oy}" width="{ts}" height="{sh}" fill="#d4c4a8" stroke="#999" stroke-width="0.5"/>')

    # Back panel
    if back:
        bp_t = max(ts * 0.4, 2)
        lines.append(f'<rect x="{ox + sd - bp_t}" y="{oy}" width="{bp_t}" height="{sh}" fill="#c4b896" stroke="#999" stroke-width="0.5"/>')

    # Shelves
    if shelves > 0:
        inner_h = sh - 2 * ts
        for s in range(1, shelves + 1):
            sy = oy + ts + (inner_h / (shelves + 1)) * s
            lines.append(f'<rect x="{ox + ts}" y="{sy - ts/2}" width="{sd - ts - (3 if back else 0)}" height="{ts}" fill="#e8dcc8" stroke="#999" stroke-width="0.5"/>')
            # Spacing dimension
            if s == 1:
                spacing = round(((H - 2 * t) / (shelves + 1)), 0)
                lines.append(f'<text x="{ox + sd + 8}" y="{sy}" font-size="8" fill="#666">{spacing}</text>')

    # Dimensions
    lines.append(_dim_line(ox, oy, ox + sd, oy, f"{D} mm", offset=18))
    lines.append(_dim_line(ox, oy, ox, oy + sh, f"{H} mm", offset=22, vertical=True))

    lines.append("</svg>")
    return "\n".join(lines)
