# PRP: DecoTrack

> Implementation blueprint for parallel agent execution — Inventory ERP for interior design manufacturing factories.

---

## METADATA

| Field | Value |
|-------|-------|
| **Product** | DecoTrack |
| **Type** | SaaS — Vertical ERP |
| **Version** | 1.0 |
| **Created** | 2026-04-02 |
| **Complexity** | High |
| **Modules** | 10 |
| **Models** | 26 |
| **Endpoints** | 78 |
| **Pages** | 52 |

---

## PRODUCT OVERVIEW

**Description:** DecoTrack is a full-stack Inventory ERP for interior design manufacturing factories. It manages the complete lifecycle of interior fitout projects — from raw material procurement and BOM-driven production tracking to photo-verified dispatch & delivery — governed by a multi-admin mobile approval workflow.

**Value Proposition:** Replaces WhatsApp-and-notebook chaos with a structured system that enforces approvals, tracks every gram of inventory with FIFO audit trails, and creates tamper-proof photo evidence of what left the factory and what arrived at site.

**Target User:** Interior decorators and factory owners running manufacturing units for custom interior fitouts in India.

**MVP Scope:**
- [x] JWT auth with Employee/Admin roles
- [x] Raw material inventory with FIFO batches, audit trail, reorder alerts
- [x] Vendor management with purchase history
- [x] Purchase orders with multi-admin approval (Gate 1)
- [x] GRN with quality check and auto-stock update
- [x] Client & project management (room-wise breakdown)
- [x] Finished products with BOM
- [x] Work orders with approval (Gate 2), BOM snapshot, auto-material-issue
- [x] Production stage tracking (configurable per category) with wastage logging
- [x] Dispatch with approval (Gate 3), factory + site photo verification
- [x] Driver delivery link (no-login, unique URL, photo upload)
- [x] Push notifications + escalation (4-hour cycle)
- [x] Role-specific dashboards + 9 reports
- [x] Auto-numbering, delivery challan PDF generation

---

## TECH STACK

| Layer | Technology | Skill Reference |
|-------|------------|-----------------|
| Backend | FastAPI + Python 3.11+ | skills/BACKEND.md |
| Frontend | React + TypeScript + Vite | skills/FRONTEND.md |
| Database | PostgreSQL + SQLAlchemy + Alembic | skills/DATABASE.md |
| Auth | JWT + bcrypt (Email/Password only) | skills/BACKEND.md |
| UI | Tailwind CSS + shadcn/ui | skills/FRONTEND.md |
| Photo Storage | S3-compatible (MinIO dev / AWS S3 prod) | skills/DEPLOYMENT.md |
| PDF | WeasyPrint or ReportLab | skills/BACKEND.md |
| Push Notifications | FCM / Web Push API | skills/BACKEND.md |
| Testing | pytest + React Testing Library + Vitest | skills/TESTING.md |
| Deployment | Docker + docker-compose | skills/DEPLOYMENT.md |

---

## DATABASE MODELS

### Model Inventory (26 models across 10 modules)

#### Module 1: Auth & Users
| Model | Key Fields | Relationships |
|-------|------------|---------------|
| **User** | id, email, hashed_password, full_name, phone, role (EMPLOYEE/ADMIN), is_active, is_verified, auto_approve_po_threshold, auto_approve_wo_threshold, created_at, updated_at | has_many: RefreshToken, Notification |
| **RefreshToken** | id, user_id (FK), token, expires_at, revoked | belongs_to: User |

#### Module 2: Inventory
| Model | Key Fields | Relationships |
|-------|------------|---------------|
| **ItemCategory** | id, name, description, created_at | has_many: RawMaterial |
| **RawMaterial** | id, category_id (FK), name, sku, description, unit (enum), current_stock (CHECK>=0), reorder_level, last_purchase_rate, hsn_code, gst_rate, is_active | belongs_to: ItemCategory; has_many: InventoryBatch, InventoryMovement, BOMItem |
| **InventoryBatch** | id, raw_material_id (FK), batch_number, received_date, quantity_received, quantity_remaining (CHECK>=0), purchase_rate, grn_id (FK) | belongs_to: RawMaterial, GRN |
| **InventoryMovement** | id, raw_material_id (FK), batch_id (FK), movement_type (enum), quantity, qty_before, qty_after, reference_type, reference_id, performed_by (FK), notes | belongs_to: RawMaterial, User |

#### Module 3: Vendors
| Model | Key Fields | Relationships |
|-------|------------|---------------|
| **Vendor** | id, name, contact_person, phone, email, address, city, state, gstin, supply_categories (text[]), payment_terms, notes, is_active | has_many: PurchaseOrder |

#### Module 4: Purchase & GRN
| Model | Key Fields | Relationships |
|-------|------------|---------------|
| **PurchaseOrder** | id, po_number (auto), vendor_id (FK), created_by (FK), status (enum: 8 states), total_amount, notes, rejection_reason, rejection_count, approved_by (FK), approved_at, submitted_at | belongs_to: Vendor, User; has_many: PurchaseOrderItem, GoodsReceivedNote |
| **PurchaseOrderItem** | id, po_id (FK), raw_material_id (FK), quantity, rate, amount, last_purchase_rate, current_stock, received_qty | belongs_to: PurchaseOrder, RawMaterial |
| **ApprovalLog** | id, entity_type (enum), entity_id, action (enum), performed_by (FK), comments, auto_approve_reason | belongs_to: User (polymorphic to PO/WO/Dispatch) |
| **GoodsReceivedNote** | id, grn_number (auto), po_id (FK), vendor_id (FK), received_by (FK), received_date, notes | belongs_to: PurchaseOrder, Vendor; has_many: GRNItem |
| **GRNItem** | id, grn_id (FK), po_item_id (FK), raw_material_id (FK), ordered_qty, received_qty, accepted_qty, rejected_qty, quality_status (enum), rejection_reason, rate | belongs_to: GRN, RawMaterial |

