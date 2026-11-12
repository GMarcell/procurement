# Procura — Procurement Management App

**Product Requirements Document (PRD)**
Version 1.0 · November 2026 · Status: Ready for build

---

## 1. Overview

Procura is a small, focused procure-to-pay (P2P) web application for a single company. It replaces the spreadsheet-and-email loop with one system that tracks a request from **"we need this"** to **"it is in the warehouse and paid for"**.

The app covers the full purchasing cycle:

```
Product / Vendor master data
        ↓
Purchase Request → Approval → Assign Vendor
        ↓
Purchase Order → Approval
        ↓
Payment Request → Approval → Paid
        ↓
Proof of Delivery → Inventory stock + movement history
```

The guiding principle is **simple and understandable**: one approval at each step, clear statuses, server-side totals, and no hidden automation. Every record is readable by a human without training.

---

## 2. Goals & non-goals

### Goals
- One source of truth for products, vendors, requests, orders, payments, deliveries, and stock.
- A complete, demoable flow from purchase request to stock movement.
- Role-based actions: requesters request, approvers approve, procurement admins execute.
- Automatic, auditable inventory updates when goods are received.
- Clean, responsive UI that a non-technical purchaser can use.

### Non-goals (v1)
- Multi-tenant or multi-company support.
- Multi-currency, tax/VAT, shipping, or discount calculations.
- RFQ / quotation comparison / vendor bidding.
- Splitting one request across multiple vendors.
- Partial **payment** requests (one active payment request per PO; rejected attempts remain in history).
- Email/push notifications, PDF exports, file storage, accounting integration.
- Vendor portal and external login.

---

## 3. Users & roles

| Role | Code | Typical user | Summary |
| --- | --- | --- | --- |
| Requester | `REQUESTER` | Department staff | Creates purchase requests and follows their progress. |
| Approver | `APPROVER` | Department / finance manager | Reviews and approves or rejects requests, orders, and payments. |
| Admin | `ADMIN` | Procurement / purchasing officer | Runs the process: master data, vendor assignment, POs, payments, deliveries, stock. |

### Permission matrix

| Capability | Requester | Approver | Admin |
| --- | :---: | :---: | :---: |
| View dashboard, products, vendors, inventory | ✓ | ✓ | ✓ |
| Create purchase request | ✓ | — | ✓ |
| View own purchase requests | ✓ | ✓ (all) | ✓ (all) |
| Approve / reject purchase request | — | ✓ | ✓ |
| Assign vendor to request | — | — | ✓ |
| Create purchase order | — | — | ✓ |
| Approve / reject purchase order | — | ✓ | ✓ |
| Create payment request | — | — | ✓ |
| Approve / reject payment request | — | ✓ | ✓ |
| Mark payment as paid | — | — | ✓ |
| Record proof of delivery | — | — | ✓ |
| Adjust inventory | — | — | ✓ |
| Create / edit products and vendors | — | — | ✓ |
| Approve own submission | n/a | ✓ | ✓ (single-admin demo mode) |

Access is enforced **server-side** in every action and page, not just by hiding buttons.

---

## 4. End-to-end workflow

### 4.1 Happy path

1. **Request** — a requester creates a purchase request with one or more products, quantities, estimated prices, a purpose, and a needed-by date. It is submitted immediately.
2. **Approve request** — an approver approves or rejects it with a reason.
3. **Assign vendor** — procurement admin picks exactly one vendor for the approved request.
4. **Create PO** — the admin creates a purchase order from the request. Quantities come from the request; unit prices are confirmed with the vendor. The PO is submitted for approval.
5. **Approve PO** — an approver approves the PO. Only then can money and goods be requested.
6. **Payment request** — the admin raises a payment request against the approved PO (amount, due date, method).
7. **Approve payment** — an approver approves or rejects it; the admin marks the approved payment as paid.
8. **Proof of delivery** — when goods arrive, the admin records the delivery: delivery note number, receiver, condition, notes, and the quantity received per line.
9. **Inventory** — each received quantity is added to stock and written to the inventory movement history. The PO completes automatically when every line is fully received.

### 4.2 Status lifecycles

**Purchase Request**

```
SUBMITTED ──approve──▶ APPROVED ──assign vendor──▶ ASSIGNED ──create PO──▶ ORDERED
    │                                                  ▲                        │
    ├──reject──▶ REJECTED                              └──order rejected────────┘
    └──cancel (requester)──▶ CANCELLED                        (re-order)
```

**Purchase Order**

