# INITIAL.md - DecoTrack Product Definition

> Inventory ERP for interior design manufacturing factories — managing end-to-end project execution from raw material procurement and shop floor production tracking to photo-verified site delivery, with real-time inventory control and mobile admin approvals.

---

## PRODUCT

### Name
DecoTrack

### Description
DecoTrack is a full-stack Inventory ERP system built for interior design manufacturing factories. It manages the complete lifecycle of interior fitout projects — modular kitchens, wardrobes, TV units, vanity units, crockery units, shoe racks, study tables, wall paneling, false ceilings, and custom interior elements. The system covers raw material procurement with vendor management, BOM-driven production tracking on the shop floor, FIFO inventory control, and photo-verified dispatch & delivery — all governed by a multi-admin mobile approval workflow.

### Target User
Interior decorators and factory owners who run manufacturing units producing custom interior fitouts. Primarily small-to-medium factory operations in India.

### Type
- [x] SaaS (Software as a Service) — Vertical ERP

---

## TECH STACK

### Backend
- [x] FastAPI + Python 3.11+

### Frontend
- [x] React + Vite + TypeScript

### Database
- [x] PostgreSQL + SQLAlchemy

### Authentication
- [x] Email/Password only (JWT-based)

### UI Framework
- [x] Tailwind CSS + shadcn/ui

### Payments
- [ ] No payment processing needed

### File Storage
- [x] S3-compatible object storage (AWS S3 / MinIO / Cloudflare R2) for dispatch photos

### Notifications
- [x] Push notifications (FCM/Web Push) for admin approvals
- [x] WhatsApp Business API for driver delivery links

---

## USERS AND ROLES

### Role 1: Employee
- Runs daily operations on desktop/tablet at factory
- Creates all data, performs all operations
- Single employee user in the system
- Cannot approve/reject — only submit for approval

### Role 2: Admin
- Approves or rejects 3 things: Purchase Orders, Work Orders (production start), Dispatch
- Gets push notifications on phone, taps approve/reject
- Multiple admins (factory owner, business partner, operations manager)
- First-come-first-serve approval — any available admin can act
- Can view read-only dashboard, reports, dispatch photo timeline
- Can manage user accounts (add/remove admins, edit employee)
- Each admin can set personal auto-approve thresholds

### Role 3: Driver (No Login)
- Interacts via one-time unique URL sent via WhatsApp
- Can only: view dispatch item list, upload delivery photos, mark as delivered
- No access to any other part of the ERP

### Multi-Admin Approval Rules
- Push notification goes to ALL admins simultaneously
- Any one admin can approve or reject — no specific assignment
- Once one admin acts, the item is locked — other admins see "Approved/Rejected by [name]"
- Race condition handling: first database write wins
- Approval log records which admin acted and when
- Escalation: if no action within 4 hours, reminder to ALL admins. After 3 reminders, WhatsApp/SMS escalation
- Rejection requires a reason; employee can edit and resubmit; full history preserved

---

## MODULES

### Module 1: Authentication & User Management

**Description:** JWT-based email/password authentication with role-based access control (Employee, Admin). Admin user management.

**Models:**
```
User:
  - id, email, hashed_password, full_name, phone
  - role: enum (EMPLOYEE, ADMIN)
  - is_active, is_verified
  - auto_approve_po_threshold: decimal (nullable, admin only)
  - auto_approve_wo_threshold: decimal (nullable, admin only)
  - created_at, updated_at

RefreshToken:
  - id, user_id (FK), token, expires_at, revoked
```

**API Endpoints:**
- POST /api/v1/auth/register — Create new account (admin-only action)
- POST /api/v1/auth/login — Login with email/password
- POST /api/v1/auth/refresh — Refresh access token
- POST /api/v1/auth/logout — Revoke refresh token
- GET /api/v1/auth/me — Get current user profile
- PUT /api/v1/auth/me — Update profile
- GET /api/v1/admin/users — List all users (admin only)
- POST /api/v1/admin/users — Create user (admin only)
- PUT /api/v1/admin/users/{id} — Update user / deactivate (admin only)
- PUT /api/v1/admin/settings — Update auto-approve thresholds (admin only)

**Frontend Pages:**
- /login — Login page
- /profile — User profile page (protected)
- /admin/users — User management (admin only)

---

### Module 2: Raw Materials & Inventory

**Description:** Master data for raw materials with category management, unit tracking, reorder levels, and real-time stock tracking with FIFO batch management. Every inventory movement is audit-logged.