#### Module 5: Projects & Clients
| Model | Key Fields | Relationships |
|-------|------------|---------------|
| **Client** | id, name, phone, email, address, city, state, gstin, communication_log (jsonb), documents (jsonb), notes | has_many: Project |
| **Project** | id, project_number (auto), name, client_id (FK), site_address, city, status (enum: 5 states), estimated_cost, actual_cost, start_date, target_completion_date, created_by (FK) | belongs_to: Client; has_many: ProjectItem, WorkOrder, Dispatch |
| **ProjectItem** | id, project_id (FK), room, product_id (FK), quantity, status (enum: 5 states), notes | belongs_to: Project, FinishedProduct |

#### Module 6: Products & BOM
| Model | Key Fields | Relationships |
|-------|------------|---------------|
| **ProductCategory** | id, name, production_stages (text[]) | has_many: FinishedProduct |
| **FinishedProduct** | id, category_id (FK), name, sku, description, unit (enum) | belongs_to: ProductCategory; has_many: BOMItem |
| **BOMItem** | id, product_id (FK), raw_material_id (FK), quantity_per_unit, notes | belongs_to: FinishedProduct, RawMaterial |

#### Module 7: Work Orders & Production
| Model | Key Fields | Relationships |
|-------|------------|---------------|
| **WorkOrder** | id, wo_number (auto), project_id (FK), created_by (FK), status (enum: 7 states), estimated_material_cost, bom_snapshot (jsonb), notes, rejection_reason, rejection_count, approved_by (FK), approved_at | belongs_to: Project; has_many: WorkOrderItem, MaterialIssue, WastageLog |
| **WorkOrderItem** | id, wo_id (FK), product_id (FK), quantity, completed_count, status (enum) | belongs_to: WorkOrder; has_many: ProductionUnit |
| **ProductionUnit** | id, wo_item_id (FK), unit_number, current_stage, status (enum), started_at, completed_at | belongs_to: WorkOrderItem; has_many: ProductionStageLog |
| **ProductionStageLog** | id, production_unit_id (FK), stage_name, status (enum), started_at, completed_at, completed_by (FK), notes | belongs_to: ProductionUnit |
| **WastageLog** | id, production_unit_id (FK), wo_id (FK), raw_material_id (FK), stage_name, quantity, reason, logged_by (FK) | belongs_to: WorkOrder, RawMaterial |
| **MaterialIssue** | id, wo_id (FK), raw_material_id (FK), batch_id (FK), quantity_issued, issued_at, issued_by (FK) | belongs_to: WorkOrder, InventoryBatch |

#### Module 8: Dispatch & Delivery
| Model | Key Fields | Relationships |
|-------|------------|---------------|
| **Dispatch** | id, dispatch_number (auto), project_id (FK), created_by (FK), status (enum: 7 states), vehicle_number, driver_name, driver_phone, delivery_address, delivery_city, delivery_token, token_expires_at, token_used, approved_by (FK), loading_confirmed_at, delivery_confirmed_at, challan_url | belongs_to: Project; has_many: DispatchItem, DispatchPhoto |
| **DispatchItem** | id, dispatch_id (FK), project_item_id (FK), product_id (FK), product_name, quantity, factory_verified, notes | belongs_to: Dispatch |
| **DispatchPhoto** | id, dispatch_id (FK), dispatch_item_id (FK), checkpoint (FACTORY/SITE), item_reference, storage_url, thumbnail_url, captured_at, gps_lat, gps_lng, gps_available, uploaded_by (FK), uploaded_by_role (enum), file_size, original_filename, notes | belongs_to: Dispatch |
| **FinishedGoodInventory** | id, product_id (FK), project_id (FK), wo_id (FK), wo_item_id (FK), quantity (CHECK>=0), status (enum), completed_at | belongs_to: Project, WorkOrder |

#### Module 10: Notifications
| Model | Key Fields | Relationships |
|-------|------------|---------------|
| **Notification** | id, user_id (FK), type (enum: 6 types), title, message, entity_type, entity_id, is_read, channel (enum), sent_at, read_at | belongs_to: User |
| **EscalationTracker** | id, entity_type, entity_id, reminder_count, last_reminder_at, next_reminder_at, escalated, resolved, resolved_at | polymorphic to PO/WO/Dispatch |

### Database Constraints (Critical)
- `CHECK (current_stock >= 0)` on RawMaterial
- `CHECK (quantity_remaining >= 0)` on InventoryBatch
- `CHECK (quantity >= 0)` on FinishedGoodInventory
- `UNIQUE` on po_number, wo_number, grn_number, dispatch_number, delivery_token
- `INDEX` on all FK columns, status columns, and delivery_token
- All monetary fields use `Numeric(12, 2)`, never Float

