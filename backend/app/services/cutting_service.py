"""Cutting List Optimizer — 2D Guillotine Bin Packing.

Takes a cutting list (pieces with width × height × qty) and fits them into
minimum number of standard sheets using guillotine-cut-compatible placement.
Returns visual layout coordinates for each sheet.
"""

import logging
from copy import deepcopy
from decimal import Decimal

from sqlalchemy.orm import Session

from app.exceptions import BadRequestError, NotFoundError
from app.models.cutting import CuttingPattern
from app.models.raw_material import RawMaterial
from app.models.user import User

logger = logging.getLogger(__name__)

# Blade kerf (cutting blade width) in mm — subtracted from available space
BLADE_KERF_MM = 4


# ── 2D Guillotine Bin Packing ────────────────────────────────


class Rect:
    """A rectangle with position for placement on a sheet."""

    def __init__(self, w: float, h: float, label: str = "", piece_id: int = 0):
        self.w = w
        self.h = h
        self.label = label
        self.piece_id = piece_id
        # Placement coordinates (set after packing)
        self.x = 0.0
        self.y = 0.0
        self.rotated = False

    @property
    def area(self) -> float:
        return self.w * self.h

    def __repr__(self) -> str:
        return f"Rect({self.w}×{self.h} '{self.label}')"


class FreeRect:
    """A free rectangular space on a sheet."""

    def __init__(self, x: float, y: float, w: float, h: float):
        self.x = x
        self.y = y
        self.w = w
        self.h = h

    @property
    def area(self) -> float:
        return self.w * self.h


class Sheet:
    """A single sheet with placed pieces and free spaces."""

    def __init__(self, width: float, height: float, sheet_num: int):
        self.width = width
        self.height = height
        self.sheet_num = sheet_num
        self.placed: list[Rect] = []
        self.free_rects: list[FreeRect] = [FreeRect(0, 0, width, height)]

    @property
    def used_area(self) -> float:
        return sum(r.area for r in self.placed)

    @property
    def total_area(self) -> float:
        return self.width * self.height

    @property
    def waste_area(self) -> float:
        return self.total_area - self.used_area

    @property
    def waste_percent(self) -> float:
        return (self.waste_area / self.total_area * 100) if self.total_area > 0 else 0

    def try_place(self, piece: Rect, kerf: float = 0) -> bool:
        """Try to place a piece using Best Short Side Fit + Best Area Fit.

        Tries both orientations and both split directions for each free rect.
        Picks the placement that minimizes the shorter leftover side,
        with area as tiebreaker.
        """
        best_score = float("inf")
        best_area_score = float("inf")
        best_free_idx = -1
        best_rotated = False

        for i, fr in enumerate(self.free_rects):
            for rotated in [False, True]:
                pw = piece.h if rotated else piece.w
                ph = piece.w if rotated else piece.h
                if pw <= fr.w and ph <= fr.h:
                    leftover_w = fr.w - pw
                    leftover_h = fr.h - ph
                    short_side = min(leftover_w, leftover_h)
                    area_left = fr.area - pw * ph
                    if short_side < best_score or (short_side == best_score and area_left < best_area_score):
                        best_score = short_side
                        best_area_score = area_left
                        best_free_idx = i
                        best_rotated = rotated

        if best_free_idx < 0:
            return False

        fr = self.free_rects[best_free_idx]

        # Place the piece
        placed = Rect(piece.w, piece.h, piece.label, piece.piece_id)
        if best_rotated:
            placed.w, placed.h = piece.h, piece.w
            placed.rotated = True
        placed.x = fr.x
        placed.y = fr.y
        self.placed.append(placed)

        pw = placed.w + kerf
        ph = placed.h + kerf

        # Try BOTH split directions, pick the one that creates the larger max rect
        leftover_w = fr.w - pw
        leftover_h = fr.h - ph

        if leftover_w > 0 and leftover_h > 0:
            # Option A: horizontal split
            a1 = FreeRect(fr.x + pw, fr.y, leftover_w, ph)
            a2 = FreeRect(fr.x, fr.y + ph, fr.w, leftover_h)
            # Option B: vertical split
            b1 = FreeRect(fr.x + pw, fr.y, leftover_w, fr.h)
            b2 = FreeRect(fr.x, fr.y + ph, pw, leftover_h)

            max_a = max(a1.area, a2.area)
            max_b = max(b1.area, b2.area)

            if max_a >= max_b:
                new_rects = [a1, a2]
            else:
                new_rects = [b1, b2]
        elif leftover_w > 0:
            new_rects = [FreeRect(fr.x + pw, fr.y, leftover_w, fr.h)]
        elif leftover_h > 0:
            new_rects = [FreeRect(fr.x, fr.y + ph, fr.w, leftover_h)]
        else:
            new_rects = []

        # Remove the used free rect and add new ones
        self.free_rects.pop(best_free_idx)
        # Keep rects that can fit something useful (> 30mm)
        for nr in new_rects:
            if nr.w > 30 and nr.h > 30:
                self.free_rects.append(nr)
        # Sort free rects: smallest first (helps fill small gaps)
        self.free_rects.sort(key=lambda r: r.area)

        return True