**Models:**
```
ItemCategory:
  - id, name (Sheet Materials, Surface Finishes, Hardware, Edge Materials,
    Fasteners, False Ceiling, Glass/Mirrors, Accessories, Adhesives/Consumables)
  - description, created_at

RawMaterial:
  - id, category_id (FK)
  - name, sku, description
  - unit: enum (pcs, sqm, m, kg, pair, litre, set)
  - current_stock: decimal (CHECK >= 0)
  - reorder_level: decimal
  - last_purchase_rate: decimal
  - hsn_code, gst_rate
  - is_active, created_at, updated_at

InventoryBatch:
  - id, raw_material_id (FK)
  - batch_number, received_date
  - quantity_received, quantity_remaining: decimal (CHECK >= 0)
  - purchase_rate, grn_id (FK)
  - created_at

InventoryMovement:
  - id, raw_material_id (FK), batch_id (FK, nullable)
  - movement_type: enum (GRN_IN, WO_ISSUE, WO_RETURN, ADJUSTMENT, WASTAGE)
  - quantity: decimal (positive for in, negative for out)
  - qty_before, qty_after: decimal
  - reference_type, reference_id (polymorphic link to GRN/WO/etc.)
  - performed_by: user_id (FK)
  - notes, created_at
```

**API Endpoints:**
- CRUD /api/v1/categories — Item categories
- CRUD /api/v1/raw-materials — Raw materials master
- GET /api/v1/raw-materials/{id}/stock — Stock details with batch breakdown
- GET /api/v1/raw-materials/{id}/movements — Movement history
- POST /api/v1/raw-materials/{id}/adjust — Stock adjustment (with reason)
- GET /api/v1/inventory/reorder-alerts — Items below reorder level
- GET /api/v1/inventory/summary — Stock summary report

**Frontend Pages:**
- /inventory/materials — Raw material list with search, filter by category
- /inventory/materials/new — Add new material
- /inventory/materials/{id} — Material detail with stock history, batch breakdown
- /inventory/materials/{id}/edit — Edit material
- /inventory/alerts — Reorder alerts with one-tap PO creation

---

### Module 3: Vendor Management

**Description:** Vendor master data with contact info, supply categories, and purchase history tracking.

**Models:**
```
Vendor:
  - id, name, contact_person, phone, email
  - address, city, state, gstin
  - supply_categories: text[] (what they supply)
  - payment_terms, notes
  - is_active, created_at, updated_at
```

**API Endpoints:**
- CRUD /api/v1/vendors
- GET /api/v1/vendors/{id}/purchase-history — POs and GRNs for this vendor

**Frontend Pages:**
- /vendors — Vendor list
- /vendors/new — Add vendor
- /vendors/{id} — Vendor detail with purchase history
- /vendors/{id}/edit — Edit vendor

---

### Module 4: Purchase Orders & GRN

**Description:** Purchase order creation with admin approval workflow, and Goods Received Notes for material intake. PO approval is the first approval gate.

**Models:**
```
PurchaseOrder:
  - id, po_number (auto: PO-YYYY-NNNN)
  - vendor_id (FK), created_by (FK)
  - status: enum (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, SENT_TO_VENDOR,
    PARTIALLY_RECEIVED, FULLY_RECEIVED, CANCELLED)
  - total_amount: decimal
  - notes, rejection_reason, rejection_count
  - approved_by (FK, nullable), approved_at
  - submitted_at, created_at, updated_at

PurchaseOrderItem:
  - id, po_id (FK), raw_material_id (FK)
  - quantity, rate, amount
  - last_purchase_rate (snapshot at creation time)
  - current_stock (snapshot at creation time)
  - received_qty (tracks partial receipts)

ApprovalLog:
  - id, entity_type: enum (PURCHASE_ORDER, WORK_ORDER, DISPATCH)
  - entity_id, action: enum (SUBMITTED, APPROVED, REJECTED, AUTO_APPROVED, RESUBMITTED)
  - performed_by (FK), comments
  - auto_approve_reason (nullable)
  - created_at

GoodsReceivedNote:
  - id, grn_number (auto: GRN-YYYY-NNNN)
  - po_id (FK), vendor_id (FK), received_by (FK)
  - received_date, notes, created_at

GRNItem:
  - id, grn_id (FK), po_item_id (FK), raw_material_id (FK)
  - ordered_qty, received_qty, accepted_qty, rejected_qty
  - quality_status: enum (ACCEPTED, PARTIAL, REJECTED)
  - rejection_reason, rate
```