---

## MODULES — DETAILED IMPLEMENTATION

### Module 1: Authentication & User Management
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/v1/auth/register | Create account | Admin only |
| POST | /api/v1/auth/login | Login, return JWT tokens | Public |
| POST | /api/v1/auth/refresh | Refresh access token | Public (refresh token) |
| POST | /api/v1/auth/logout | Revoke refresh token | Authenticated |
| GET | /api/v1/auth/me | Get current user profile | Authenticated |
| PUT | /api/v1/auth/me | Update own profile | Authenticated |
| GET | /api/v1/admin/users | List all users | Admin only |
| POST | /api/v1/admin/users | Create new user | Admin only |
| PUT | /api/v1/admin/users/{id} | Update/deactivate user | Admin only |
| PUT | /api/v1/admin/settings | Update auto-approve thresholds | Admin only |

**Frontend Pages:**
| Route | Page | Key Components |
|-------|------|----------------|
| /login | LoginPage | EmailInput, PasswordInput, LoginButton |
| /profile | ProfilePage | ProfileForm, PasswordChangeForm |
| /admin/users | UserManagementPage | UserTable, AddUserDialog, RoleBadge |

**Business Logic:**
- Passwords hashed with bcrypt (min 8 chars)
- Access token: 30 min, Refresh token: 7 days, HS256
- Role enum: EMPLOYEE, ADMIN
- Only admins can create/manage users

---

### Module 2: Raw Materials & Inventory
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/v1/categories | List item categories | Authenticated |
| POST | /api/v1/categories | Create category | Employee |
| PUT | /api/v1/categories/{id} | Update category | Employee |
| GET | /api/v1/raw-materials | List materials (paginated, filterable) | Authenticated |
| POST | /api/v1/raw-materials | Create raw material | Employee |
| GET | /api/v1/raw-materials/{id} | Get material detail | Authenticated |
| PUT | /api/v1/raw-materials/{id} | Update material | Employee |
| GET | /api/v1/raw-materials/{id}/stock | Stock with batch breakdown | Authenticated |
| GET | /api/v1/raw-materials/{id}/movements | Movement audit history | Authenticated |
| POST | /api/v1/raw-materials/{id}/adjust | Manual stock adjustment | Employee |
| GET | /api/v1/inventory/reorder-alerts | Items below reorder level | Authenticated |
| GET | /api/v1/inventory/summary | Full stock summary | Authenticated |

**Frontend Pages:**
| Route | Page | Key Components |
|-------|------|----------------|
| /inventory/materials | MaterialListPage | MaterialTable, CategoryFilter, SearchBar, StockBadge |
| /inventory/materials/new | MaterialCreatePage | MaterialForm, CategorySelect, UnitSelect |
| /inventory/materials/{id} | MaterialDetailPage | StockCard, BatchTable, MovementTimeline |
| /inventory/materials/{id}/edit | MaterialEditPage | MaterialForm (pre-filled) |
| /inventory/alerts | ReorderAlertPage | AlertCard, CreatePOButton (one-tap) |

**Business Logic (inventory_service.py):**
- FIFO consumption: `SELECT * FROM inventory_batches WHERE raw_material_id = ? AND quantity_remaining > 0 ORDER BY received_date ASC`
- Every stock change creates InventoryMovement record with qty_before/qty_after
- Reorder check: `current_stock <= reorder_level`
- Stock adjustment requires reason text

---

### Module 3: Vendor Management
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/v1/vendors | List vendors (paginated) | Authenticated |
| POST | /api/v1/vendors | Create vendor | Employee |
| GET | /api/v1/vendors/{id} | Get vendor detail | Authenticated |
| PUT | /api/v1/vendors/{id} | Update vendor | Employee |
| DELETE | /api/v1/vendors/{id} | Soft-delete vendor | Employee |
| GET | /api/v1/vendors/{id}/purchase-history | POs and GRNs for vendor | Authenticated |

**Frontend Pages:**
| Route | Page | Key Components |
|-------|------|----------------|
| /vendors | VendorListPage | VendorTable, SearchBar |
| /vendors/new | VendorCreatePage | VendorForm, GSTINInput |
| /vendors/{id} | VendorDetailPage | VendorCard, PurchaseHistoryTable |
| /vendors/{id}/edit | VendorEditPage | VendorForm (pre-filled) |

---

### Module 4: Purchase Orders & GRN
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/v1/purchase-orders | List POs (paginated, status filter) | Authenticated |
| POST | /api/v1/purchase-orders | Create PO | Employee |
| GET | /api/v1/purchase-orders/{id} | Get PO detail with items | Authenticated |
| PUT | /api/v1/purchase-orders/{id} | Update PO (DRAFT/REJECTED only) | Employee |
| DELETE | /api/v1/purchase-orders/{id} | Cancel PO (DRAFT only) | Employee |
| POST | /api/v1/purchase-orders/{id}/submit | Submit for approval | Employee |
| POST | /api/v1/purchase-orders/{id}/approve | Approve PO | Admin |
| POST | /api/v1/purchase-orders/{id}/reject | Reject with reason | Admin |
| POST | /api/v1/purchase-orders/{id}/resubmit | Resubmit after edit | Employee |
| POST | /api/v1/purchase-orders/{id}/mark-sent | Mark as sent to vendor | Employee |
| GET | /api/v1/grn | List GRNs | Authenticated |
| POST | /api/v1/grn | Create GRN (auto-updates stock) | Employee |
| GET | /api/v1/grn/{id} | GRN detail | Authenticated |
| GET | /api/v1/approvals | Approval inbox (all types) | Admin |
| GET | /api/v1/approvals/history | Approval log history | Admin |

