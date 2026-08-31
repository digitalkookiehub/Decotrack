# DecoTrack — User Flow Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DECOTRACK ERP                            │
│                                                                 │
│  Employee (Ravi)          3 Admins (Senthil/Priya/Kumar)        │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │ Creates all   │         │ Approves 3   │                      │
│  │ data & runs   │────────▶│ gates on     │                      │
│  │ operations    │◀────────│ mobile/phone │                      │
│  └──────────────┘         └──────────────┘                      │
│                                                                 │
│  Driver (No Login)                                              │
│  ┌──────────────┐                                               │
│  │ Opens unique  │                                               │
│  │ delivery URL  │                                               │
│  │ uploads photos│                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Complete Business Flow

```
 ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 │   CRM    │    │  MASTER  │    │ PURCHASE │    │  WORK    │    │PRODUCTION│    │ DISPATCH │
 │  LEAD →  │───▶│  DATA    │───▶│  FLOW    │───▶│  ORDER   │───▶│ TRACKING │───▶│ & DELIVER│
 │  CLIENT  │    │  SETUP   │    │          │    │  FLOW    │    │          │    │          │
 └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## STEP 0: CRM — Lead to Client (Pre-sale)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRM / LEAD PIPELINE                           │
│                                                                  │
│  ① Lead comes in — call, WhatsApp, walk-in, website, referral    │
│     • Manual: staff logs it via Quick Log / Call Log             │
│     • 🤖 WhatsApp: auto-created from the incoming message,       │
│         AI reads it and fills in city + budget, adds a one-line  │
│         summary and a suggested first reply to review            │
│         (/crm/leads)                                             │
│         │                                                        │
│         ▼                                                        │
│  ② Lead moves through stages:                                   │
│     NEW → CONTACTED → SITE VISIT → MEASUREMENT →                 │
│     QUOTATION SENT → NEGOTIATION → WON / LOST                    │
│         │                                                        │
│         ▼                                                        │
│  ③ SITE VISIT / MEASUREMENT (/crm/leads/:id)                     │
│     • 🤖 Photograph the carpenter's handwritten measurement      │
│         sheet — AI reads each room's length/width/height         │
│         (handles feet, the usual site unit, as well as cm/m)     │
│         and saves them against the lead for review               │
│     • Or type room dimensions in manually                        │
│         │                                                        │
│         ▼                                                        │
│  ④ Quotation (/quotations/new)                                   │
│     • Draft line items, generates a PDF to send the client       │
│     • Auto-numbered QT-YYYY-NNNN                                 │
│         │                                                        │
│         ▼                                                        │
│  ⑤ "Convert to Client" (on the lead page)                        │
│     ✅ Creates a Client record from the lead's details            │
│     ✅ Optionally creates a Project in one step                   │
│        (auto-numbered CLIENTNAME-YEAR-NNNN)                      │
│     ✅ All interactions transfer to the new client                │
│     → continues into Master Data Setup / Work Order flow below   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## STEP 1: Master Data Setup (One-time)

```
┌─────────────────────────────────────────────────────┐
│                 MASTER DATA SETUP                    │
│                                                     │
│  1. Add Vendors (/vendors)                          │
│     Sri Lakshmi Plywood, Kumar Laminates, etc.      │
│                    │                                │
│  2. Add Raw Materials (/inventory/materials)         │
│     Plywood 18mm, Laminates, Hinges, etc.           │
│     Set reorder levels for each                     │
│                    │                                │
│  3. Add Finished Products (/products)                │
│     Kitchen Base Unit, Wardrobe, TV Unit, etc.      │
│                    │                                │
│  4. Define BOMs (/products/:id)                      │
│     Kitchen Base Unit needs:                        │
│       Plywood 18mm × 2                              │
│       Laminate × 3 sqm                              │
│       Cup Hinge × 4                                 │
│       etc.                                          │
│                    │                                │
│  5. Add Clients (/clients)                           │
│     Mr. Sharma, Mrs. Patel, etc.                    │
│                    │                                │
│  6. Create Project (/projects/new)                   │
│     "Sharma Residence — 3BHK, Adyar"               │
│     Add rooms & products:                           │
│       Kitchen → 4 Base Units + 3 Wall Units         │
│       Bedroom → 1 Wardrobe + 1 TV Unit              │
│       etc.                                          │
└─────────────────────────────────────────────────────┘
```

---

## STEP 2: Purchase Flow (Procurement)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PURCHASE FLOW                                │
│                                                                  │
│  Employee                          Admin(s)                      │
│  ────────                          ────────                      │
│                                                                  │
│  ① Dashboard shows                                               │
│    "Reorder Alert: Plywood 18mm"                                │
│         │                                                        │
│         ▼                                                        │
│  ② Create PO (/purchase-orders/new)                              │
│    • Select vendor: Sri Lakshmi Plywood                         │
│    • Add items: Plywood 18mm × 50 sqm @ ₹95                    │
│    • System shows last rate & current stock                      │
│    • Click "Save & Submit for Approval"                          │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────┐                                         │
│  │  🔔 APPROVAL GATE 1 │──────────▶  All admins get             │
│  │   Purchase Order     │            push notification           │
│  └─────────────────────┘                   │                     │
│                                            ▼                     │
│                                   First admin opens it           │
│                                   Reviews: vendor, items,        │
│                                   amount, last rates             │
│                                            │                     │
│                                    ┌───────┴───────┐             │
│                                    ▼               ▼             │
│                               ✅ APPROVE      ❌ REJECT          │
│                                    │          (with reason)       │
│                                    │               │             │
│                                    │          Employee edits     │
│                                    │          & resubmits        │
│         ┌──────────────────────────┘                             │
│         ▼                                                        │
│  ③ Send PO to vendor                                             │
│    Click "Mark Sent to Vendor"                                  │
│         │                                                        │
│         ▼                                                        │
│  ④ Materials arrive at factory                                   │
│         │                                                        │
│         ▼                                                        │
│  ⑤ Create GRN (/grn/new)                                        │
│    • Select the PO                                              │
│    • Enter received qty per item                                │
│    • Quality check: Accept / Partial / Reject                   │
│    • Click "Create GRN & Update Inventory"                      │
│         │                                                        │
│         ▼                                                        │
│  ⑥ AUTO-UPDATES:                                                 │
│    ✅ Raw material stock increases                                │
│    ✅ New inventory batch created (FIFO)                          │
│    ✅ Last purchase rate updated                                  │
│    ✅ PO status → PARTIALLY/FULLY RECEIVED                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## STEP 3: Work Order Flow (Production Planning)

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORK ORDER FLOW                                │
│                                                                  │
│  Employee                          Admin(s)                      │
│  ────────                          ────────                      │
│                                                                  │
│  ① Create Work Order (/work-orders/new)                          │
│    • Select project: "Sharma Residence"                         │
│    • Add products:                                              │
│      Kitchen Base Unit × 4                                      │
│      Kitchen Wall Unit × 3                                      │
│      Wardrobe × 1                                               │
│         │                                                        │
│         ▼                                                        │
│  ② Click "Check Materials"                                       │
│    System shows per material:                                   │
│    ┌────────────────────────────────────────┐                    │
│    │ Material        Required  Available  ✓ │                    │
│    │ Plywood 18mm    17 sqm   50 sqm     ✅ │                    │
│    │ Laminate        22 sqm   100 sqm    ✅ │                    │
│    │ Cup Hinge       14 pcs   300 pcs    ✅ │                    │
│    │ Tandem Slide    4 pair   100 pair   ✅ │                    │
│    └────────────────────────────────────────┘                    │
│    If insufficient → shows deficit in RED                        │
│         │                                                        │
│         ▼                                                        │
│  ③ "Save & Submit for Approval"                                  │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────┐                                         │
│  │  🔔 APPROVAL GATE 2 │──────────▶  All admins notified        │
│  │   Work Order         │                  │                     │
│  └─────────────────────┘                   ▼                     │
│                                    Admin reviews:                │
│                                    project, products,            │
│                                    material cost,                │
│                                    stock sufficiency             │
│                                            │                     │
│                                    ✅ APPROVE                     │
│                                            │                     │
│  ④ AUTO-ACTIONS ON APPROVAL:               │                     │
│    ✅ BOM snapshot frozen                   │                     │
│    ✅ Raw materials auto-issued (FIFO)      │                     │
│    ✅ Inventory reduced automatically       │                     │
│    ✅ Production units created              │                     │
│       (4 kitchen units → 4 tracking rows)  │                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## STEP 4: Production Tracking (Shop Floor)

```
┌─────────────────────────────────────────────────────────────────┐
│                   PRODUCTION TRACKING                            │
│                                                                  │
│  Employee taps stages on phone/tablet                           │
│  (/work-orders/:id/production)                                  │
│                                                                  │
│  Kitchen Base Unit — Unit 1 of 4                                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                                                      │       │
│  │ ✅ Cutting → ✅ Edging → 🔵 Boring → ○ Assembly      │       │
│  │                           ↑                          │       │
│  │                      tap to complete                  │       │
│  │                                                      │       │
│  │ → ○ Shutter Prep → ○ Hardware → ○ QC                │       │
│  │                                                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  Stage Colors:                                                   │
│  ○ Gray    = Not started (tap to START)                          │
│  🔵 Blue   = In progress (tap to COMPLETE)                       │
│  ✅ Green   = Completed                                          │
│  ⬜ Dashed  = Next stage ready to start                          │
│                                                                  │
│  When QC is completed:                                           │
│  ✅ Finished good automatically created in inventory             │
│  ✅ Unit marked COMPLETED                                        │
│  ✅ When all 4 units done → WO auto-completes                   │
│                                                                  │
│  At any stage, employee can log WASTAGE:                        │
│  "2 sqm Plywood damaged during cutting"                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## STEP 5: Dispatch & Delivery (with Photos)