def optimize_cutting(
    pieces: list[dict],
    sheet_width: float,
    sheet_height: float,
    kerf_mm: float = BLADE_KERF_MM,
) -> list[Sheet]:
    """Pack pieces into minimum sheets using guillotine bin packing.

    Args:
        pieces: list of {label, width, height, qty}  (in mm)
        sheet_width: sheet width in mm
        sheet_height: sheet height in mm
        kerf_mm: blade kerf in mm

    Returns:
        list of Sheet objects with placed pieces and coordinates
    """
    # Expand pieces by quantity
    all_pieces: list[Rect] = []
    for i, p in enumerate(pieces):
        for q in range(p["qty"]):
            label = f"{p['label']} #{q + 1}" if p["qty"] > 1 else p["label"]
            all_pieces.append(Rect(p["width"], p["height"], label, i))

    # Sort by area descending (largest first — better packing)
    all_pieces.sort(key=lambda r: r.area, reverse=True)

    sheets: list[Sheet] = []
    unplaced: list[Rect] = []

    for piece in all_pieces:
        # Try ALL existing sheets, pick the one with least waste after placement
        best_sheet_idx = -1
        best_waste = float("inf")

        for si, sheet in enumerate(sheets):
            # Check if piece can fit without actually placing
            can_fit = False
            for fr in sheet.free_rects:
                if (piece.w <= fr.w and piece.h <= fr.h) or (piece.h <= fr.w and piece.w <= fr.h):
                    can_fit = True
                    break
            if can_fit:
                # Estimate waste: prefer sheets that already have less remaining space
                remaining = sum(r.area for r in sheet.free_rects) - piece.area
                if remaining < best_waste:
                    best_waste = remaining
                    best_sheet_idx = si

        placed = False
        if best_sheet_idx >= 0:
            placed = sheets[best_sheet_idx].try_place(piece, kerf_mm)

        if not placed:
            # Try all sheets sequentially as fallback
            for sheet in sheets:
                if sheet.try_place(piece, kerf_mm):
                    placed = True
                    break

        if not placed:
            # Open a new sheet
            new_sheet = Sheet(sheet_width, sheet_height, len(sheets) + 1)
            if new_sheet.try_place(piece, kerf_mm):
                sheets.append(new_sheet)
            else:
                unplaced.append(piece)
                logger.warning("Piece %s (%s×%s) does not fit on sheet (%s×%s)",
                               piece.label, piece.w, piece.h, sheet_width, sheet_height)

    if unplaced:
        logger.warning("%d pieces could not fit on any sheet", len(unplaced))

    return sheets


# ── Main Calculation ──────────────────────────────────────────