**Frontend Pages:**
| Route | Page | Key Components |
|-------|------|----------------|
| /purchase-orders | POListPage | POTable, StatusFilter, StatusBadge |
| /purchase-orders/new | POCreatePage | VendorSelect, POLineItemTable (shows last_rate, current_stock), TotalSummary |
| /purchase-orders/{id} | PODetailPage | POHeader, LineItemTable, ApprovalTimeline, ApproveRejectButtons |
| /purchase-orders/{id}/edit | POEditPage | POCreatePage (pre-filled, for DRAFT/REJECTED) |
| /grn | GRNListPage | GRNTable |
| /grn/new | GRNCreatePage | POSelect, GRNLineItemTable (ordered vs received qty), QualityCheckRadio |
| /grn/{id} | GRNDetailPage | GRNHeader, ItemReceiptTable |
| /approvals | ApprovalInboxPage | ApprovalCard (type badge, details, approve/reject), BatchApproveButton |

**Business Logic (approval_service.py):**
```python
# Race condition handling — first write wins
async def approve_entity(db: Session, entity_type: str, entity_id: int, admin_id: int):
    # Use SELECT ... FOR UPDATE NOWAIT to lock the row
    entity = db.query(Model).filter(
        Model.id == entity_id,
        Model.status == "PENDING_APPROVAL"
    ).with_for_update(nowait=True).first()
    
    if not entity:
        raise HTTPException(409, "Already handled by another admin")
    
    entity.status = "APPROVED"
    entity.approved_by = admin_id
    entity.approved_at = datetime.utcnow()
    # ... log to ApprovalLog
```

**Auto-approve logic:**
```python
# Check if any admin's threshold covers this amount
async def check_auto_approve(db: Session, entity_type: str, amount: Decimal):
    admins = db.query(User).filter(User.role == "ADMIN", User.is_active == True).all()
    for admin in admins:
        threshold = getattr(admin, f"auto_approve_{entity_type}_threshold")
        if threshold and amount <= threshold:
            return admin  # Auto-approve as this admin
    return None
```

**GRN side effects (on create):**
1. Create InventoryBatch per accepted item
2. Update RawMaterial.current_stock += accepted_qty
3. Create InventoryMovement (GRN_IN) per item
4. Update RawMaterial.last_purchase_rate
5. Update PurchaseOrderItem.received_qty
6. If all PO items fully received → PO status = FULLY_RECEIVED
7. If partial → PO status = PARTIALLY_RECEIVED

---

### Module 5: Projects & Clients
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/v1/clients | List clients | Authenticated |
| POST | /api/v1/clients | Create client | Employee |
| GET | /api/v1/clients/{id} | Client detail | Authenticated |
| PUT | /api/v1/clients/{id} | Update client | Employee |
| GET | /api/v1/clients/{id}/projects | Client's projects | Authenticated |
| GET | /api/v1/projects | List projects (status filter) | Authenticated |
| POST | /api/v1/projects | Create project | Employee |
| GET | /api/v1/projects/{id} | Project detail | Authenticated |
| PUT | /api/v1/projects/{id} | Update project | Employee |
| GET | /api/v1/projects/{id}/items | Project items by room | Authenticated |
| GET | /api/v1/projects/{id}/cost-tracking | Material cost vs estimated | Authenticated |
| GET | /api/v1/projects/{id}/status | Item-wise progress | Authenticated |

**Frontend Pages:**
| Route | Page | Key Components |
|-------|------|----------------|
| /clients | ClientListPage | ClientTable, SearchBar |
| /clients/new | ClientCreatePage | ClientForm, GSTINInput |
| /clients/{id} | ClientDetailPage | ClientCard, ProjectHistoryTable, CommunicationLog |
| /projects | ProjectListPage | ProjectTable, StatusFilter, CostBadge |
| /projects/new | ProjectCreatePage | ClientSelect, RoomItemBuilder (add rooms → add products per room) |
| /projects/{id} | ProjectDetailPage | ProjectHeader, RoomAccordion (items per room with status), CostTracker, ProgressBar |
| /projects/{id}/edit | ProjectEditPage | RoomItemBuilder (pre-filled) |

---

### Module 6: Finished Products & BOM
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/v1/product-categories | List categories with stages | Authenticated |
| POST | /api/v1/product-categories | Create category | Employee |
| PUT | /api/v1/product-categories/{id} | Update category / stages | Employee |
| GET | /api/v1/finished-products | List products (category filter) | Authenticated |
| POST | /api/v1/finished-products | Create product | Employee |
| GET | /api/v1/finished-products/{id} | Product detail with BOM | Authenticated |
| PUT | /api/v1/finished-products/{id} | Update product | Employee |
| GET | /api/v1/finished-products/{id}/bom | Get BOM | Authenticated |
| PUT | /api/v1/finished-products/{id}/bom | Update BOM (bulk) | Employee |
| GET | /api/v1/finished-products/{id}/material-check | Check stock for N units | Authenticated |