```
┌─────────────────────────────────────────────────────────────────┐
│                   DISPATCH & DELIVERY                            │
│                                                                  │
│  Employee                 Admin(s)              Driver           │
│  ────────                 ────────              ──────           │
│                                                                  │
│  ① Create Dispatch (/dispatches/new)                             │
│    • Select project                                             │
│    • Add finished goods                                         │
│    • Enter vehicle, driver name, phone                          │
│    • Enter delivery address                                     │
│    • "Save & Submit for Approval"                               │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────┐                                         │
│  │  🔔 APPROVAL GATE 3 │──────▶ Admin approves                  │
│  │   Dispatch           │                                        │
│  └─────────────────────┘                                         │
│         │                                                        │
│         ▼                                                        │
│  ② LOADING VERIFICATION (/dispatches/:id/loading)                │
│    ┌────────────────────────────────────────────┐                │
│    │ ☐ Kitchen Base Unit × 4   [📷 Take Photo]  │                │
│    │ ☐ Kitchen Wall Unit × 3   [📷 Take Photo]  │                │
│    │ ☐ Wardrobe × 1            [📷 Take Photo]  │                │
│    │ ☐ Loaded truck — full view [📷 Take Photo]  │                │
│    └────────────────────────────────────────────┘                │
│    • Photo each item showing condition                          │
│    • Verify each item ✅                                         │
│    • Click "Confirm Loading"                                    │
│         │                                                        │
│         ▼                                                        │
│  ③ AUTO-ACTIONS:                                                 │
│    ✅ Delivery challan PDF generated                              │
│    ✅ Finished goods deducted from inventory                      │
│    ✅ Unique delivery link generated                              │
│    ✅ Status → IN TRANSIT                                         │
│    📱 Send link to driver via WhatsApp                           │
│                                                                  │
│         │                                                        │
│         ▼                                                        │
│  ④ DRIVER DELIVERY (/delivery/{token})          ◀── Driver opens │
│    ┌────────────────────────────────┐               link on      │
│    │  DecoTrack Delivery            │               phone        │
│    │  DSP-2026-0001                 │               NO LOGIN     │
│    │                                │               NO APP       │
│    │  Sharma Residence, Adyar       │                            │
│    │  📍 42, 3rd Cross Street       │                            │
│    │                                │                            │
│    │  Confirm items received:       │                            │
│    │  • Kitchen Base Unit  exp. 4   │                            │
│    │    [qty: 4] [Confirm]          │                            │
│    │  • Kitchen Wall Unit  exp. 3   │                            │
│    │    [qty: 3] [Confirm]          │                            │
│    │  • Wardrobe           exp. 1   │                            │
│    │    [qty: 1] [Confirm]          │                            │
│    │  (driver adjusts qty down if   │                            │
│    │   something's short/damaged)   │                            │
│    │                                │                            │
│    │  [📷 Upload Delivery Photos]   │                            │
│    │  2 photos uploaded             │                            │
│    │                                │                            │
│    │  [✅ Mark as Delivered]         │                            │
│    │  (disabled until every item is │                            │
│    │   confirmed + 2 photos in)     │                            │
│    └────────────────────────────────┘                            │
│                                                                  │
│  ⑤ Employee reviews delivery photos (/dispatches/:id)            │
│    • Compares factory photos vs site photos                     │
│    • Per-item badge: Full: 4/4 ✅  or  Short: 2/3 ⚠️              │
│    • 🤖 Each site photo's GPS is checked against the geocoded    │
│        delivery address — flagged (not blocked) if it's          │
│        implausibly far away                                      │
│    Click "Confirm Delivery" → DELIVERED ✅                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## The 3 Approval Gates Summary

```
┌──────────────┬──────────────────┬──────────────────────────────┐
│    GATE      │     TRIGGER      │      WHAT ADMIN SEES         │
├──────────────┼──────────────────┼──────────────────────────────┤
│              │                  │                              │
│ 1. Purchase  │ Employee submits │ Vendor, items, quantities,   │
│    Order     │ PO for approval  │ rates, last purchase rates,  │
│              │                  │ total amount                 │
│              │                  │                              │
├──────────────┼──────────────────┼──────────────────────────────┤
│              │                  │                              │
│ 2. Work      │ Employee submits │ Project, products list,      │
│    Order     │ WO for approval  │ estimated material cost,     │
│              │                  │ stock sufficiency status     │
│              │                  │                              │
├──────────────┼──────────────────┼──────────────────────────────┤
│              │                  │                              │
│ 3. Dispatch  │ Employee submits │ Project, client, site addr,  │
│              │ dispatch for     │ items, quantities,           │
│              │ approval         │ vehicle/driver details       │
│              │                  │                              │
└──────────────┴──────────────────┴──────────────────────────────┘