```
PENDING ──approve──▶ APPROVED ──receive goods──▶ PARTIALLY_RECEIVED ──▶ COMPLETED
   │
   └──reject──▶ REJECTED
```

- `APPROVED` with a first full delivery becomes `COMPLETED` in one step.
- `PARTIALLY_RECEIVED` becomes `COMPLETED` when every line reaches its ordered quantity.
- Rejecting a PO sends its request back to `ASSIGNED` so procurement can review the vendor and raise a replacement order. Rejected orders stay in the request's order history.

**Payment Request**

```
PENDING ──approve──▶ APPROVED ──mark paid──▶ PAID
   └──reject──▶ REJECTED ──raise replacement──▶ PENDING
```

Rejecting a payment leaves the order payable: procurement can raise a replacement payment request, while rejected attempts stay visible on the order and in the payments list.

### 4.3 Key numbers
- Purchase request: `PR-YYYY-0001`
- Purchase order: `PO-YYYY-0001`
- Payment request: `PAY-YYYY-0001`

Generated atomically from a database sequence per document type and year, so numbers are unique even under concurrent use.

---

## 5. Functional requirements

### 5.1 Dashboard
- KPI cards: open requests, orders awaiting approval, payments awaiting approval, low-stock products, and spend paid this month.
- Pending approvals list (requests, POs, payments) with links.
- "Needs a replacement" alert listing rejected orders still awaiting re-ordering and rejected payments without a replacement, scoped to the requester's own documents. Each entry links to the page where the replacement is raised and disappears once one exists.
- Recent purchase requests with requester, amount, and status.
- Low-stock products (stock at or below minimum).
- Six-month spend trend (approved/paid orders) as a lightweight bar chart.

### 5.2 Product master data
- Fields: SKU (unique), name, category, unit (e.g. pcs, box), unit price, current stock, minimum stock, optional description, active flag.
- List with search by name/SKU/category, stock status, and "Low stock" indicator.
- Create and edit. Products are deactivated rather than deleted so history stays intact.
- Stock is read-only here; it changes through deliveries and adjustments.

### 5.3 Vendor master data
- Fields: vendor code (unique), name, contact person, email, phone, address, payment terms (e.g. NET 30), active flag.
- List with search and status.
- Create and edit; deactivate instead of delete.

### 5.4 Purchase requests
- Create: department, purpose, needed-by date (optional), line items (product, quantity, estimated unit price), notes.
- Live line totals and grand total, computed by the server on save.
- Requester sees only their own requests; approvers and admins see all.
- Detail page shows the request timeline (created, approved, vendor assigned, PO), line items, totals, and available actions.
- A requester may cancel while `SUBMITTED`.
- An approver may approve or reject (reason required) while `SUBMITTED`.
- Duplicate product lines are merged when saving.

### 5.5 Vendor assignment
- Admin chooses one active vendor for an `APPROVED` request and records an optional note.
- Assignment moves the request to `ASSIGNED` and is shown on the request and PO.
- The vendor cannot be changed after a PO exists.

### 5.6 Purchase orders
- Created only from an `ASSIGNED` request, with one active PO at a time. After a rejection the request returns to `ASSIGNED` and a replacement can be created; earlier rejected orders remain visible.
- Line quantities are inherited from the request and cannot be reduced below what was requested; unit price is editable.
- Optional expected delivery date and notes.
- Server computes subtotal and total.
- Created with status `PENDING` (awaiting approval) and moves the request to `ORDERED`.
- Detail page: vendor, lines, totals, approval trail, payment request, deliveries, and actions.
- Approver can approve or reject while `PENDING`.

### 5.7 Payment requests
- Created only for an `APPROVED` (or partially received) PO, with one active payment at a time. After a rejection, a replacement can be raised; rejected attempts remain in the payment history.
- Fields: amount (defaults to PO total, cannot exceed it), due date, method (`BANK_TRANSFER`, `CASH`, `CHEQUE`, `CREDIT_CARD`), notes.
- Status starts `PENDING`; approver approves or rejects with a reason.
- Admin marks an approved payment as `PAID` (records the timestamp).

### 5.8 Proof of delivery / goods receipt
- Available for an `APPROVED` or `PARTIALLY_RECEIVED` PO.
- Fields: received date, received by (name), delivery note number, condition (`GOOD`, `DAMAGED`, `PARTIAL`), notes, optional proof link (photo/document URL), and quantity received per PO line.
- Validation: at least one line > 0; no line may exceed its remaining quantity.
- Saving a delivery runs in a transaction:
  1. create the delivery header and lines,
  2. increment each PO line's received quantity,
  3. increment product stock,
  4. write an `IN` inventory movement per line with a reference to the delivery,
  5. update PO status to `PARTIALLY_RECEIVED` or `COMPLETED`.