**Frontend Pages:**
| Route | Page | Key Components |
|-------|------|----------------|
| /products | ProductListPage | ProductTable, CategoryTabs |
| /products/new | ProductCreatePage | ProductForm, CategorySelect |
| /products/{id} | ProductDetailPage | ProductCard, BOMTable (material, qty/unit, availability) |
| /products/{id}/edit | ProductEditPage | ProductForm (pre-filled) |
| /products/{id}/bom | BOMEditorPage | BOMLineTable, MaterialSearchAdd, QuantityInput |

**Production Stage Configurations (seeded per category):**
```
Kitchen Units:       [Cutting, Edging, Boring/Routing, Carcass Assembly, Shutter Prep, Hardware Fitment, QC]
Wardrobes/Storage:   [Cutting, Edging, Boring, Assembly, Finishing, Hardware Fitment, QC]
TV Units/Shelving:   [Cutting, Edging, Boring, Assembly, Finishing, QC]
Vanity/Bathroom:     [Cutting, Edging, Waterproof Treatment, Assembly, Hardware Fitment, QC]
Wall Paneling:       [Cutting, Surface Prep, Panel Mounting Prep, Finishing, QC]
False Ceiling:       [Framework Prep, Board Cutting, Finishing, QC]
Study/Work:          [Cutting, Edging, Boring, Assembly, Finishing, QC]
```

---

### Module 7: Work Orders & Production Tracking
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/v1/work-orders | List WOs (status filter) | Authenticated |
| POST | /api/v1/work-orders | Create WO | Employee |
| GET | /api/v1/work-orders/{id} | WO detail | Authenticated |
| PUT | /api/v1/work-orders/{id} | Update WO (DRAFT/REJECTED) | Employee |
| GET | /api/v1/work-orders/{id}/material-check | Material availability per item | Authenticated |
| POST | /api/v1/work-orders/{id}/submit | Submit for approval | Employee |
| POST | /api/v1/work-orders/{id}/approve | Approve (auto-issues materials) | Admin |
| POST | /api/v1/work-orders/{id}/reject | Reject with reason | Admin |
| GET | /api/v1/work-orders/{id}/production | Production progress | Authenticated |
| POST | /api/v1/production/{unit_id}/stage | Update stage (start/complete) | Employee |
| POST | /api/v1/production/{unit_id}/wastage | Log wastage | Employee |
| GET | /api/v1/work-orders/{id}/wastage | Wastage summary | Authenticated |
| GET | /api/v1/production | All active production | Authenticated |

**Frontend Pages:**
| Route | Page | Key Components |
|-------|------|----------------|
| /work-orders | WOListPage | WOTable, StatusFilter |
| /work-orders/new | WOCreatePage | ProjectSelect, ProductPicker, MaterialAvailabilityTable (green/red), DeficitAlert, CreatePOShortcut |
| /work-orders/{id} | WODetailPage | WOHeader, ProductList, MaterialCheckTable, ApprovalTimeline, BOMSnapshotView |
| /work-orders/{id}/edit | WOEditPage | WOCreatePage (pre-filled) |
| /work-orders/{id}/production | ProductionBoardPage | UnitCard per product (stage checkboxes), WastageLogButton, StageProgressBar |
| /production | ProductionOverviewPage | ActiveWOCards, StageKanban |

**WO Approval Side Effects (production_service.py):**
1. Freeze BOM snapshot → store as JSONB in `wo.bom_snapshot`
2. Calculate total materials needed across all WO items × BOM
3. Issue materials via FIFO:
   ```python
   for material_id, total_needed in materials_required.items():
       remaining = total_needed
       batches = db.query(InventoryBatch).filter(
           InventoryBatch.raw_material_id == material_id,
           InventoryBatch.quantity_remaining > 0
       ).order_by(InventoryBatch.received_date.asc()).all()
       
       for batch in batches:
           if remaining <= 0: break
           issue_qty = min(batch.quantity_remaining, remaining)
           batch.quantity_remaining -= issue_qty
           remaining -= issue_qty
           # Create MaterialIssue record
           # Create InventoryMovement (WO_ISSUE)
       
       # Update RawMaterial.current_stock
   ```
4. Create ProductionUnit records (e.g., 4 kitchen base units → 4 ProductionUnit rows)
5. Set each unit's stages from ProductCategory.production_stages

**QC Completion Side Effects:**
- When final stage (QC) marked complete for a unit → create FinishedGoodInventory entry
- When all units for a WO item complete → WOItem.status = COMPLETED, WOItem.completed_count = quantity
- When all WO items complete → WO.status = COMPLETED

---

### Module 8: Dispatch & Delivery (with Photo Verification)
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT + DEVOPS-AGENT