**API Endpoints:**
- CRUD /api/v1/purchase-orders
- POST /api/v1/purchase-orders/{id}/submit — Submit for approval
- POST /api/v1/purchase-orders/{id}/approve — Admin approve
- POST /api/v1/purchase-orders/{id}/reject — Admin reject (with reason)
- POST /api/v1/purchase-orders/{id}/resubmit — Employee resubmit after edit
- POST /api/v1/purchase-orders/{id}/mark-sent — Mark as sent to vendor
- CRUD /api/v1/grn — Goods received notes
- POST /api/v1/grn — Create GRN (auto-updates inventory, PO status, last purchase rate)
- GET /api/v1/approvals — Approval inbox for admins (all entity types)
- GET /api/v1/approvals/history — Approval log history

**Frontend Pages:**
- /purchase-orders — PO list with status filters
- /purchase-orders/new — Create PO (vendor select, add line items with stock & rate reference)
- /purchase-orders/{id} — PO detail with approval history
- /purchase-orders/{id}/edit — Edit PO (draft or rejected)
- /grn — GRN list
- /grn/new?po={id} — Create GRN against a PO
- /grn/{id} — GRN detail

**Admin Mobile Pages:**
- /approvals — Approval inbox (cards with approve/reject buttons)

---

### Module 5: Projects & Clients

**Description:** Project-based business management. Everything is project-driven — a single project contains multiple interior elements across rooms. Clients are linked to projects.

**Models:**
```
Client:
  - id, name, phone, email
  - address, city, state
  - gstin (nullable)
  - communication_log: jsonb (notes, calls, messages)
  - documents: jsonb (file references)
  - notes, created_at, updated_at

Project:
  - id, project_number (auto: PRJ-YYYY-NNNN)
  - name (e.g., "Sharma Residence — 3BHK Interior")
  - client_id (FK)
  - site_address, city
  - status: enum (PLANNING, IN_PROGRESS, COMPLETED, ON_HOLD, CANCELLED)
  - estimated_cost, actual_cost
  - start_date, target_completion_date, actual_completion_date
  - notes, created_by (FK)
  - created_at, updated_at

ProjectItem:
  - id, project_id (FK)
  - room: string (Kitchen, Master Bedroom, Living Room, etc.)
  - product_id (FK to FinishedProduct)
  - quantity
  - status: enum (PENDING, IN_PRODUCTION, COMPLETED, DISPATCHED, DELIVERED)
  - notes
```

**API Endpoints:**
- CRUD /api/v1/clients
- GET /api/v1/clients/{id}/projects — Client's project history
- CRUD /api/v1/projects
- GET /api/v1/projects/{id}/items — Project items grouped by room
- GET /api/v1/projects/{id}/cost-tracking — Material cost vs estimated
- GET /api/v1/projects/{id}/status — Overall project status with item-wise progress

**Frontend Pages:**
- /clients — Client list
- /clients/new — Add client
- /clients/{id} — Client detail with project history, communication log
- /projects — Project list with status filters
- /projects/new — Create project (select client, add rooms and items)
- /projects/{id} — Project detail (room-wise item breakdown, cost tracking, progress)
- /projects/{id}/edit — Edit project

---

### Module 6: Finished Products & BOM

**Description:** Finished product catalog with Bill of Materials. BOMs define raw materials needed per product. BOM is snapshot-frozen when a work order is approved.

**Models:**
```
ProductCategory:
  - id, name (Kitchen Units, Wardrobes/Storage, TV Units/Shelving,
    Vanity/Bathroom, Wall Paneling, False Ceiling, Study/Work, Other)
  - production_stages: text[] (configurable per category)
  - created_at

FinishedProduct:
  - id, category_id (FK)
  - name, sku, description
  - unit: enum (pcs, sqm, set)
  - created_at, updated_at

BOMItem:
  - id, product_id (FK), raw_material_id (FK)
  - quantity_per_unit: decimal
  - notes (e.g., "per sqm", "per pair")
```

**Production Stage Configurations:**
```
Kitchen Units: Cutting → Edging → Boring/Routing → Carcass Assembly → Shutter Prep → Hardware Fitment → QC
Wardrobes/Storage: Cutting → Edging → Boring → Assembly → Finishing → Hardware Fitment → QC
TV Units/Shelving: Cutting → Edging → Boring → Assembly → Finishing → QC
Vanity/Bathroom: Cutting → Edging → Waterproof Treatment → Assembly → Hardware Fitment → QC
Wall Paneling: Cutting → Surface Prep → Panel Mounting Prep → Finishing → QC
False Ceiling: Framework Prep → Board Cutting → Finishing → QC
```

