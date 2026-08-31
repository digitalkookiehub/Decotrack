# DecoTrack

Inventory ERP for interior design manufacturing factories — tracks a project end-to-end from raw material purchase through production to photo-verified delivery at the customer's site.

Built for a real factory workflow: employees run day-to-day operations, admins approve spend and dispatches, and drivers get a no-login mobile page to prove delivery with photos and GPS.

---

## Tech Stack

- **Backend:** FastAPI + Python 3.11, SQLAlchemy + Alembic, PostgreSQL
- **Frontend:** React + Vite + TypeScript, Tailwind CSS + shadcn/ui
- **Auth:** JWT (email/password only — no OAuth), roles: `EMPLOYEE` / `ADMIN`, plus token-secured public driver pages
- **Storage:** S3-compatible (MinIO in dev)
- **PDF generation:** ReportLab (challans, quotations, cutting layouts)

---

## Modules Completed

### Core operations
- **Auth & users** — JWT login/refresh, role-based access, per-admin auto-approval thresholds
- **Dashboard** — separate employee/admin views, charts endpoint for trends
- **Clients & CRM** — client records, leads, interactions, follow-ups, quotations (with PDF)
- **Client Portal** — public, phone-login portal where a client can check their project/dispatch/quotation status without an account in the main system
- **Vendors & Purchase Orders** — `PO-YYYY-NNNN` numbering, shows last purchase rate + current stock per item, multi-admin approval
- **GRN (Goods Received Note)** — receiving against a PO, updates stock via FIFO batches
- **Raw Materials & Inventory** — categorized materials (Sheet Materials, Hardware, Fasteners, etc.), FIFO batch consumption, stock CHECK constraints (never negative), reorder alerts, full movement audit trail
- **Projects** — auto-numbered `CLIENTNAME-YEAR-NNNN` (sequence scoped per client), room-wise item breakdown
- **Finished Products & BOM** — product catalog with bill-of-materials per product
- **Work Orders** — `WO-YYYY-NNNN`, material availability check before submission, BOM frozen as a snapshot on approval, auto-issues stock via FIFO on approval
- **Production** — configurable stage tracking per work order, wastage logging per stage, auto-creates finished-goods inventory on completion
- **Cutting / Cut Planner** — multi-sheet-size cutting optimizer (rectpack-based), saved as `CO-YYYY-NNNN` Cut Orders linked to a Work Order, material picker tied to real inventory (cost + stock check), landscape/portrait layout toggle, PDF export
- **Dispatch & Delivery** — see below
- **Expenses** — project-linked expense tracking
- **Company Profile** — factory details used on generated documents
- **Bulk import** — Excel/CSV import for catalog data
- **Elevation tool** — quick panel-list generator that can hand off straight into the Cut Planner
- **Notifications** — in-app notification feed (list/mark-read), polled by the frontend
- **Approvals** — shared `ApprovalLog` across POs/Work Orders/Dispatches, row-level locking so only the first admin action wins (returns `409 Conflict` to the loser), per-admin configurable auto-approve thresholds
- **Reports** — stock summary, purchase analytics, wastage, audit trail, dispatch log

### Dispatch & Delivery (detail)
Status lifecycle: `DRAFT → PENDING_APPROVAL → APPROVED → LOADING_VERIFICATION → IN_TRANSIT → DELIVERY_VERIFICATION → DELIVERED`

- Finished goods grouped by project at dispatch time
- **Factory checkpoint:** every dispatch item requires a loading photo before it can go `IN_TRANSIT` — no bypass
- Loading confirmation triggers challan PDF generation and inventory deduction
- **Driver delivery page:** no login, secured by a crypto-random token (48-hour expiry, single-use), works in any phone browser
- Driver uploads **minimum 2 site delivery photos** with a GPS capture attempt on each; photos are immutable once uploaded (only notes can be added afterward)
- **Per-item delivery confirmation:** driver enters the quantity actually received for each item (not just a blanket "delivered"); a shortfall (e.g. 2 of 3 received) is flagged on the admin dispatch view, and completion is blocked until every item is confirmed
- **Geofence check:** delivery address is geocoded (OpenStreetMap Nominatim) once loading is confirmed; every site delivery photo's GPS is compared against it and flagged if it's implausibly far away (advisory only — never blocks anything, since address geocoding for informal addresses can be imprecise)
- Driver "marks delivered" → `DELIVERY_VERIFICATION` (awaiting internal confirmation) → an employee/admin confirms → `DELIVERED`

### AI Automation
- **Cutting-list OCR** — photograph a handwritten/printed cutting list in the Cut Planner and Gemini Vision extracts it into structured panel rows (label/length/width/quantity) for review, instead of retyping by hand
- **WhatsApp lead auto-triage** — incoming WhatsApp enquiries are read by Gemini to pull out city and budget (auto-filled onto the lead if not already set), plus a one-line summary and a suggested first reply, shown on the lead's interaction timeline

---

## Not Yet Built

Called out explicitly so it's not mistaken for done:
- **Push notifications** — the in-app notification feed works, but web push (FCM) and the 4-hour/3-reminder escalation → WhatsApp/SMS described in the original spec aren't wired up
- **Customer-side delivery confirmation** — an OTP or signature captured from the customer at handover, proving the *right person* received the goods (currently only the driver + an internal employee confirm delivery)
- **Outbound WhatsApp** — leads are auto-triaged from *incoming* WhatsApp messages, but there's no automatic outbound reply or delivery-status push; that would need the WhatsApp Business Cloud API (a separate Meta integration) beyond the AI part
- Automated tests — no test suite currently checked in under `backend/tests`

---

## Local Development

```bash
# Backend + DB + MinIO (Docker)
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head
docker compose -f docker-compose.dev.yml exec backend python scripts/seed.py

# Frontend
cd frontend
npm install
npm run dev
```

Default ports (`docker-compose.dev.yml`): backend `8888`, Postgres `5434`, MinIO `9000`/`9001`, frontend `5200` — remapped from the usual `8000`/`5432`/`5173` because another local project already used those on this machine. Adjust back if that's not your situation.

The AI features (cutting-list OCR, WhatsApp lead triage) need a free Gemini key from https://aistudio.google.com/apikey. Put it in a root-level `.env` (gitignored) as `GEMINI_API_KEY=...` — `docker-compose.dev.yml` reads it from there via `${GEMINI_API_KEY}`. Without a key, both features fail gracefully (OCR returns an error to retry manually; lead triage silently skips, same as if it were never called).

**Seeded dev logins** (`decotrack123` for all):
| Email | Role |
|---|---|
| senthil@decotrack.in | ADMIN |
| priya@decotrack.in | ADMIN |
| ravi@decotrack.in | EMPLOYEE |

---

## Numbering Conventions

| Document | Format | Scope |
|---|---|---|
| Purchase Order | `PO-YYYY-NNNN` | global, per year |
| Work Order | `WO-YYYY-NNNN` | global, per year |
| GRN | `GRN-YYYY-NNNN` | global, per year |
| Dispatch | `DSP-YYYY-NNNN` | global, per year |
| Cut Order | `CO-YYYY-NNNN` | global, per year |
| Quotation | `QT-YYYY-NNNN` | global, per year |
| Lead | `LEAD-YYYY-NNNN` | global, per year |
| Project | `CLIENTNAME-YEAR-NNNN` | scoped to the client's first name-word, per year |

All monetary values are `Decimal`, never `float`. Timestamps are stored UTC, displayed IST.
