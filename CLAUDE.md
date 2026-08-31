# CLAUDE.md - DecoTrack Project Rules

> Project-specific rules for Claude Code. This file is read automatically.

---

## Project Overview

**Project Name:** DecoTrack
**Description:** Inventory ERP for interior design manufacturing factories — end-to-end project execution from procurement to photo-verified delivery.
**Tech Stack:**
- Backend: FastAPI + Python 3.11+
- Frontend: React + Vite + TypeScript
- Database: PostgreSQL + SQLAlchemy
- Auth: JWT (Email/Password only)
- UI: Tailwind CSS + shadcn/ui
- Photo Storage: S3-compatible (MinIO dev / S3 prod)
- Notifications: Web Push (FCM)
- PDF: WeasyPrint or ReportLab

---

## Project Structure

```
DecoTrack/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── raw_material.py
│   │   │   ├── inventory.py
│   │   │   ├── vendor.py
│   │   │   ├── purchase_order.py
│   │   │   ├── grn.py
│   │   │   ├── client.py
│   │   │   ├── project.py
│   │   │   ├── finished_product.py
│   │   │   ├── bom.py
│   │   │   ├── work_order.py
│   │   │   ├── production.py
│   │   │   ├── dispatch.py
│   │   │   ├── dispatch_photo.py
│   │   │   ├── notification.py
│   │   │   └── approval.py
│   │   ├── schemas/
│   │   ├── routers/
│   │   ├── services/
│   │   │   ├── inventory_service.py   # FIFO logic, stock checks
│   │   │   ├── approval_service.py    # Multi-admin, race condition handling
│   │   │   ├── production_service.py  # Stage tracking, auto-FG
│   │   │   ├── dispatch_service.py    # Photo verification, delivery links
│   │   │   ├── notification_service.py # Push + escalation
│   │   │   ├── pdf_service.py         # Challan generation
│   │   │   └── storage_service.py     # S3 photo upload/thumbnail
│   │   └── auth/
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── types/
│   │   └── utils/
│   │       └── currency.ts  # INR formatting (lakh/crore)
│   └── package.json
├── .claude/
│   └── commands/
├── skills/
├── agents/
└── PRPs/
```

---

## Code Standards

### Python (Backend)
```python
# ALWAYS use type hints
def get_raw_material(db: Session, material_id: int) -> RawMaterial:
    pass

# ALWAYS use async endpoints
@router.get("/raw-materials/{id}")
async def get_material(id: int, db: Session = Depends(get_db)):
    pass

# Use logging, never print()
import logging
logger = logging.getLogger(__name__)
logger.info("PO %s approved by admin %s", po.po_number, admin.full_name)
```

### TypeScript (Frontend)
```typescript
// ALWAYS define interfaces for props and data
interface RawMaterial {
  id: number;
  name: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  unit: "pcs" | "sqm" | "m" | "kg" | "pair" | "litre" | "set";
}

// NO any types allowed
const fetchMaterial = async (id: number): Promise<RawMaterial> => { ... };

// Use Indian Rupee formatting
const formatINR = (amount: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
```

---

## Forbidden Patterns

### Backend
- Never use `print()` — use `logging` module
- Never store passwords in plain text — use bcrypt
- Never hardcode secrets — use environment variables
- Never allow negative inventory — enforce CHECK constraint at DB level
- Never skip input validation
- Never allow photo deletion after upload — photos are immutable evidence
- Never allow approval action without race condition check (first write wins)

### Frontend
- Never use `any` type
- Never leave `console.log` in production
- Never skip error handling in async operations
- Never use inline styles — use Tailwind CSS + shadcn/ui
- Never display amounts without INR formatting (₹1,23,456.00)
- Never skip GPS capture attempt on photo uploads

---

## Module-Specific Rules

### Inventory
- All stock quantities have CHECK >= 0 at database level
- Every stock change creates an InventoryMovement audit record
- FIFO: always consume oldest batch first (order by received_date ASC)
- Reorder alert when current_stock <= reorder_level

### Purchase Orders
- PO numbers auto-generated: PO-YYYY-NNNN (sequential, no gaps)
- PO form must show last_purchase_rate and current_stock for each item
- Approval sends push notification to ALL admins
- First admin to act locks the PO (race condition: first DB write wins)
- Rejection requires reason; employee can edit and resubmit