**API Endpoints:**
- CRUD /api/v1/product-categories
- CRUD /api/v1/finished-products
- GET/PUT /api/v1/finished-products/{id}/bom — Get or update BOM
- GET /api/v1/finished-products/{id}/material-check?qty=N — Check material availability for N units

**Frontend Pages:**
- /products — Finished product list by category
- /products/new — Add product
- /products/{id} — Product detail with BOM
- /products/{id}/edit — Edit product
- /products/{id}/bom — Edit BOM (add/remove/adjust materials)

---

### Module 7: Work Orders & Production Tracking

**Description:** Work order management linked to projects. WO contains finished goods to manufacture. Admin approval is the second approval gate. On approval, BOM is snapshot-frozen and raw materials auto-issued via FIFO. Production stages tracked per unit with wastage logging.

**Models:**
```
WorkOrder:
  - id, wo_number (auto: WO-YYYY-NNNN)
  - project_id (FK), created_by (FK)
  - status: enum (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED)
  - estimated_material_cost: decimal
  - notes, rejection_reason, rejection_count
  - approved_by (FK, nullable), approved_at
  - bom_snapshot: jsonb (frozen BOM at approval time)
  - submitted_at, created_at, updated_at

WorkOrderItem:
  - id, wo_id (FK), product_id (FK)
  - quantity, completed_count (default 0)
  - status: enum (PENDING, IN_PROGRESS, COMPLETED)

ProductionUnit:
  - id, wo_item_id (FK)
  - unit_number (1 of 4, 2 of 4, etc.)
  - current_stage: string
  - status: enum (NOT_STARTED, IN_PROGRESS, COMPLETED)
  - started_at, completed_at

ProductionStageLog:
  - id, production_unit_id (FK)
  - stage_name, status: enum (STARTED, COMPLETED)
  - started_at, completed_at
  - completed_by (FK)
  - notes

WastageLog:
  - id, production_unit_id (FK, nullable), wo_id (FK)
  - raw_material_id (FK)
  - stage_name, quantity: decimal
  - reason, logged_by (FK)
  - created_at

MaterialIssue:
  - id, wo_id (FK), raw_material_id (FK), batch_id (FK)
  - quantity_issued: decimal
  - issued_at, issued_by (FK)
```

**API Endpoints:**
- CRUD /api/v1/work-orders
- GET /api/v1/work-orders/{id}/material-check — Check material availability with deficit details
- POST /api/v1/work-orders/{id}/submit — Submit for approval
- POST /api/v1/work-orders/{id}/approve — Admin approve (auto-issues materials via FIFO)
- POST /api/v1/work-orders/{id}/reject — Admin reject (with reason)
- GET /api/v1/work-orders/{id}/production — Production progress per unit
- POST /api/v1/production/{unit_id}/stage — Update stage status (start/complete)
- POST /api/v1/production/{unit_id}/wastage — Log wastage
- GET /api/v1/work-orders/{id}/wastage — Wastage summary for WO

**Frontend Pages:**
- /work-orders — WO list with status filters
- /work-orders/new — Create WO (select project, add products, see material availability)
- /work-orders/{id} — WO detail with material check, approval history
- /work-orders/{id}/edit — Edit WO (draft or rejected)
- /work-orders/{id}/production — Production tracking board (stage checkboxes per unit)
- /production — Active production overview (all in-progress WOs)

---

### Module 8: Dispatch & Delivery (with Photo Verification)

**Description:** Dispatch management with TWO mandatory photo checkpoints — factory loading (by employee) and site delivery (by driver via unique URL). This creates a complete visual evidence chain. Admin approval is the third approval gate.

**Dispatch Statuses:** DRAFT → PENDING_APPROVAL → APPROVED → LOADING_VERIFICATION → IN_TRANSIT → DELIVERY_VERIFICATION → DELIVERED

