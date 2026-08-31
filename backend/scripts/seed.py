"""Seed script for DecoTrack development data."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from decimal import Decimal

from app.auth.jwt import hash_password
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.raw_material import ItemCategory, RawMaterial, MaterialUnit
from app.models.vendor import Vendor
from app.models.finished_product import ProductCategory, FinishedProduct, ProductUnit
from app.models.bom import BOMItem
from app.models.client import Client
from app.models.project import Project, ProjectStatus, ProjectItem


def seed():
    db = SessionLocal()

    try:
        # Check if already seeded
        if db.query(User).first():
            print("Database already seeded. Skipping.")
            return

        # ── USERS ──────────────────────────────────────────────
        users = [
            User(
                email="ravi@decotrack.in",
                hashed_password=hash_password("decotrack123"),
                full_name="Ravi Kumar",
                phone="9876543210",
                role=UserRole.EMPLOYEE,
                is_active=True,
                is_verified=True,
            ),
            User(
                email="senthil@decotrack.in",
                hashed_password=hash_password("decotrack123"),
                full_name="Senthil",
                phone="9876543211",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
                auto_approve_po_threshold=Decimal("25000.00"),
                auto_approve_wo_threshold=Decimal("50000.00"),
            ),
            User(
                email="priya@decotrack.in",
                hashed_password=hash_password("decotrack123"),
                full_name="Priya",
                phone="9876543212",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            ),
            User(
                email="kumar@decotrack.in",
                hashed_password=hash_password("decotrack123"),
                full_name="Kumar",
                phone="9876543213",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
                auto_approve_po_threshold=Decimal("15000.00"),
            ),
        ]
        db.add_all(users)
        db.flush()
        print(f"Created {len(users)} users")

        # ── VENDORS ────────────────────────────────────────────
        vendors = [
            Vendor(name="Sri Lakshmi Plywood", contact_person="Ramesh", phone="9800000001", city="Ambattur", state="Tamil Nadu", supply_categories=["Sheet Materials"]),
            Vendor(name="Kumar Laminates", contact_person="Suresh", phone="9800000002", city="Guindy", state="Tamil Nadu", supply_categories=["Surface Finishes"]),
            Vendor(name="National Hardware Traders", contact_person="Rajesh", phone="9800000003", city="Parrys", state="Tamil Nadu", supply_categories=["Hardware", "Fasteners"]),
            Vendor(name="Supreme Edge Band", contact_person="Vijay", phone="9800000004", city="Porur", state="Tamil Nadu", supply_categories=["Edge Materials"]),
            Vendor(name="Glass & Mirror Works", contact_person="Anand", phone="9800000005", city="T.Nagar", state="Tamil Nadu", supply_categories=["Glass/Mirrors"]),
            Vendor(name="Hettich India", contact_person="Sales Team", phone="9800000006", city="Chennai", state="Tamil Nadu", supply_categories=["Hardware"]),
            Vendor(name="Ebco Fittings", contact_person="Sales Team", phone="9800000007", city="Chennai", state="Tamil Nadu", supply_categories=["Hardware", "Accessories"]),
            Vendor(name="Godrej Locks", contact_person="Sales Team", phone="9800000008", city="Chennai", state="Tamil Nadu", supply_categories=["Hardware"]),
        ]
        db.add_all(vendors)
        db.flush()
        print(f"Created {len(vendors)} vendors")

        # ── ITEM CATEGORIES ───────────────────────────────────
        categories = {
            "Sheet Materials": ItemCategory(name="Sheet Materials", description="Plywood, MDF, HDHMR, particle board"),
            "Surface Finishes": ItemCategory(name="Surface Finishes", description="Laminates, acrylic, paint, veneer"),
            "Hardware": ItemCategory(name="Hardware", description="Hinges, slides, handles, fittings"),
            "Edge Materials": ItemCategory(name="Edge Materials", description="PVC and ABS edge banding"),
            "Fasteners": ItemCategory(name="Fasteners", description="Screws, cam locks, dowels, connectors"),
            "False Ceiling": ItemCategory(name="False Ceiling", description="Gypsum boards, grid, cornices"),
            "Glass/Mirrors": ItemCategory(name="Glass/Mirrors", description="Toughened, mirror, back-painted glass"),
            "Accessories": ItemCategory(name="Accessories", description="Basket units, pullouts, bins"),
            "Adhesives/Consumables": ItemCategory(name="Adhesives/Consumables", description="Fevicol, sealant, foam, primer"),
        }
        db.add_all(categories.values())
        db.flush()
        print(f"Created {len(categories)} item categories")

        # ── RAW MATERIALS ──────────────────────────────────────
        cat = {c.name: c for c in db.query(ItemCategory).all()}
        materials_data = [
            ("Plywood 18mm BWR", "PLY-18-BWR", cat["Sheet Materials"], MaterialUnit.SQM, 50, 10, 95),
            ("Plywood 12mm BWR", "PLY-12-BWR", cat["Sheet Materials"], MaterialUnit.SQM, 40, 10, 72),
            ("Plywood 8mm MR", "PLY-08-MR", cat["Sheet Materials"], MaterialUnit.SQM, 30, 10, 48),
            ("HDHMR 18mm", "HDHMR-18", cat["Sheet Materials"], MaterialUnit.SQM, 35, 8, 85),
            ("MDF 18mm", "MDF-18", cat["Sheet Materials"], MaterialUnit.SQM, 25, 8, 55),
            ("Laminate Greenlam 1mm", "LAM-GL-1", cat["Surface Finishes"], MaterialUnit.SQM, 100, 20, 120),
            ("Laminate Merino 1mm", "LAM-MR-1", cat["Surface Finishes"], MaterialUnit.SQM, 80, 20, 115),
            ("Acrylic Sheet 1mm", "ACR-1", cat["Surface Finishes"], MaterialUnit.SQM, 20, 5, 350),
            ("Soft-Close Hinge Hettich", "HNG-SC-HT", cat["Hardware"], MaterialUnit.PCS, 200, 50, 85),
            ("Cup Hinge Hettich", "HNG-CP-HT", cat["Hardware"], MaterialUnit.PCS, 300, 50, 45),
            ("Tandem Slide 500mm", "SLD-TN-500", cat["Hardware"], MaterialUnit.PAIR, 100, 20, 650),
            ("Drawer Channel 450mm", "SLD-DC-450", cat["Hardware"], MaterialUnit.PAIR, 80, 20, 180),
            ("PVC Edge Band 2mm", "EB-PVC-2", cat["Edge Materials"], MaterialUnit.M, 500, 100, 8),
            ("ABS Edge Band 1mm", "EB-ABS-1", cat["Edge Materials"], MaterialUnit.M, 400, 100, 12),
            ("Handle SS 6-inch", "HDL-SS-6", cat["Hardware"], MaterialUnit.PCS, 150, 30, 65),
            ("Knob Round", "KNB-RND", cat["Hardware"], MaterialUnit.PCS, 100, 20, 25),
            ("Push-to-Open", "PTO-FIT", cat["Hardware"], MaterialUnit.PCS, 60, 15, 120),
            ("Cam Lock", "FST-CAM", cat["Fasteners"], MaterialUnit.PCS, 500, 100, 8),
            ("Minifix", "FST-MFX", cat["Fasteners"], MaterialUnit.PCS, 400, 80, 12),
            ("Confirmat Screw", "FST-CFM", cat["Fasteners"], MaterialUnit.PCS, 1000, 200, 3),
            ("Dowel 8mm", "FST-DWL-8", cat["Fasteners"], MaterialUnit.PCS, 800, 200, 2),
            ("Fevicol SH", "ADH-FEV", cat["Adhesives/Consumables"], MaterialUnit.KG, 20, 5, 180),
            ("Silicon Sealant", "ADH-SIL", cat["Adhesives/Consumables"], MaterialUnit.PCS, 15, 5, 220),
            ("PU Foam", "ADH-PUF", cat["Adhesives/Consumables"], MaterialUnit.PCS, 10, 3, 350),
            ("Gypsum Board 12mm", "GYP-12", cat["False Ceiling"], MaterialUnit.SQM, 30, 10, 45),
            ("Ceiling Channel/Grid", "CLG-GRD", cat["False Ceiling"], MaterialUnit.M, 100, 20, 35),
        ]

        materials = {}
        for name, sku, category, unit, stock, reorder, rate in materials_data:
            m = RawMaterial(
                name=name,
                sku=sku,
                category_id=category.id,
                unit=unit,
                current_stock=Decimal(str(stock)),
                reorder_level=Decimal(str(reorder)),
                last_purchase_rate=Decimal(str(rate)),
            )
            db.add(m)
            materials[sku] = m
        db.flush()
        print(f"Created {len(materials)} raw materials")

        # ── PRODUCT CATEGORIES (with production stages) ───────
        prod_categories = {
            "Kitchen Units": ProductCategory(name="Kitchen Units", production_stages=["Cutting", "Edging", "Boring/Routing", "Carcass Assembly", "Shutter Prep", "Hardware Fitment", "QC"]),
            "Wardrobes/Storage": ProductCategory(name="Wardrobes/Storage", production_stages=["Cutting", "Edging", "Boring", "Assembly", "Finishing", "Hardware Fitment", "QC"]),
            "TV Units/Shelving": ProductCategory(name="TV Units/Shelving", production_stages=["Cutting", "Edging", "Boring", "Assembly", "Finishing", "QC"]),
            "Vanity/Bathroom": ProductCategory(name="Vanity/Bathroom", production_stages=["Cutting", "Edging", "Waterproof Treatment", "Assembly", "Hardware Fitment", "QC"]),
            "Wall Paneling": ProductCategory(name="Wall Paneling", production_stages=["Cutting", "Surface Prep", "Panel Mounting Prep", "Finishing", "QC"]),
            "False Ceiling": ProductCategory(name="False Ceiling", production_stages=["Framework Prep", "Board Cutting", "Finishing", "QC"]),
            "Study/Work": ProductCategory(name="Study/Work", production_stages=["Cutting", "Edging", "Boring", "Assembly", "Finishing", "QC"]),
            "Other": ProductCategory(name="Other", production_stages=["Cutting", "Assembly", "Finishing", "QC"]),
        }
        db.add_all(prod_categories.values())
        db.flush()
        print(f"Created {len(prod_categories)} product categories")

        # ── FINISHED PRODUCTS ─────────────────────────────────
        products = {
            "KBU-600": FinishedProduct(name="Kitchen Base Unit 600mm", sku="KBU-600", category_id=prod_categories["Kitchen Units"].id, unit=ProductUnit.PCS),
            "KWU-600": FinishedProduct(name="Kitchen Wall Unit 600mm", sku="KWU-600", category_id=prod_categories["Kitchen Units"].id, unit=ProductUnit.PCS),
            "WRD-3D": FinishedProduct(name="3-Door Sliding Wardrobe", sku="WRD-3D", category_id=prod_categories["Wardrobes/Storage"].id, unit=ProductUnit.PCS),
            "TVU-BP": FinishedProduct(name="TV Unit with Back Panel", sku="TVU-BP", category_id=prod_categories["TV Units/Shelving"].id, unit=ProductUnit.PCS),
            "VAN-UT": FinishedProduct(name="Bathroom Vanity Unit", sku="VAN-UT", category_id=prod_categories["Vanity/Bathroom"].id, unit=ProductUnit.PCS),
            "WPM-SQM": FinishedProduct(name="Wall Panel Module (per sqm)", sku="WPM-SQM", category_id=prod_categories["Wall Paneling"].id, unit=ProductUnit.SQM),
            "STD-TBL": FinishedProduct(name="Study Table", sku="STD-TBL", category_id=prod_categories["Study/Work"].id, unit=ProductUnit.PCS),
            "KTU-600": FinishedProduct(name="Kitchen Tall Unit 600mm", sku="KTU-600", category_id=prod_categories["Kitchen Units"].id, unit=ProductUnit.PCS),
            "WRD-2DH": FinishedProduct(name="2-Door Hinged Wardrobe", sku="WRD-2DH", category_id=prod_categories["Wardrobes/Storage"].id, unit=ProductUnit.PCS),
            "TVU-FLT": FinishedProduct(name="Floating TV Console", sku="TVU-FLT", category_id=prod_categories["TV Units/Shelving"].id, unit=ProductUnit.PCS),
            "VAN-MC": FinishedProduct(name="Bathroom Mirror Cabinet", sku="VAN-MC", category_id=prod_categories["Vanity/Bathroom"].id, unit=ProductUnit.PCS),
            "WPM-3D": FinishedProduct(name="3D Wall Panel Module (per sqm)", sku="WPM-3D", category_id=prod_categories["Wall Paneling"].id, unit=ProductUnit.SQM),
            "GFC-SQM": FinishedProduct(name="Gypsum False Ceiling (per sqm)", sku="GFC-SQM", category_id=prod_categories["False Ceiling"].id, unit=ProductUnit.SQM),
            "OFC-DSK": FinishedProduct(name="Office Workstation Desk", sku="OFC-DSK", category_id=prod_categories["Study/Work"].id, unit=ProductUnit.PCS),
            "POJ-UT": FinishedProduct(name="Pooja Unit / Mandir", sku="POJ-UT", category_id=prod_categories["Other"].id, unit=ProductUnit.PCS),
        }
        db.add_all(products.values())
        db.flush()
        print(f"Created {len(products)} finished products")

        # ── BOMs ──────────────────────────────────────────────
        bom_data = [
            # Kitchen Base Unit 600mm
            ("KBU-600", "PLY-18-BWR", 2), ("KBU-600", "HDHMR-18", 1), ("KBU-600", "LAM-GL-1", 3),
            ("KBU-600", "HNG-CP-HT", 4), ("KBU-600", "SLD-TN-500", 1), ("KBU-600", "HDL-SS-6", 1),
            ("KBU-600", "EB-PVC-2", 6), ("KBU-600", "FST-CAM", 8), ("KBU-600", "FST-MFX", 4),
            # Kitchen Wall Unit 600mm
            ("KWU-600", "PLY-18-BWR", 1.5), ("KWU-600", "LAM-GL-1", 2),
            ("KWU-600", "HNG-CP-HT", 2), ("KWU-600", "HDL-SS-6", 1), ("KWU-600", "EB-PVC-2", 4),
            # 3-Door Sliding Wardrobe
            ("WRD-3D", "PLY-18-BWR", 6), ("WRD-3D", "PLY-12-BWR", 2), ("WRD-3D", "LAM-GL-1", 10),
            ("WRD-3D", "HNG-SC-HT", 6), ("WRD-3D", "HDL-SS-6", 3), ("WRD-3D", "EB-PVC-2", 18),
            ("WRD-3D", "SLD-DC-450", 2),
            # TV Unit with Back Panel
            ("TVU-BP", "PLY-18-BWR", 2), ("TVU-BP", "PLY-08-MR", 1), ("TVU-BP", "LAM-GL-1", 4),
            ("TVU-BP", "PTO-FIT", 4), ("TVU-BP", "EB-PVC-2", 8),
            # Bathroom Vanity Unit
            ("VAN-UT", "HDHMR-18", 1.5), ("VAN-UT", "LAM-GL-1", 2),
            ("VAN-UT", "HNG-SC-HT", 2), ("VAN-UT", "HDL-SS-6", 2), ("VAN-UT", "EB-PVC-2", 4),
            # Wall Panel Module (per sqm)
            ("WPM-SQM", "PLY-08-MR", 1), ("WPM-SQM", "LAM-GL-1", 1.2), ("WPM-SQM", "EB-PVC-2", 2),
            # Study Table
            ("STD-TBL", "PLY-18-BWR", 1.5), ("STD-TBL", "LAM-GL-1", 2.5), ("STD-TBL", "EB-PVC-2", 5),
            ("STD-TBL", "SLD-DC-450", 1), ("STD-TBL", "HDL-SS-6", 2),
            # Kitchen Tall Unit 600mm
            ("KTU-600", "PLY-18-BWR", 3), ("KTU-600", "HDHMR-18", 1), ("KTU-600", "LAM-GL-1", 5),
            ("KTU-600", "HNG-CP-HT", 6), ("KTU-600", "SLD-TN-500", 2), ("KTU-600", "HDL-SS-6", 1),
            ("KTU-600", "EB-PVC-2", 10), ("KTU-600", "FST-CAM", 12), ("KTU-600", "FST-MFX", 6),
            # 2-Door Hinged Wardrobe
            ("WRD-2DH", "PLY-18-BWR", 4), ("WRD-2DH", "PLY-12-BWR", 1), ("WRD-2DH", "LAM-GL-1", 7),
            ("WRD-2DH", "HNG-SC-HT", 4), ("WRD-2DH", "HDL-SS-6", 2), ("WRD-2DH", "EB-PVC-2", 12),
            # Floating TV Console
            ("TVU-FLT", "PLY-18-BWR", 1.5), ("TVU-FLT", "LAM-MR-1", 3), ("TVU-FLT", "PTO-FIT", 2),
            ("TVU-FLT", "EB-ABS-1", 6),
            # Bathroom Mirror Cabinet
            ("VAN-MC", "HDHMR-18", 1), ("VAN-MC", "ACR-1", 1), ("VAN-MC", "HNG-SC-HT", 2),
            ("VAN-MC", "KNB-RND", 2), ("VAN-MC", "EB-PVC-2", 3),
            # 3D Wall Panel Module (per sqm)
            ("WPM-3D", "MDF-18", 1), ("WPM-3D", "LAM-MR-1", 1), ("WPM-3D", "ADH-FEV", 0.2),
            # Gypsum False Ceiling (per sqm)
            ("GFC-SQM", "GYP-12", 1), ("GFC-SQM", "CLG-GRD", 1.2), ("GFC-SQM", "FST-DWL-8", 4),
            # Office Workstation Desk
            ("OFC-DSK", "PLY-18-BWR", 2), ("OFC-DSK", "LAM-GL-1", 3), ("OFC-DSK", "SLD-DC-450", 1),
            ("OFC-DSK", "HDL-SS-6", 1), ("OFC-DSK", "EB-PVC-2", 6), ("OFC-DSK", "FST-CFM", 6),
            # Pooja Unit / Mandir
            ("POJ-UT", "PLY-18-BWR", 1), ("POJ-UT", "MDF-18", 0.5), ("POJ-UT", "LAM-MR-1", 2),
            ("POJ-UT", "ACR-1", 0.5), ("POJ-UT", "HDL-SS-6", 1), ("POJ-UT", "EB-ABS-1", 3),
        ]

        # Refresh materials from DB to get IDs
        all_materials = {m.sku: m for m in db.query(RawMaterial).all()}
        all_products = {p.sku: p for p in db.query(FinishedProduct).all()}

        for prod_sku, mat_sku, qty in bom_data:
            db.add(BOMItem(
                product_id=all_products[prod_sku].id,
                raw_material_id=all_materials[mat_sku].id,
                quantity_per_unit=Decimal(str(qty)),
            ))
        db.flush()
        print(f"Created {len(bom_data)} BOM entries")

        # ── SAMPLE CLIENT & PROJECT ───────────────────────────
        client = Client(
            name="Mr. Sharma",
            phone="9876500000",
            email="sharma@email.com",
            address="42, 3rd Cross Street, Adyar",
            city="Chennai",
            state="Tamil Nadu",
        )
        db.add(client)
        db.flush()

        project = Project(
            project_number="PRJ-2026-0001",
            name="Sharma Residence — 3BHK, Adyar",
            client_id=client.id,
            site_address="42, 3rd Cross Street, Adyar, Chennai 600020",
            city="Chennai",
            status=ProjectStatus.PLANNING,
            estimated_cost=Decimal("850000.00"),
            created_by=users[0].id,
        )
        db.add(project)
        db.flush()

        project_items = [
            # Kitchen
            ProjectItem(project_id=project.id, room="Kitchen", product_id=all_products["KBU-600"].id, quantity=4),
            ProjectItem(project_id=project.id, room="Kitchen", product_id=all_products["KWU-600"].id, quantity=3),
            # Master Bedroom
            ProjectItem(project_id=project.id, room="Master Bedroom", product_id=all_products["WRD-3D"].id, quantity=1),
            ProjectItem(project_id=project.id, room="Master Bedroom", product_id=all_products["TVU-BP"].id, quantity=1),
            # Living Room
            ProjectItem(project_id=project.id, room="Living Room", product_id=all_products["TVU-BP"].id, quantity=1),
            ProjectItem(project_id=project.id, room="Living Room", product_id=all_products["WPM-SQM"].id, quantity=12),
            # Kids Room
            ProjectItem(project_id=project.id, room="Kids Room", product_id=all_products["WRD-3D"].id, quantity=1),
            ProjectItem(project_id=project.id, room="Kids Room", product_id=all_products["STD-TBL"].id, quantity=1),
            # Bathrooms
            ProjectItem(project_id=project.id, room="Bathroom 1", product_id=all_products["VAN-UT"].id, quantity=1),
            ProjectItem(project_id=project.id, room="Bathroom 2", product_id=all_products["VAN-UT"].id, quantity=1),
        ]
        db.add_all(project_items)
        db.flush()
        print(f"Created sample project with {len(project_items)} items")

        db.commit()
        print("\nSeed completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