Multi-Admin Rules:
• ALL admins get notified simultaneously
• First admin to act locks the item
• Other admins see "Approved by Senthil"
• Auto-approve if amount within admin's threshold
```

---

## AI Features (🤖 Gemini-powered)

```
┌─────────────────────┬───────────────────────────────────────────┐
│ Where                │ What it does                              │
├─────────────────────┼───────────────────────────────────────────┤
│ CRM → WhatsApp lead   │ Reads the incoming message, fills in city │
│                       │ + budget, drafts a summary and a         │
│                       │ suggested first reply                    │
├─────────────────────┼───────────────────────────────────────────┤
│ CRM → Lead            │ Photograph a carpenter's handwritten      │
│  (Site Visit /        │ measurement sheet — reads each room's     │
│   Measurement stage)  │ length/width/height (feet, cm, m all      │
│                       │ handled) straight into the lead           │
├─────────────────────┼───────────────────────────────────────────┤
│ Cut Planner           │ Photograph a handwritten/printed cutting  │
│                       │ list — reads label/length/width/qty       │
│                       │ straight into the panel table             │
├─────────────────────┼───────────────────────────────────────────┤
│ Dispatch photos       │ Delivery photo GPS checked against the    │
│  (geofence check)     │ geocoded delivery address, flagged if     │
│                       │ implausibly far — advisory only           │
└─────────────────────┴───────────────────────────────────────────┘

All of these are reviewed by a person before anything is finalized —
none of them auto-send, auto-approve, or auto-complete anything.
Needs GEMINI_API_KEY set (free tier) — without it, each feature just
fails gracefully and you fall back to typing it in by hand.
```

---

## Login Credentials (Dev)

| Role     | Email               | Password     |
|----------|---------------------|--------------|
| Employee | ravi@decotrack.in   | decotrack123 |
| Admin    | senthil@decotrack.in| decotrack123 |
| Admin    | priya@decotrack.in  | decotrack123 |
| Admin    | kumar@decotrack.in  | decotrack123 |

---

## URLs

| Page            | URL                           |
|-----------------|-------------------------------|
| Frontend        | http://localhost:5200          |
| Backend API     | http://localhost:8888          |
| API Docs        | http://localhost:8888/docs     |
| Driver Delivery | http://localhost:5200/delivery/{token} |
| User Guide (admin only) | http://localhost:5200/admin/user-guide |

Ports above match this machine's current dev setup (`docker-compose.dev.yml`) — remapped from the
defaults (8000/5432/5173) because another local project was already using them. If that's not your
situation, the defaults in `docker-compose.dev.yml` apply instead.