**Models:**
```
Dispatch:
  - id, dispatch_number (auto: DSP-YYYY-NNNN)
  - project_id (FK), created_by (FK)
  - status: enum (DRAFT, PENDING_APPROVAL, APPROVED, LOADING_VERIFICATION,
    IN_TRANSIT, DELIVERY_VERIFICATION, DELIVERED)
  - vehicle_number, driver_name, driver_phone
  - delivery_address, delivery_city
  - delivery_token: string (32+ char, cryptographically random, unique)
  - token_expires_at: datetime (48 hours from generation)
  - token_used: boolean
  - notes, rejection_reason, rejection_count
  - approved_by (FK, nullable), approved_at
  - loading_confirmed_at, loading_confirmed_by (FK)
  - delivery_marked_at, delivery_confirmed_at, delivery_confirmed_by (FK)
  - challan_url: string (generated PDF path)
  - submitted_at, created_at, updated_at

DispatchItem:
  - id, dispatch_id (FK)
  - project_item_id (FK, nullable)
  - product_id (FK), product_name (snapshot)
  - quantity
  - factory_verified: boolean (default false)
  - notes

DispatchPhoto:
  - id, dispatch_id (FK), dispatch_item_id (FK, nullable)
  - checkpoint: enum (FACTORY, SITE)
  - item_reference: string (dispatch line item ref, "truck_overview", or "site_delivery")
  - storage_url: string (S3 path to original)
  - thumbnail_url: string (S3 path to 200px thumbnail)
  - captured_at: datetime (server timestamp)
  - gps_lat: decimal (nullable)
  - gps_lng: decimal (nullable)
  - gps_available: boolean
  - uploaded_by: user_id (FK, nullable — null for driver uploads)
  - uploaded_by_role: enum (EMPLOYEE, DRIVER)
  - file_size: integer
  - original_filename: string
  - notes: text (nullable, can be added after upload)
  - created_at

FinishedGoodInventory:
  - id, product_id (FK), project_id (FK)
  - wo_id (FK), wo_item_id (FK)
  - quantity: decimal (CHECK >= 0)
  - status: enum (IN_STOCK, DISPATCHED, DELIVERED)
  - completed_at, created_at
```

**API Endpoints:**
- CRUD /api/v1/dispatches
- GET /api/v1/dispatches/by-project/{project_id} — Finished goods ready for dispatch grouped by project
- POST /api/v1/dispatches/{id}/submit — Submit for approval
- POST /api/v1/dispatches/{id}/approve — Admin approve
- POST /api/v1/dispatches/{id}/reject — Admin reject
- POST /api/v1/dispatches/{id}/photos — Upload factory loading photo (employee)
- POST /api/v1/dispatches/{id}/verify-item/{item_id} — Mark item as factory-verified
- POST /api/v1/dispatches/{id}/confirm-loading — Confirm loading (requires all items verified + photos)
- POST /api/v1/dispatches/{id}/regenerate-link — Regenerate delivery link (expires old one)
- POST /api/v1/dispatches/{id}/confirm-delivery — Employee confirms delivery after reviewing photos
- POST /api/v1/dispatches/{id}/flag-delivery — Employee flags delivery issue

**Public Driver Endpoints (no auth, token-secured):**
- GET /api/v1/delivery/{token} — Get dispatch info for driver (item list, read-only)
- POST /api/v1/delivery/{token}/photos — Upload delivery photos
- POST /api/v1/delivery/{token}/complete — Mark as delivered (requires min 2 photos)

**Frontend Pages:**
- /dispatches — Dispatch list with status filters
- /dispatches/new — Create dispatch (select project, pick finished goods, enter vehicle/driver info)
- /dispatches/{id} — Dispatch detail with full photo timeline
- /dispatches/{id}/loading — Factory loading verification screen (item checklist + photo upload)
- /delivery/{token} — Public driver delivery page (no auth, mobile-friendly)

---

### Module 9: Dashboard & Analytics

**Description:** Overview dashboard for employee (operational focus) and admin (approval + oversight focus). Reports for stock, projects, production, wastage, dispatch, and approval activity.

**API Endpoints:**
- GET /api/v1/dashboard/employee — Employee dashboard data
- GET /api/v1/dashboard/admin — Admin dashboard data
- GET /api/v1/reports/stock-summary — Current stock by item, grouped by state
- GET /api/v1/reports/project-costs — Material cost per project vs estimated
- GET /api/v1/reports/purchase-analytics — Spend per vendor/item/month
- GET /api/v1/reports/production-efficiency — WO completion time, stage cycle times
- GET /api/v1/reports/wastage — Wastage by item/WO/stage
- GET /api/v1/reports/dispatch-log — Dispatches with status, photos, GPS
- GET /api/v1/reports/reorder-alerts — Items below reorder threshold
- GET /api/v1/reports/audit-trail — Full inventory movement history with filters
- GET /api/v1/reports/approval-activity — Approvals per admin, avg response time, rejection rate

**Frontend Pages:**
- /dashboard — Main dashboard (role-specific widgets)
  - Employee: reorder alerts, pending approvals status, active WOs, recent GRNs
  - Admin: approval inbox, active projects overview, WO progress, stock summary
