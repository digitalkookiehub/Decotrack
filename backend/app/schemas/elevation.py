from pydantic import BaseModel


class ElevationRequest(BaseModel):
    product_type: str  # cupboard, kitchen_cabinet, tv_unit, bookshelf, study_table, shoe_rack
    width: float       # mm
    height: float      # mm
    depth: float       # mm
    material_thickness: float = 18  # mm
    doors: int = 0
    drawers: int = 0
    shelves: int = 2
    partitions: int = 0
    back_panel: bool = True
    # Kitchen cabinet specific
    cabinet_type: str = "base"  # base, wall, tall
    # Shoe rack specific
    tilted_shelves: bool = False
    # Study table specific
    keyboard_tray: bool = False


class PieceItem(BaseModel):
    label: str
    length: float
    width: float
    quantity: int


class ElevationResponse(BaseModel):
    front_view_svg: str
    side_view_svg: str
    pieces: list[PieceItem]
    summary: dict