**Dispatch Status Flow:** `DRAFT → PENDING_APPROVAL → APPROVED → LOADING_VERIFICATION → IN_TRANSIT → DELIVERY_VERIFICATION → DELIVERED`

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/v1/dispatches | List dispatches (status filter) | Authenticated |
| POST | /api/v1/dispatches | Create dispatch | Employee |
| GET | /api/v1/dispatches/{id} | Dispatch detail + photos | Authenticated |
| PUT | /api/v1/dispatches/{id} | Update (DRAFT only) | Employee |
| GET | /api/v1/dispatches/by-project/{project_id} | FG ready per project | Authenticated |
| POST | /api/v1/dispatches/{id}/submit | Submit for approval | Employee |
| POST | /api/v1/dispatches/{id}/approve | Approve dispatch | Admin |
| POST | /api/v1/dispatches/{id}/reject | Reject dispatch | Admin |
| POST | /api/v1/dispatches/{id}/photos | Upload factory photo | Employee |
| POST | /api/v1/dispatches/{id}/verify-item/{item_id} | Verify item loaded | Employee |
| POST | /api/v1/dispatches/{id}/confirm-loading | Confirm loading complete | Employee |
| POST | /api/v1/dispatches/{id}/regenerate-link | Regenerate driver link | Employee |
| POST | /api/v1/dispatches/{id}/confirm-delivery | Confirm delivery | Employee |
| POST | /api/v1/dispatches/{id}/flag-delivery | Flag delivery issue | Employee |
| GET | /api/v1/delivery/{token} | Driver: get dispatch info | **Public** |
| POST | /api/v1/delivery/{token}/photos | Driver: upload photos | **Public** |
| POST | /api/v1/delivery/{token}/complete | Driver: mark delivered | **Public** |

**Frontend Pages:**
| Route | Page | Key Components |
|-------|------|----------------|
| /dispatches | DispatchListPage | DispatchTable, StatusFilter, ProjectGrouping |
| /dispatches/new | DispatchCreatePage | ProjectSelect, FGItemPicker, VehicleDriverForm |
| /dispatches/{id} | DispatchDetailPage | StatusStepper, PhotoTimeline (factory left / site right), GPSMapPins, ChallanDownload |
| /dispatches/{id}/loading | LoadingVerificationPage | ItemChecklist (checkbox + camera capture per item), TruckPhotoCapture, ConfirmLoadingButton (disabled until all done) |
| /delivery/{token} | **DriverDeliveryPage** (PUBLIC, no auth) | DeliveryItemList (read-only), PhotoUploadArea (camera capture, min 2), MarkDeliveredButton |

**Photo Upload Logic (storage_service.py):**
```python
async def upload_dispatch_photo(
    file: UploadFile,
    dispatch_id: int,
    checkpoint: str,  # FACTORY or SITE
    item_reference: str,
    gps_lat: float | None,
    gps_lng: float | None,
    uploaded_by: int | None,  # None for driver
    uploaded_by_role: str
) -> DispatchPhoto:
    # 1. Validate file is JPEG/PNG, size <= 2MB
    # 2. Generate S3 key: dispatches/{dispatch_id}/{checkpoint}/{uuid}.jpg
    # 3. Upload original to S3
    # 4. Generate thumbnail (200px width) via Pillow
    # 5. Upload thumbnail to S3
    # 6. Create DispatchPhoto record with metadata
```

**Loading Confirmation Side Effects (dispatch_service.py):**
1. Validate ALL dispatch items have factory_verified=True AND at least 1 photo each
2. Generate delivery challan PDF (pdf_service.py)
3. Upload challan to S3, store URL in dispatch.challan_url
4. Generate cryptographic delivery token: `secrets.token_urlsafe(32)`
5. Set token_expires_at = now + 48 hours
6. Deduct finished goods from FinishedGoodInventory
7. Create InventoryMovement records
8. Status → IN_TRANSIT
9. Return delivery URL for WhatsApp sharing: `{APP_BASE_URL}/delivery/{token}`

**Driver Delivery Page:**
- No auth required — secured by unguessable token
- Token validated: exists, not expired, not used, dispatch status is IN_TRANSIT
- Mobile-friendly: large buttons, camera capture via `<input type="file" accept="image/*" capture="environment">`
- Client-side photo compression: canvas resize to max 1200px width, JPEG quality 0.7
- GPS capture via `navigator.geolocation.getCurrentPosition()`
- Min 2 photos required before "Mark as Delivered" enables
- On mark delivered: status → DELIVERY_VERIFICATION, notify employee

---

### Module 9: Dashboard & Analytics
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/v1/dashboard/employee | Employee dashboard data | Employee |
| GET | /api/v1/dashboard/admin | Admin dashboard data | Admin |
| GET | /api/v1/reports/stock-summary | Stock by item, grouped by state | Authenticated |
| GET | /api/v1/reports/project-costs | Material cost per project | Authenticated |
| GET | /api/v1/reports/purchase-analytics | Spend per vendor/item/month | Authenticated |
| GET | /api/v1/reports/production-efficiency | WO times, stage cycles | Authenticated |
| GET | /api/v1/reports/wastage | Wastage by item/WO/stage | Authenticated |
| GET | /api/v1/reports/dispatch-log | Dispatches with photos/GPS | Authenticated |
| GET | /api/v1/reports/reorder-alerts | Items below threshold | Authenticated |
| GET | /api/v1/reports/audit-trail | Full movement history | Authenticated |
| GET | /api/v1/reports/approval-activity | Per-admin activity | Admin |