- /reports — Reports hub
- /reports/stock — Stock summary
- /reports/projects — Project cost tracking
- /reports/purchases — Purchase analytics
- /reports/production — Production efficiency
- /reports/wastage — Wastage report
- /reports/dispatches — Dispatch log with photo verification
- /reports/audit — Audit trail
- /reports/approvals — Approval activity per admin

---

### Module 10: Notifications & Escalation

**Description:** Push notifications for admin approvals, escalation reminders, and WhatsApp integration for driver delivery links.

**Models:**
```
Notification:
  - id, user_id (FK)
  - type: enum (APPROVAL_REQUEST, APPROVAL_REMINDER, ESCALATION,
    REORDER_ALERT, DELIVERY_COMPLETE, GENERAL)
  - title, message
  - entity_type, entity_id (polymorphic link)
  - is_read: boolean
  - channel: enum (PUSH, WHATSAPP, SMS, IN_APP)
  - sent_at, read_at, created_at

EscalationTracker:
  - id, entity_type, entity_id
  - reminder_count: integer (max 3 before final escalation)
  - last_reminder_at, next_reminder_at
  - escalated: boolean
  - resolved: boolean, resolved_at
```

**API Endpoints:**
- GET /api/v1/notifications — User's notifications
- PUT /api/v1/notifications/{id}/read — Mark as read
- POST /api/v1/notifications/register-device — Register push notification device token
- GET /api/v1/notifications/unread-count — Unread count for badge

---

## BUSINESS RULES

### Inventory Rules
1. **No negative inventory** — CHECK constraint at database level (qty >= 0). Every deduction must verify available qty first.
2. **FIFO consumption** — Always consume oldest received batch first. Track batch received dates.
3. **Audit trail** — Every inventory movement logged: who, when, what changed, qty before/after, source transaction.
4. **Reorder alerts** — When stock <= reorder level, show on dashboard. Allow one-tap PO creation.

### Document Rules
5. **Auto-numbering** — Sequential per year: PO-2026-0001, WO-2026-0001, GRN-2026-0001, DSP-2026-0001. Never skip or duplicate.
6. **BOM snapshot on approval** — Freeze current BOM into WO record on approval. Later BOM edits don't affect active WOs.

### Approval Rules
7. **First-come-first-serve** — All admins notified. First to act locks the item. Race condition: first DB write wins.
8. **Rejection and resubmit** — Reject requires reason. Employee edits and resubmits. Full history preserved.
9. **Auto-approve thresholds** — Per admin, optional. If submission matches any admin's threshold, auto-approves instantly with logged reason.
10. **Escalation** — 4-hour reminder to all admins. After 3 reminders, WhatsApp/SMS final escalation.

### Production Rules
11. **Material availability check** — Before WO submission, show green/red status per material with exact shortage qty.
12. **Auto-issue on WO approval** — Raw materials auto-issued from inventory via FIFO on approval.
13. **Auto-FG on QC completion** — When final QC stage is complete, finished good inventory auto-created.
14. **Wastage logging** — Employee can log wastage at any production stage (qty + reason).
15. **Configurable stages** — Production stages are configurable per product category.

### Dispatch Rules
16. **Project grouping** — Finished goods always grouped by project in dispatch screen.
17. **Mandatory factory photos** — Cannot move to IN_TRANSIT until ALL items have at least one photo. No bypass.
18. **Mandatory delivery photos** — Driver must upload min 2 photos before marking delivered.
19. **Auto-challan on loading confirmation** — PDF generated when employee confirms loading.
20. **Photo GPS auto-capture** — Attempt GPS on every photo. Accept without GPS but flag as "No GPS".
21. **Photo immutability** — Once uploaded, photos cannot be deleted or edited. Only notes can be added.
22. **Delivery link security** — Cryptographically random token, single-use, 48-hour expiry, no auth required.

### Operational Rules
23. **Employee never blocked** — While waiting for approval, employee can work on other items.
24. **Auto-deduct on loading** — Finished goods inventory deducted when loading is confirmed.

---

## MVP SCOPE