def calculate_cutting_list(db: Session, data: dict) -> dict:
    """Calculate optimal sheet layout for a cutting list."""
    # Get material info
    material = db.query(RawMaterial).filter(RawMaterial.id == data["raw_material_id"]).first()
    if not material:
        raise NotFoundError("Raw Material")

    # Sheet dimensions are stored directly in mm
    sheet_length_mm = float(material.sheet_length) if material.sheet_length else None
    sheet_width_mm = float(material.sheet_width) if material.sheet_width else None

    if not sheet_length_mm or not sheet_width_mm:
        raise BadRequestError("Material has no sheet dimensions configured")

    # Validate pieces
    pieces = data["pieces"]
    if not pieces:
        raise BadRequestError("At least one piece is required")

    # Ensure all pieces have mm dimensions
    for i, p in enumerate(pieces):
        if p["width"] <= 0 or p["height"] <= 0:
            raise BadRequestError(f"Piece {i + 1} has invalid dimensions")
        if p["qty"] <= 0:
            raise BadRequestError(f"Piece {i + 1} has invalid quantity")
        if not p.get("label"):
            p["label"] = f"Piece {i + 1}"

    # Run optimization
    kerf = data.get("kerf_mm", BLADE_KERF_MM)
    sheets = optimize_cutting(pieces, sheet_length_mm, sheet_width_mm, kerf)

    # Calculate totals
    total_pieces = sum(p["qty"] for p in pieces)
    total_piece_area = sum(p["width"] * p["height"] * p["qty"] for p in pieces)
    sheet_area = sheet_length_mm * sheet_width_mm
    total_sheet_area = len(sheets) * sheet_area
    total_waste = total_sheet_area - total_piece_area
    waste_percent = (total_waste / total_sheet_area * 100) if total_sheet_area > 0 else 0

    # Cost
    cost_per_sheet = float(material.last_purchase_rate) if material.last_purchase_rate else 0
    total_cost = len(sheets) * cost_per_sheet
    waste_cost = round(waste_percent / 100 * total_cost, 2)

    # Stock check
    available_stock = float(material.current_stock) if material.current_stock else 0

    # Build response with per-sheet layouts
    sheet_layouts = []
    for sheet in sheets:
        placed_pieces = []
        for r in sheet.placed:
            placed_pieces.append({
                "label": r.label,
                "x": round(r.x, 1),
                "y": round(r.y, 1),
                "width": round(r.w, 1),
                "height": round(r.h, 1),
                "rotated": r.rotated,
                "piece_id": r.piece_id,
            })
        sheet_layouts.append({
            "sheet_num": sheet.sheet_num,
            "placed_pieces": placed_pieces,
            "piece_count": len(sheet.placed),
            "used_area_mm2": round(sheet.used_area, 1),
            "waste_area_mm2": round(sheet.waste_area, 1),
            "waste_percent": round(sheet.waste_percent, 1),
        })

    result = {
        "sheets": sheet_layouts,
        "summary": {
            "total_sheets": len(sheets),
            "total_pieces": total_pieces,
            "sheet_size_mm": {"width": int(sheet_length_mm), "height": int(sheet_width_mm)},
            "total_piece_area_mm2": round(total_piece_area, 1),
            "total_sheet_area_mm2": round(total_sheet_area, 1),
            "total_waste_mm2": round(total_waste, 1),
            "waste_percent": round(waste_percent, 1),
            "cost_per_sheet": cost_per_sheet,
            "total_cost": round(total_cost, 2),
            "waste_cost": round(waste_cost, 2),
            "available_stock": available_stock,
            "sufficient_stock": available_stock >= len(sheets),
            "material_name": material.name,
            "material_sku": material.sku,
            "kerf_mm": kerf,
        },
    }

    logger.info(
        "Cutting optimized: %d pieces → %d sheets (%.1f%% waste)",
        total_pieces, len(sheets), waste_percent,
    )
    return result


# ── Save / Retrieve Patterns ─────────────────────────────────


def _get_or_create_placeholder_project(db: Session, user: User) -> int:
    """Get or create the 'Contract Jobs' placeholder project for auto-WO from cut orders."""
    from app.models.client import Client
    from app.models.project import Project, ProjectStatus
    from app.services.numbering_service import generate_client_scoped_number

    # Find or create placeholder client
    client = db.query(Client).filter(Client.name == "Cutting Service Contractors").first()
    if not client:
        client = Client(
            name="Cutting Service Contractors",
            notes="Auto-created placeholder for contract cutting jobs",
        )
        db.add(client)
        db.flush()

    # Find or create placeholder project
    project = db.query(Project).filter(Project.name == "Contract Cutting Jobs").first()
    if not project:
        project_number = generate_client_scoped_number(db, client.name, Project.project_number, Project)
        project = Project(
            project_number=project_number,
            name="Contract Cutting Jobs",
            client_id=client.id,
            status=ProjectStatus.IN_PROGRESS,
            notes="Auto-created umbrella project for contract cutting orders",
            created_by=user.id,
        )
        db.add(project)
        db.flush()

    return project.id


def _get_or_create_placeholder_product(db: Session) -> int:
    """Get or create the 'Cutting Service' placeholder finished product."""
    from app.models.finished_product import FinishedProduct, ProductUnit

    product = db.query(FinishedProduct).filter(FinishedProduct.sku == "CUT-SERVICE").first()
    if not product:
        product = FinishedProduct(
            name="Cutting Service",
            sku="CUT-SERVICE",
            description="Auto-created placeholder product for cutting orders",
            unit=ProductUnit.PCS,
        )
        db.add(product)
        db.flush()
    return product.id