- Delivery history is listed on the PO with who recorded it and when.

### 5.9 Inventory
- Stock overview per product: on-hand, minimum, status (`In stock`, `Low`, `Out`), stock value at unit price.
- Search and filter by category/low stock.
- Movement ledger: date, product, type (`IN`, `OUT`, `ADJUSTMENT`), quantity, reference, note, user.
- Admin adjustment form: product, signed quantity (+/−), reason. Creates an `IN`/`OUT`/`ADJUSTMENT` movement and updates stock; stock can never go below zero.
- KPI strip: total products, low stock, out of stock, total stock value.

### 5.10 Approvals
- A single queue page for approvers/admins listing all pending requests, POs, and payments, each linking to its detail page.
- Actions live on detail pages so the approver sees the full context before deciding.

### 5.11 Authentication & demo
- Email/password login (NextAuth credentials, bcrypt hashes).
- Seeded accounts for each role; the login page offers one-click demo sign-in.
- Dashboard layout requires a session; unauthenticated users are redirected to `/login`.
- Logout from the sidebar.

---

## 6. Screens

| # | Route | Purpose |
| --- | --- | --- |
| 1 | `/login` | Sign in + demo accounts |
| 2 | `/dashboard` | KPIs, approvals, recent activity |
| 3 | `/products` | Product list, search, low-stock filter |
| 4 | `/products/new`, `/products/[id]/edit` | Product form |
| 5 | `/vendors` | Vendor list, search |
| 6 | `/vendors/new`, `/vendors/[id]/edit` | Vendor form |
| 7 | `/purchase-requests` | Request list (scoped by role) + filter |
| 8 | `/purchase-requests/new` | Request form with line items |
| 9 | `/purchase-requests/[id]` | Detail, approve/reject, cancel, assign vendor, create PO |
| 10 | `/purchase-orders` | PO list + filter |
| 11 | `/purchase-orders/[id]` | Detail, approve/reject, payment, delivery, receipt history |
| 12 | `/payments` | Payment list + filter |
| 13 | `/payments/[id]` | Detail, approve/reject, mark paid |
| 14 | `/inventory` | Stock table, adjustment form, movement ledger |
| 15 | `/approvals` | Pending approvals queue |

All list pages support status/search filtering via URL query parameters. Empty states explain the next step.

---

## 7. Data model

```
User 1─* PurchaseRequest 1─* PurchaseRequestItem *─1 Product
                  │ 0..1 vendor
                  │ 1─* orders (rejected attempts kept)
                  ▼
              PurchaseOrder 1─* PurchaseOrderItem *─1 Product
                  │ 1─* PaymentRequest (rejected attempts kept)
                  │ 1─* GoodsReceipt 1─* GoodsReceiptItem *─1 PurchaseOrderItem
                  │
Product 1─* InventoryMovement

Sequence (key, value) — atomic document numbering
```

| Entity | Key fields |
| --- | --- |
| `User` | id, name, email (unique), password hash, role |
| `Product` | id, sku (unique), name, category, unit, unitPrice, stockQty, minStock, description, isActive |
| `Vendor` | id, code (unique), name, contactName, email, phone, address, paymentTerms, isActive |
| `PurchaseRequest` | id, number (unique), requesterId, department, purpose, neededBy, status, vendorId?, assignedById?, assignedAt?, approvedById?, approvedAt?, rejectionReason?, notes |
| `PurchaseRequestItem` | id, requestId, productId, quantity, estimatedUnitPrice |
| `PurchaseOrder` | id, number (unique), requestId, vendorId, createdById, status, orderDate, expectedDate, subtotal, total, notes, approvedById?, approvedAt?, rejectionReason? |
| `PurchaseOrderItem` | id, orderId, productId, quantity, unitPrice, receivedQty |
| `PaymentRequest` | id, number (unique), orderId, amount, dueDate, method, status, notes, requestedById, approvedById?, approvedAt?, rejectionReason?, paidAt? |
| `GoodsReceipt` | id, orderId, receivedDate, receivedBy, deliveryNoteNo, condition, notes, proofUrl, recordedById |
| `GoodsReceiptItem` | id, receiptId, orderItemId, quantity |
| `InventoryMovement` | id, productId, type, quantity, reference, note, createdById |
| `Sequence` | key (PK), value |

Money uses `Decimal(12, 2)`; all totals are computed on the server.

---

## 8. Business rules & validation