### Must Have (Full System)
- [x] User registration and login (email/password, JWT)
- [x] Role-based access (Employee, Admin)
- [x] Raw material inventory with categories, FIFO batches, audit trail
- [x] Vendor management
- [x] Purchase orders with admin approval workflow
- [x] GRN with quality check and auto-stock update
- [x] Client and project management (room-wise item breakdown)
- [x] Finished product catalog with BOM
- [x] Work orders with admin approval, auto-material-issue, BOM snapshot
- [x] Production stage tracking (configurable per category) with wastage logging
- [x] Dispatch with admin approval and photo verification (factory + site)
- [x] Driver delivery link (no-login, unique URL, photo upload)
- [x] Push notifications for admin approvals
- [x] Escalation reminders (4-hour cycle)
- [x] Dashboard (employee + admin views)
- [x] All 9 reports
- [x] Auto-numbering for all documents
- [x] Reorder alerts with one-tap PO creation
- [x] Delivery challan PDF generation

### Nice to Have (Post-MVP)
- [ ] WhatsApp Business API integration (use simple URL share initially)
- [ ] SMS fallback for escalation
- [ ] Barcode/QR scanning for materials
- [ ] Client portal for project tracking
- [ ] Multi-factory support
- [ ] Advanced analytics with trend charts
- [ ] Mobile app (PWA covers initial mobile needs)

---

## ACCEPTANCE CRITERIA

### Authentication & Users
- [ ] Employee can login with email/password
- [ ] Admin can login with email/password
- [ ] JWT access + refresh tokens work correctly
- [ ] Role-based route protection (employee vs admin)
- [ ] Admin can add/remove/deactivate users

### Inventory
- [ ] Raw materials can be created with categories and reorder levels
- [ ] Stock cannot go negative (DB constraint enforced)
- [ ] Every stock movement is audit-logged
- [ ] Reorder alerts show on dashboard when stock <= reorder level
- [ ] FIFO batch consumption works correctly

### Purchase Flow
- [ ] Employee creates PO with vendor, items, quantities, rates
- [ ] System shows last purchase rate and current stock on PO form
- [ ] PO submitted for approval sends push notification to all admins
- [ ] Any admin can approve/reject; first action locks it
- [ ] Rejected PO can be edited and resubmitted
- [ ] GRN creation auto-updates inventory, PO status, last purchase rate
- [ ] Partial receipt tracking works

### Production Flow
- [ ] Work order created with project link and product list
- [ ] Material availability check shows green/red status
- [ ] WO approval auto-freezes BOM snapshot
- [ ] WO approval auto-issues materials via FIFO
- [ ] Production stages configurable per product category
- [ ] Stage completion logging works on mobile/tablet
- [ ] Final QC auto-creates finished good inventory
- [ ] Wastage can be logged at any stage

### Dispatch Flow
- [ ] Dispatch groups finished goods by project
- [ ] Admin approval workflow works (third gate)
- [ ] Factory photo upload required for each item before loading confirmation
- [ ] Loading confirmation auto-generates challan PDF
- [ ] Loading confirmation auto-generates unique driver delivery link
- [ ] Driver can open delivery link without login
- [ ] Driver can upload photos and mark delivered (min 2 photos)
- [ ] Employee reviews delivery photos and confirms
- [ ] Dispatch detail shows factory vs site photo timeline
- [ ] GPS coordinates captured on all photos where available
- [ ] Delivery link expires after 48 hours
- [ ] Photos cannot be deleted after upload

### Approvals
- [ ] Push notifications sent to all admins on submission
- [ ] Race condition handled (first write wins)
- [ ] Approval log records admin name and timestamp
- [ ] Escalation reminders sent after 4 hours
- [ ] Auto-approve thresholds work per admin

### Dashboard & Reports
- [ ] Employee dashboard shows operational overview
- [ ] Admin dashboard shows approval inbox and oversight
- [ ] All 9 reports generate correctly with filters
- [ ] Audit trail shows complete inventory movement history

### Quality
- [ ] All API endpoints documented in OpenAPI
- [ ] Backend test coverage 80%+
- [ ] Frontend TypeScript strict mode passes
- [ ] Docker builds and runs successfully
- [ ] No negative inventory possible via any code path

---

## SPECIAL REQUIREMENTS

### Security
- [x] Rate limiting on auth endpoints
- [x] Input validation on all endpoints
- [x] SQL injection prevention (SQLAlchemy ORM)
- [x] XSS prevention
- [x] No negative inventory (DB CHECK constraint)
- [x] Cryptographically random delivery tokens
- [x] Photo immutability (no delete/edit after upload)
- [x] Race condition handling on approvals (first write wins)

### Integrations
- [x] S3-compatible object storage for photos (MinIO for dev, S3/R2 for prod)
- [x] Push notifications (FCM / Web Push API)
- [x] PDF generation for delivery challans (WeasyPrint or ReportLab)
- [ ] WhatsApp Business API (post-MVP, use URL share initially)