def _create_wo_for_cut_order(db: Session, cut_order: "CuttingPattern", user: User) -> int:
    """Auto-create a Work Order linked to a cut order."""
    from app.models.work_order import WorkOrder, WorkOrderItem, WOStatus
    from app.services.numbering_service import generate_number

    project_id = _get_or_create_placeholder_project(db, user)
    product_id = _get_or_create_placeholder_product(db)

    wo_number = generate_number(db, "WO", WorkOrder.wo_number, WorkOrder)
    notes_parts = [f"Auto-created from Cut Order {cut_order.cut_order_number}"]
    if cut_order.company_name:
        notes_parts.append(f"Contractor: {cut_order.company_name}")
    if cut_order.job_reference:
        notes_parts.append(f"Their Ref: {cut_order.job_reference}")

    wo = WorkOrder(
        wo_number=wo_number,
        project_id=project_id,
        created_by=user.id,
        status=WOStatus.APPROVED,  # auto-approved since cut plan already exists
        estimated_material_cost=cut_order.total_cost,
        notes=" | ".join(notes_parts),
        approved_by=user.id,
    )
    db.add(wo)
    db.flush()

    # Add a single line item with the placeholder product
    wo_item = WorkOrderItem(
        wo_id=wo.id,
        product_id=product_id,
        quantity=1,
    )
    db.add(wo_item)
    db.flush()

    logger.info("Auto-created %s for cut order %s", wo_number, cut_order.cut_order_number)
    return wo.id


def save_cutting_pattern(db: Session, data: dict, user: User) -> CuttingPattern:
    """Save a cutting calculation as a Cut Order. Auto-creates and links a Work Order."""
    from app.models.cutting import CutOrderStatus, JobType
    from app.services.numbering_service import generate_number

    job_type = data.get("job_type", "OWN")
    cut_order_number = generate_number(db, "CO", CuttingPattern.cut_order_number, CuttingPattern)

    pattern = CuttingPattern(
        cut_order_number=cut_order_number,
        product_id=data.get("product_id"),
        raw_material_id=data["raw_material_id"],
        product_type=data.get("label", ""),
        status=CutOrderStatus.PLANNED,
        product_length=0,
        product_height=0,
        product_depth=0,
        panels=data["pieces"],
        sheets_required=data["total_sheets"],
        total_panel_area=Decimal(str(data["total_piece_area_mm2"])),
        total_sheet_area=Decimal(str(data["total_sheet_area_mm2"])),
        wastage_area=Decimal(str(data["total_waste_mm2"])),
        wastage_percent=Decimal(str(data["waste_percent"])),
        cost_per_sheet=Decimal(str(data["cost_per_sheet"])),
        total_cost=Decimal(str(data["total_cost"])),
        job_type=JobType(job_type),
        company_name=data.get("company_name"),
        company_contact=data.get("company_contact"),
        company_phone=data.get("company_phone"),
        job_reference=data.get("job_reference"),
        notes=data.get("notes"),
        layout_result=data.get("layout_result"),
        created_by=user.id,
    )
    db.add(pattern)
    db.flush()  # get pattern.id without committing yet

    # Auto-create and link a Work Order (skip if wo_id already provided)
    if not data.get("wo_id"):
        wo_id = _create_wo_for_cut_order(db, pattern, user)
        pattern.wo_id = wo_id
    else:
        pattern.wo_id = data["wo_id"]

    db.commit()
    db.refresh(pattern)
    logger.info(
        "Cut Order %s created by %s (type=%s, wo_id=%s)",
        cut_order_number, user.full_name, job_type, pattern.wo_id,
    )
    return pattern


def get_cutting_pattern(db: Session, pattern_id: int) -> CuttingPattern:
    pattern = db.query(CuttingPattern).filter(CuttingPattern.id == pattern_id).first()
    if not pattern:
        raise NotFoundError("Cut Order")
    return pattern