**Frontend Pages:**
| Route | Page | Key Components |
|-------|------|----------------|
| /dashboard | DashboardPage | RoleSwitch → EmployeeDashboard or AdminDashboard |
| — Employee | EmployeeDashboard | ReorderAlertWidget, PendingApprovalsWidget, ActiveWOsWidget, RecentGRNsWidget |
| — Admin | AdminDashboard | ApprovalInboxWidget, ProjectOverviewWidget, WOProgressWidget, StockSummaryWidget |
| /reports | ReportsHubPage | ReportCard grid (links to each report) |
| /reports/stock | StockReportPage | StockTable (available/WIP/FG), CategoryFilter |
| /reports/projects | ProjectCostReportPage | ProjectTable (estimated vs actual), CostChart |
| /reports/purchases | PurchaseAnalyticsPage | VendorSpendChart, ItemSpendTable, MonthlyTrendChart |
| /reports/production | ProductionReportPage | WOCompletionTable, StageCycleTimeChart |
| /reports/wastage | WastageReportPage | WastageTable (by item/WO/stage), WastagePercentChart |
| /reports/dispatches | DispatchLogPage | DispatchTable, PhotoThumbnails, GPSColumn |
| /reports/audit | AuditTrailPage | MovementTable (filterable by material/type/date/user) |
| /reports/approvals | ApprovalActivityPage | AdminTable (approvals, avg time, rejection rate) |

---

### Module 10: Notifications & Escalation
**Agents:** BACKEND-AGENT + FRONTEND-AGENT + DEVOPS-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/v1/notifications | User's notifications (paginated) | Authenticated |
| PUT | /api/v1/notifications/{id}/read | Mark as read | Authenticated |
| PUT | /api/v1/notifications/read-all | Mark all as read | Authenticated |
| POST | /api/v1/notifications/register-device | Register FCM device token | Authenticated |
| GET | /api/v1/notifications/unread-count | Unread count for badge | Authenticated |

**Frontend Components:**
| Component | Description |
|-----------|-------------|
| NotificationBell | Header icon with unread count badge |
| NotificationDropdown | Recent notifications list |
| NotificationPage (/notifications) | Full notification history |

**Notification Service (notification_service.py):**
```python
async def send_approval_request(entity_type: str, entity_id: int, details: dict):
    # 1. Get ALL active admins
    # 2. Create Notification record per admin (channel=PUSH + IN_APP)
    # 3. Send FCM push notification to each admin's registered devices
    # 4. Create EscalationTracker with next_reminder_at = now + 4 hours

async def run_escalation_check():
    # Background task (runs every 15 minutes)
    # 1. Find unresolved EscalationTrackers where next_reminder_at <= now
    # 2. If reminder_count < 3: send reminder push to all admins, increment count
    # 3. If reminder_count >= 3: send WhatsApp/SMS final escalation, mark escalated
```

---

## PHASE EXECUTION PLAN

### Phase 1: Foundation (4 agents in parallel)

**DATABASE-AGENT:**
- Create all 26 SQLAlchemy models with relationships, constraints, indexes
- Set up Alembic with initial migration
- Add CHECK constraints (qty >= 0), UNIQUE constraints, indexes
- Create enum types for all status fields
- Create auto-numbering sequences (PO/WO/GRN/DSP-YYYY-NNNN)
- Create seed data script with sample users, vendors, materials, products, BOMs, project

**BACKEND-AGENT:**
- Set up FastAPI project: main.py, config.py (pydantic-settings), database.py
- Create base schemas (pagination, error responses)
- Set up JWT auth middleware, role-based permission decorators
- Set up CORS, rate limiting, exception handlers
- Create logging configuration

**FRONTEND-AGENT:**
- Set up React + Vite + TypeScript project
- Install and configure Tailwind CSS + shadcn/ui
- Create base layout: Sidebar, Header (with NotificationBell), MainContent
- Set up React Router with protected routes and role-based guards
- Create auth context, API service layer (axios with JWT interceptor)
- Create shared components: DataTable, StatusBadge, INRFormat, SearchBar, Pagination
- Create shared utils: currency.ts (formatINR), date.ts (formatIST)

**DEVOPS-AGENT:**
- Create docker-compose.yml: PostgreSQL, MinIO (S3), FastAPI, React
- Create Dockerfiles for backend and frontend
- Create .env.example with all variables
- Set up MinIO bucket creation script
- Create GitHub Actions CI pipeline (lint + test + build)

**Validation Gate 1:**
```bash
pip install -r requirements.txt
alembic upgrade head
python scripts/seed.py
npm install
npm run build
docker-compose config
```

---

### Phase 2: Core Modules (backend + frontend per module, in dependency order)

**Wave 2A — Master Data (parallel, no dependencies):**
- Module 1: Auth — JWT login/register endpoints + Login/Profile pages
- Module 2: Inventory — Raw materials CRUD, batch tracking, audit trail + Material pages
- Module 3: Vendors — Vendor CRUD + Vendor pages

**Wave 2B — Products & Projects (parallel, depends on 2A):**
- Module 5: Clients & Projects — Client CRUD, Project with room/item builder + Pages
- Module 6: Products & BOM — Product catalog, BOM editor, material check + Pages

**Wave 2C — Transactional (sequential, depends on 2A + 2B):**
- Module 4: Purchase Orders & GRN — PO workflow, approval logic, GRN with auto-stock + Pages
- Approval system: Multi-admin approval service, race condition handling, auto-approve

**Wave 2D — Production (depends on 2C):**
- Module 7: Work Orders — WO workflow, BOM snapshot, FIFO material issue, production tracking + Pages

**Wave 2E — Dispatch (depends on 2D):**
- Module 8: Dispatch — Photo verification, delivery links, challan PDF + Pages (including public driver page)