### Locale
- [x] Currency: Indian Rupees (₹)
- [x] Number format: Indian lakh/crore (₹1,23,456.00)
- [x] Timezone: IST (Asia/Kolkata)

### Photo Storage
- [x] Client-side compression to ~500KB (canvas resize, max 1200px width, JPEG 0.7)
- [x] Server-side thumbnail generation (200px width)
- [x] Store in S3 with metadata in DB
- [x] Retain originals indefinitely

---

## SAMPLE SEED DATA

### Users
- Ravi Kumar (Employee)
- Senthil (Admin — Factory Owner)
- Priya (Admin — Business Partner)
- Kumar (Admin — Operations Manager)

### Vendors
- Sri Lakshmi Plywood (Ambattur)
- Kumar Laminates (Guindy)
- National Hardware Traders (Parrys)
- Supreme Edge Band (Porur)
- Glass & Mirror Works (T.Nagar)
- Hettich India
- Ebco Fittings
- Godrej Locks

### Raw Materials (25+ items)
Plywood 18mm BWR, Plywood 12mm BWR, Plywood 8mm MR, HDHMR 18mm, MDF 18mm, Laminate Greenlam 1mm, Laminate Merino 1mm, Acrylic Sheet 1mm, Soft-Close Hinge (Hettich), Cup Hinge (Hettich), Tandem Slide 500mm, Drawer Channel 450mm, PVC Edge Band 2mm, ABS Edge Band 1mm, Handle SS 6-inch, Knob Round, Push-to-Open, Cam Lock, Minifix, Confirmat Screw, Dowel 8mm, Fevicol SH, Silicon Sealant, PU Foam, Gypsum Board 12mm, Ceiling Channel/Grid

### Finished Products with BOMs
- Kitchen Base Unit 600mm: Plywood 18mm ×2, HDHMR 18mm ×1, Laminate ×3sqm, Cup Hinge ×4, Tandem Slide ×1pair, Handle ×1, Edge Band ×6m, Cam Lock ×8, Minifix ×4
- Kitchen Wall Unit 600mm: Plywood 18mm ×1.5, Laminate ×2sqm, Cup Hinge ×2, Handle ×1, Edge Band ×4m
- 3-Door Sliding Wardrobe: Plywood 18mm ×6, Plywood 12mm ×2, Laminate ×10sqm, Soft-Close Hinge ×6, Handle ×3, Edge Band ×18m, Drawer Channel ×2pair
- TV Unit with Back Panel: Plywood 18mm ×2, Plywood 8mm ×1, Laminate ×4sqm, Push-to-Open ×4, Edge Band ×8m
- Bathroom Vanity Unit: HDHMR 18mm ×1.5, Laminate ×2sqm, Soft-Close Hinge ×2, Handle ×2, Edge Band ×4m
- Wall Panel Module (per sqm): Plywood 8mm ×1, Laminate/Veneer ×1.2sqm, Edge Band ×2m
- Study Table: Plywood 18mm ×1.5, Laminate ×2.5sqm, Edge Band ×5m, Drawer Channel ×1pair, Handle ×2

### Sample Project
"Sharma Residence — 3BHK, Adyar" containing:
- Kitchen: 4 base units + 3 wall units + 1 tall unit
- Master Bedroom: 1 wardrobe + 1 TV unit + 1 dresser
- Living Room: 1 TV unit + 1 shoe rack + wall paneling 12sqm
- Kids Room: 1 wardrobe + 1 study table
- Bathrooms: 2 vanity units
- False ceiling: hall + bedrooms

---

## AGENTS

> These 6 agents will build your product in parallel:

| Agent | Role | Works On |
|-------|------|----------|
| DATABASE-AGENT | Creates all models, relationships, migrations, constraints | All database models, CHECK constraints, indexes |
| BACKEND-AGENT | Builds API endpoints, services, approval logic, FIFO engine | All modules' backends, business rules |
| FRONTEND-AGENT | Creates UI pages, components, mobile-friendly views | All modules' frontends, driver delivery page |
| DEVOPS-AGENT | Sets up Docker, CI/CD, S3/MinIO, environments | Infrastructure, photo storage |
| TEST-AGENT | Writes unit and integration tests | All code, especially business rules |
| REVIEW-AGENT | Security and code quality audit | All code, race conditions, inventory constraints |

---

# READY?

```bash
/generate-prp INITIAL.md
```

Then:

```bash
/execute-prp PRPs/decotrack-prp.md
```