def update_cut_order_status(db: Session, order_id: int, status: str, sheets_consumed: int | None = None) -> CuttingPattern:
    """Update cut order status. When CUTTING, material is being used. When COMPLETED, finalize."""
    from app.models.cutting import CutOrderStatus
    pattern = get_cutting_pattern(db, order_id)
    pattern.status = CutOrderStatus(status)

    if status == "COMPLETED":
        from datetime import datetime, timezone
        pattern.completed_at = datetime.now(timezone.utc)
        if sheets_consumed is not None:
            pattern.sheets_consumed = sheets_consumed

    if sheets_consumed is not None:
        pattern.sheets_consumed = sheets_consumed

    db.commit()
    db.refresh(pattern)
    logger.info("Cut Order %s → %s", pattern.cut_order_number, status)
    return pattern


def get_cut_orders(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    job_type: str | None = None,
    status: str | None = None,
    company_name: str | None = None,
    search: str | None = None,
) -> tuple[list[CuttingPattern], int]:
    """List cut orders with filters."""
    from sqlalchemy import or_
    query = db.query(CuttingPattern)

    if job_type:
        query = query.filter(CuttingPattern.job_type == job_type)
    if status:
        query = query.filter(CuttingPattern.status == status)
    if company_name:
        query = query.filter(CuttingPattern.company_name.ilike(f"%{company_name}%"))
    if search:
        query = query.filter(
            or_(
                CuttingPattern.cut_order_number.ilike(f"%{search}%"),
                CuttingPattern.product_type.ilike(f"%{search}%"),
                CuttingPattern.company_name.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    orders = (
        query.order_by(CuttingPattern.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return orders, total


def get_cut_order_stats(db: Session) -> dict:
    """Summary stats for cut orders — contract vs own, material usage, costs."""
    from sqlalchemy import func
    from app.models.cutting import CutOrderStatus, JobType

    # Total orders by type
    own_count = db.query(CuttingPattern).filter(CuttingPattern.job_type == JobType.OWN).count()
    contract_count = db.query(CuttingPattern).filter(CuttingPattern.job_type == JobType.CONTRACT).count()

    # Sheets used
    own_sheets = db.query(func.coalesce(func.sum(CuttingPattern.sheets_required), 0)).filter(
        CuttingPattern.job_type == JobType.OWN).scalar()
    contract_sheets = db.query(func.coalesce(func.sum(CuttingPattern.sheets_required), 0)).filter(
        CuttingPattern.job_type == JobType.CONTRACT).scalar()

    # Cost
    own_cost = db.query(func.coalesce(func.sum(CuttingPattern.total_cost), 0)).filter(
        CuttingPattern.job_type == JobType.OWN).scalar()
    contract_cost = db.query(func.coalesce(func.sum(CuttingPattern.total_cost), 0)).filter(
        CuttingPattern.job_type == JobType.CONTRACT).scalar()

    # Average wastage
    avg_wastage = db.query(func.coalesce(func.avg(CuttingPattern.wastage_percent), 0)).scalar()

    # By status
    planned = db.query(CuttingPattern).filter(CuttingPattern.status == CutOrderStatus.PLANNED).count()
    cutting = db.query(CuttingPattern).filter(CuttingPattern.status == CutOrderStatus.CUTTING).count()
    completed = db.query(CuttingPattern).filter(CuttingPattern.status == CutOrderStatus.COMPLETED).count()

    # Top contractors by orders
    top_contractors = (
        db.query(
            CuttingPattern.company_name,
            func.count(CuttingPattern.id).label("orders"),
            func.sum(CuttingPattern.sheets_required).label("sheets"),
            func.sum(CuttingPattern.total_cost).label("cost"),
        )
        .filter(CuttingPattern.job_type == JobType.CONTRACT, CuttingPattern.company_name.isnot(None))
        .group_by(CuttingPattern.company_name)
        .order_by(func.count(CuttingPattern.id).desc())
        .limit(10)
        .all()
    )

    return {
        "total_orders": own_count + contract_count,
        "own_orders": own_count,
        "contract_orders": contract_count,
        "own_sheets": int(own_sheets),
        "contract_sheets": int(contract_sheets),
        "total_sheets": int(own_sheets) + int(contract_sheets),
        "own_cost": float(own_cost),
        "contract_cost": float(contract_cost),
        "total_cost": float(own_cost) + float(contract_cost),
        "avg_wastage_percent": round(float(avg_wastage), 1),
        "by_status": {"planned": planned, "cutting": cutting, "completed": completed},
        "top_contractors": [
            {
                "company_name": c.company_name,
                "orders": c.orders,
                "sheets": int(c.sheets or 0),
                "cost": float(c.cost or 0),
            }
            for c in top_contractors
        ],
    }