**Wave 2F — Dashboard & Notifications (depends on all above):**
- Module 9: Dashboard — Role-specific dashboards, all 9 reports + Pages
- Module 10: Notifications — Push notifications, escalation service, notification UI

**Validation Gate 2:**
```bash
ruff check backend/
cd frontend && npm run lint && npm run type-check
# Manual: test each approval workflow end-to-end
```

---

### Phase 3: Quality (3 agents in parallel)

**TEST-AGENT:**
- Unit tests for all services (especially inventory_service, approval_service, production_service)
- Integration tests for all 3 approval workflows (PO, WO, Dispatch)
- Test race condition: concurrent approval attempts
- Test FIFO consumption correctness
- Test negative inventory prevention
- Test auto-numbering uniqueness
- Test delivery token security (expired, used, invalid)
- Test photo upload validation
- Frontend component tests (React Testing Library)
- Target: 80%+ backend coverage

**REVIEW-AGENT:**
- Security audit: auth, token handling, delivery link security, SQL injection, XSS
- Race condition review: approval locking, inventory deductions
- Data integrity: CHECK constraints, foreign keys, cascades
- API validation: all inputs validated, proper error responses
- Photo immutability: verify no delete/edit endpoints exist
- Performance review: N+1 queries, missing indexes, pagination

**DEVOPS-AGENT:**
- Final Docker build verification
- Health check endpoints (/health, /ready)
- S3 connectivity verification
- Database migration rollback testing

**Final Validation:**
```bash
pytest backend/tests -v --cov --cov-fail-under=80
cd frontend && npm test
docker-compose up -d
curl localhost:8000/health
curl localhost:8000/api/v1/docs  # OpenAPI docs
```

---

## VALIDATION GATES

| Gate | Phase | Commands | Pass Criteria |
|------|-------|----------|---------------|
| 1 | Foundation | `alembic upgrade head`, `python scripts/seed.py`, `npm run build`, `docker-compose config` | All succeed, seed data loads, build passes |
| 2 | Modules | `ruff check backend/`, `npm run lint`, `npm run type-check` | Zero lint errors, zero type errors |
| 3 | Quality | `pytest --cov --cov-fail-under=80`, `npm test` | 80%+ coverage, all tests pass |
| Final | Integration | `docker-compose up -d`, `curl localhost:8000/health`, `curl localhost:8000/api/v1/docs` | Containers healthy, API accessible |

---

## AUTO-NUMBERING IMPLEMENTATION

```python
# backend/app/services/numbering_service.py
from sqlalchemy import func

async def generate_document_number(db: Session, prefix: str, model) -> str:
    """Generate sequential document number: PREFIX-YYYY-NNNN"""
    current_year = datetime.now().year
    year_prefix = f"{prefix}-{current_year}-"
    
    last = db.query(model).filter(
        model.number_field.like(f"{year_prefix}%")
    ).order_by(model.number_field.desc()).first()
    
    if last:
        last_seq = int(last.number_field.split("-")[-1])
        next_seq = last_seq + 1
    else:
        next_seq = 1
    
    return f"{year_prefix}{next_seq:04d}"
```

---

## ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL=postgresql://decotrack:decotrack@localhost:5432/decotrack

# Auth
SECRET_KEY=change-this-in-production-use-openssl-rand
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# S3 / MinIO (photo storage)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=decotrack-photos
S3_REGION=ap-south-1

# Push Notifications
FCM_SERVER_KEY=your-fcm-server-key

# Application
APP_BASE_URL=http://localhost:5173
TIMEZONE=Asia/Kolkata

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## SEED DATA SCRIPT

```python
# backend/scripts/seed.py
# Creates:
# - 4 users: Ravi Kumar (Employee), Senthil/Priya/Kumar (Admins)
# - 8 vendors: Sri Lakshmi Plywood, Kumar Laminates, etc.
# - 9 item categories: Sheet Materials, Surface Finishes, Hardware, etc.
# - 26 raw materials with reorder levels and initial stock
# - 8 product categories with production stages
# - 7 finished products with BOMs
# - 1 sample project: "Sharma Residence — 3BHK, Adyar"
# - Project items across 6 rooms
```

---

## KEY IMPLEMENTATION NOTES

### Indian Locale
- All amounts: `Numeric(12, 2)` in DB, `Decimal` in Python, `formatINR()` in frontend
- Format: ₹1,23,456.00 (lakh/crore, not million/billion)
- Timezone: UTC storage, IST display (`Asia/Kolkata`)

### Photo Pipeline
- Client: compress to ~500KB (canvas 1200px, JPEG 0.7) → upload
- Server: validate → store original in S3 → generate 200px thumbnail → store metadata in DB
- Immutable: no DELETE endpoint for photos, ever

### Approval System
- `SELECT ... FOR UPDATE NOWAIT` for race condition
- ApprovalLog table is append-only — complete audit trail
- Auto-approve checks run before sending push notifications
- Escalation runs as background task every 15 minutes

### Delivery Link
- Token: `secrets.token_urlsafe(32)` — 43+ characters
- Public page: no auth, no cookies, stateless
- Single-use: after driver marks delivered OR 48-hour expiry
- Regenerable: employee can create new token (old one expires)

---

## NEXT STEP

Execute with parallel agents:
```bash
/execute-prp PRPs/decotrack-prp.md
```