- Every action re-checks the session and role; ownership checks apply to requesters.
- Status transitions are validated server-side; illegal transitions return a readable error.
- Product SKU and vendor code are unique (case-insensitive lookup on input).
- Quantities are positive integers; prices and payment amounts are positive and rounded to 2 decimals.
- A payment amount cannot exceed the PO total.
- A delivery quantity cannot exceed `ordered − already received`.
- Stock never goes negative; adjustments must be non-zero.
- Approvals and rejections store the acting user and timestamp; rejection requires a reason.
- Deleting is avoided: products/vendors are deactivated; documents are cancelled/rejected.
- All mutations call `revalidatePath` so lists and dashboards stay current.

---

## 9. Technical design

**Stack (matches the workspace's usual stack)**
- Next.js 16 App Router, React 19, TypeScript (strict)
- Tailwind CSS 4, small in-house UI primitives (no component library dependency)
- PostgreSQL 16 (dedicated Docker container)
- Prisma ORM 5 with migrations and a TypeScript seed
- NextAuth v5 credentials provider + bcryptjs
- Zod for server-side input validation
- Server Components for reads, Server Actions for writes

**Project structure**

```
procurement/
├─ prisma/
│  ├─ schema.prisma
│  ├─ seed.ts
│  └─ migrations/
├─ src/
│  ├─ app/
│  │  ├─ (dashboard)/…        # authenticated pages
│  │  ├─ actions/…            # server actions per module
│  │  ├─ api/auth/[...nextauth]/route.ts
│  │  ├─ login/page.tsx
│  │  ├─ layout.tsx
│  │  └─ globals.css
│  ├─ components/
│  │  ├─ ui/…                 # button, input, card, table, badge…
│  │  └─ …                    # forms, sidebar, status badge
│  └─ lib/
│     ├─ auth.ts, prisma.ts, permissions.ts
│     ├─ format.ts, numbering.ts, constants.ts
│     └─ queries.ts (dashboard aggregates)
└─ .env.example
```

**Why server actions:** one code path per mutation in the same app, no separate REST layer to keep in sync — easier to read and explain. Forms are progressively enhanced and validated again on the server.

**Database:** dedicated container `procurement-app-db` on `127.0.0.1:5435`, database `procurement`. The app never touches other databases on the machine.

---

## 10. Seed data & demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin (procurement) | `admin@procura.app` | `password123` |
| Approver (manager) | `manager@procura.app` | `password123` |
| Requester (staff) | `staff@procura.app` | `password123` |
| Requester (second team) | `staff2@procura.app` | `password123` |

Seed includes ~10 products across IT, office, and industrial categories; 5 vendors; requests in `SUBMITTED`, `APPROVED`, `ASSIGNED`, and `REJECTED` states; an approved PO with a paid payment and completed delivery; a PO awaiting approval; a payment awaiting approval; and matching inventory movements so the dashboard and reports look real.

---

## 11. Acceptance criteria

1. A requester can sign in, create a request with multiple lines, and see it listed as `SUBMITTED`.
2. An approver sees it in `/approvals`, opens it, approves it, and the status becomes `APPROVED`.
3. An admin assigns a vendor; status becomes `ASSIGNED`.
4. The admin creates a PO from the request; prices are editable, totals are correct, stock is unchanged, and the request becomes `ORDERED`.
5. The approver approves the PO; payment request creation becomes available.
6. The admin creates a payment request for the PO total, the approver approves it, and the admin marks it `PAID`.
7. The admin records a partial delivery; received quantities and product stock increase, movements are logged, and the PO shows `PARTIALLY_RECEIVED`.
8. A second delivery completes the PO; stock reflects ordered quantities and the PO shows `COMPLETED`.
9. Invalid actions (double approval, over-receipt, over-payment, stock below zero, requester acting on someone else's document) are blocked with clear messages.
10. `npm run build` passes, migrations apply to a fresh database, and the seed runs idempotently enough for a clean demo.
11. The UI works at desktop and mobile widths; every list has a useful empty state.
12. Rejecting a PO returns the request to vendor-assigned; a replacement can be ordered and the rejected attempt stays in the request history.
13. Rejecting a payment allows a replacement payment request; the rejected attempt stays visible while the replacement can be approved and paid.

---

## 12. Future ideas (explicitly out of v1)

- Vendor quotation/RFQ comparison and multi-vendor splitting.
- Partial payments, invoices, and three-way matching.
- File uploads (delivery photos) via object storage.
- Email notifications and approval escalation.
- PDF purchase orders and payment vouchers.
- Per-department budgets and spend controls.
- Audit log with before/after values and comments.