### Work Orders
- WO numbers auto-generated: WO-YYYY-NNNN
- Before submission: show material availability (green/red per item)
- On approval: freeze BOM as JSON snapshot in wo.bom_snapshot
- On approval: auto-issue materials from inventory via FIFO
- Production stages are configurable per product category
- Final QC completion auto-creates finished good inventory

### Dispatch
- DSP numbers auto-generated: DSP-YYYY-NNNN
- Finished goods always grouped by project
- LOADING_VERIFICATION requires photo for EVERY dispatch item — no bypass
- Loading confirmation triggers: challan PDF, inventory deduction, delivery link generation
- Delivery token: UUID v4 or crypto-random 32+ chars, 48-hour expiry
- Driver page: no auth, no app, works in any phone browser
- Minimum 2 delivery photos required before driver can mark delivered
- Photos are immutable once uploaded — only notes can be added

### Approvals (shared)
- ApprovalLog table records every action across all 3 gates
- Escalation: 4-hour reminder cycle, max 3 reminders, then WhatsApp/SMS
- Auto-approve: per-admin configurable thresholds, logged with reason

---

## API Conventions

- All endpoints prefixed with `/api/v1/`
- Use plural nouns: `/raw-materials`, `/purchase-orders`, `/work-orders`, `/dispatches`
- Return appropriate HTTP status codes: 200, 201, 400, 401, 403, 404, 409
- Use 409 Conflict for race condition on approvals
- Pagination on all list endpoints: `?page=1&per_page=20`
- Filter support: `?status=APPROVED&vendor_id=5`
- All monetary values as Decimal, never float

---

## Authentication

### JWT Configuration
- Access token expires: 30 minutes
- Refresh token expires: 7 days
- Algorithm: HS256
- Roles: EMPLOYEE, ADMIN
- Driver delivery endpoints require NO auth — secured by unguessable token

### Role-Based Access
- Employee: full CRUD on operational data, submit for approval, cannot approve
- Admin: approve/reject, view dashboard/reports, manage users, read-only on operational data
- Driver: public delivery page only (token-secured, no login)

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/decotrack

# Auth
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# S3 / MinIO (photo storage)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=decotrack-photos
S3_REGION=ap-south-1

# Push Notifications
FCM_SERVER_KEY=your-fcm-key

# Application
APP_BASE_URL=https://erp.yoursite.com
TIMEZONE=Asia/Kolkata

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## Development Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# MinIO (local S3 for photos)
docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"

# Docker
docker-compose up -d

# Tests
pytest backend/tests -v
cd frontend && npm test

# Linting
ruff check backend/
cd frontend && npm run lint && npm run type-check

# Seed data
python backend/scripts/seed.py
```

---

## Commit Message Format

```
feat(inventory): add FIFO batch consumption engine
feat(purchase): add multi-admin approval with race condition handling
feat(dispatch): add factory photo verification checkpoint
fix(production): fix auto-FG creation on QC completion
refactor(auth): extract role-based permission decorator
test(approval): add concurrent approval race condition tests
docs: update API documentation
```

---

## Currency & Locale

- Currency: Indian Rupees (₹)
- Display format: ₹1,23,456.00 (Indian lakh/crore numbering)
- Use `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })` in frontend
- Use `Decimal` type in Python, never `float` for money
- Timezone: IST (Asia/Kolkata) — all timestamps stored as UTC, displayed as IST

---

## Skills Reference

| Task | Skill to Read |
|------|---------------|
| Database models, migrations, constraints | skills/DATABASE.md |
| API endpoints, auth, business logic | skills/BACKEND.md |
| React pages, components, mobile views | skills/FRONTEND.md |
| Unit and integration tests | skills/TESTING.md |
| Docker, S3/MinIO, CI/CD | skills/DEPLOYMENT.md |

---

## Agent Coordination

For complex tasks, the ORCHESTRATOR coordinates:
- DATABASE-AGENT → Models, relationships, CHECK constraints, migrations
- BACKEND-AGENT → API endpoints, FIFO engine, approval logic, photo handling
- FRONTEND-AGENT → UI pages, mobile-friendly views, driver delivery page
- TEST-AGENT → Tests for business rules, race conditions, inventory constraints
- REVIEW-AGENT → Security audit, race condition review, constraint verification
- DEVOPS-AGENT → Docker, MinIO, S3, CI/CD, push notification setup

Read agent definitions in `/agents/` folder.

---

## Validation

```bash
ruff check backend/ && pytest
npm run lint && npm run type-check
docker-compose build
```
