# LedgerFlow

**Financial clarity for small service businesses.**

LedgerFlow is a multi-tenant SaaS financial operations platform that helps small
service businesses, consulting firms, agencies, contractors, software shops, and
partnerships answer the questions that actually matter:

- How much did we earn?
- Which invoices are unpaid?
- How much cash is actually available to spend?
- How much should we reserve for taxes?
- How much can safely be distributed to each owner?

LedgerFlow is not a replacement for QuickBooks, professional bookkeeping,
payroll software, or tax filing software.  It is the layer above them that gives
owners day-to-day clarity.

---

## Stack

- Next.js 15 (App Router) with React 19 and TypeScript
- Tailwind CSS + shadcn-style UI primitives
- Prisma ORM against MySQL
- NextAuth v5 (credentials + JWT sessions), bcrypt password hashing
- Zod validation on every server action
- Recharts for financial charts
- `pdfkit` for professional invoice PDFs
- OpenAI Responses API for the financial assistant

## Architecture

```
src/
├── app/                       # Next.js App Router — pages, layouts, API routes
│   ├── (auth)/                # /login, /register, /forgot-password, /reset-password
│   ├── onboarding/            # 4-step business setup wizard
│   ├── app/[organizationSlug]/# Tenant-scoped workspace (dashboard, invoices, …)
│   └── api/                   # NextAuth, PDF, CSV exports, AI ask endpoint
├── components/                # Presentational components + shadcn primitives
├── features/                  # Server actions & UI grouped by domain
├── services/                  # Business logic — reusable across pages & APIs
├── lib/
│   ├── auth/                  # NextAuth setup + session helpers (multi-tenant guard)
│   ├── db/prisma.ts           # Prisma singleton
│   ├── money/                 # Decimal-safe money helpers
│   ├── dates/                 # Date helpers (timezone-safe)
│   ├── permissions/           # Role → permission mapping
│   ├── openai/                # OpenAI client factory
│   ├── storage/               # Pluggable storage (local now, S3 later)
│   ├── audit/                 # Audit + activity logging
│   └── ratelimit/             # In-memory rate limiter (swap for Redis)
└── ...
prisma/
├── schema.prisma              # Full data model
└── seed.ts                    # Demo seed
tests/                         # Vitest unit tests
```

Every organisation-scoped read/write goes through `requireOrgAccess(slug, permission?)`
which:

1. Requires an authenticated user.
2. Looks up the user's membership on the requested organisation.
3. Verifies the membership has the required permission.

There is no code path that trusts an `organizationId` from the client. All
records are scoped by organisation at query time.

## Environment variables

Copy `.env.example` to `.env` and fill in real values:

```bash
DATABASE_URL="mysql://user:password@host:3306/ledgerflow"
AUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5.6-luna"     # default; override to any current model
```

Optional (all default to sensible dev behaviour):

- `STORAGE_DRIVER`, `S3_*` — object storage
- `EMAIL_FROM`, `RESEND_API_KEY` — email delivery for invitations / resets

## Local development

Requires Node 20+ and access to a MySQL 8 database.

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
$EDITOR .env

# 3. Push the schema to your database
npx prisma migrate deploy          # in production
# or, in development:
npx prisma migrate dev --name init

# 4. Optional: load demo data
npm run seed

# 5. Run dev server
npm run dev
```

Sign in with the seeded demo account:

- Email: `demo@ledgerflow.dev`
- Password: `demo1234`

The seed creates a two-owner consulting workspace called *Acme Consulting* with
three clients, four projects, twelve months of invoices/payments/expenses,
distributions, and quarterly tax payments.

## Creating your first admin user

The registration flow at `/register` creates a User → then `/onboarding` walks
through business setup and creates the first OWNER membership. No admin-only
CLI is required; simply register and you become the owner of any workspace you
create.

To promote a user of an existing workspace, update their `OrganizationMembership.role`
in the database.

## Money handling

- All monetary fields are `Decimal(18,2)` in MySQL.
- All calculations use [`decimal.js`](https://mikemcl.github.io/decimal.js/) via
  helpers in `src/lib/money/money.ts` (`moneyAdd`, `moneyMultiply`, `moneyRound`,
  `allocateByWeights`, …). Never use JS floats for authoritative amounts.
- Invoice totals are computed server-side. The browser can preview totals, but
  the server always recomputes.

## Multi-tenant safety

- `Organization` is the tenant boundary. Everything hangs off it.
- `OrganizationMembership` grants a `User` a role on a specific `Organization`.
- Cross-tenant access is blocked at the query layer: every server action calls
  `requireOrgAccess` and every relation includes `organizationId` in the where
  clause.
- `Prisma.$transaction` is used whenever multiple records must move together
  (payment ↔ invoice, invoice creation ↔ invoice number reservation, …).

## Invoicing

- Invoice numbering is atomic: `reserveInvoiceNumber` uses an
  optimistic-locking `updateMany({ where: { invoiceNextNumber: current } })`
  with retry — safe under concurrent requests.
- PDF invoices render server-side via `pdfkit` and are streamed from
  `/api/invoices/[invoiceId]/pdf`. Only members of the invoice's organisation
  can request the PDF.
- Draft invoices can be deleted; sent/paid invoices can only be voided.
  Payments are reversed rather than hard-deleted.

## Tax planning

Tax numbers are **planning estimates** — never tax advice, never a filed return.
Everything in this section is designed to help owners plan cash, not compute
liability.

### Terminology

| Term                      | Meaning                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Sales tax**             | Customer-facing tax charged on an invoice. Unrelated to income-tax planning or an owner's tax reserve.     |
| **Tax reserve**           | Internal cash-planning amount owners intend to set aside for future taxes.                                 |
| **Tax payment**           | Cash actually sent to a tax authority (IRS, state, local). Moving cash to a savings account is *not* one.  |
| **Cash earmarked for taxes** | Money kept in a reserve account. Still part of recorded cash, but protected from distribution.          |
| **Distribution**          | Cash paid to an owner. Distributions do **not** determine an owner's taxable share of business profit.     |
| **Allocated profit**      | An owner's share of estimated business profit for planning purposes (driven by ownership percentage).      |

### Owner-centric planning

Each owner has:

- `ownershipPercentage` — drives allocation of estimated business profit.
- `distributionPercentage` — drives the split of the distributable cash pool.
- `taxReserveOverride` (%) — optional per-owner override on the org default rate.
- `stateReserveRate` (%) — optional state planning add-on (Advanced mode).
- `residenceState`, `filingStatus` — informational for advanced planning.

Simple mode uses `taxReserveOverride ?? defaultTaxReserveRate`. Advanced mode
additionally sums `stateReserveRate` on top. Advanced mode is a scaffold — it
does **not** silently apply federal brackets or wage bases. Statutory values,
when added, must be year-versioned and covered by tests.

### Formulas

```
planningProfit          = payments received − deductible business expenses
ownerAllocatedProfit    = max(0, planningProfit) × ownership%
ownerReserveRate        = taxReserveOverride ?? defaultTaxReserveRate  (+ stateReserveRate in ADVANCED)
ownerReserveTarget      = ownerAllocatedProfit × ownerReserveRate
ownerRemainingReserve   = max(0, ownerReserveTarget − ownerEstimatedTaxPaymentsYTD)
orgReserveTarget        = Σ ownerReserveTarget
orgRemainingReserve     = max(0, orgReserveTarget − Σ ownerTaxPaymentsYTD)
unfundedReserve         = max(0, orgRemainingReserve − cashEarmarkedForTaxes)
safeToDistribute        = max(0, recordedCash − unfundedReserve − operatingReserve)
```

- **Earmarked cash does NOT reduce recorded cash.** Moving $2,100 between
  Mercury checking and Mercury savings does not change the balance sheet — it
  just makes that $2,100 protected from distribution.
- **Distributions use `distributionPercentage`**, not ownership.
- Recording a tax payment is what actually reduces recorded cash.

### Historical snapshots

`TaxEstimate` stores planning snapshots keyed by `year` and optionally `ownerId`,
with an `asOfDate` timestamp. Multiple snapshots per year are preserved so the
app can answer "what did we plan for at end of Q3?".

### Bank-ready account abstraction

`FinancialAccount` is a lightweight scaffold for future bank sync (Plaid,
Mercury, etc.). Today it supports manual balances. `purpose = TAX_RESERVE`
accounts are the canonical representation of earmarked cash; the manual
`Organization.taxReserveEarmarked` value is the current source of truth and
will remain valid until a live-sync driver is implemented. LedgerFlow never
stores full account numbers — only `lastFour`.

### US federal quarterly defaults

Suggested quarterly dates are provided but editable per organization. All
`TaxPayment` records support a `taxYear`, `taxPeriod`, `ownerId`, and
`jurisdiction` so state and local schedules can be tracked alongside federal.

## AI assistant

- Uses the OpenAI Responses API and the model in `OPENAI_MODEL`
  (default `gpt-5.6-luna`).
- Every request is server-side. The API key never touches the browser.
- `buildFinancialContext` produces a compact JSON of the current
  organisation's aggregates and passes it as the assistant's context.
- The assistant is prompted to refuse to invent numbers, to label tax numbers
  as planning estimates, and to never reveal secrets or cross-tenant data.
- Usage is logged to `AIUsage` (tokens, model, feature) for cost visibility.
- Per-user rate limit: 20 requests / minute per organisation (swap
  `src/lib/ratelimit/ratelimit.ts` for Redis in production).

## Testing

```bash
npm test          # single run
npm run test:watch
```

Included tests cover:

- Decimal money helpers (add, subtract, multiply, round, allocateByWeights)
- Invoice total computation with discount/tax
- Invoice status recomputation (paid, partially paid, overdue)
- Role → permission mapping

## Deployment

- Build: `npm run build` (runs `prisma generate` + `next build`).
- Suitable for Vercel or any Node 20+ host.
- Use a pooled MySQL connection (PlanetScale, Neon/MySQL via a proxy, RDS with
  ProxySQL, …) — the Prisma client is a singleton, but each serverless instance
  will still open a connection.
- Set `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `OPENAI_API_KEY`, and
  `APP_URL` in your host's environment. Everything else is optional.

## Security

- Passwords hashed with bcrypt (cost 12).
- CSRF handled by NextAuth session cookies.
- No stack traces in server-action error responses — a `{ code, message }`
  envelope is returned instead.
- OpenAI API key server-only, guarded by an in-memory rate limiter.
- Audit log records every important mutation (invoice, payment, distribution,
  tax, owner, settings) with before/after JSON.

## Future integrations (structured but not implemented)

- Stripe subscriptions (schema fields exist on `Organization`).
- Bank sync (Plaid) — replace `RecordedCash` derivation with reconciled ledger.
- S3-compatible storage — implement the `StorageDriver` interface.
- Email (Resend/Postmark) — replace the dev-mode placeholder in `requestPasswordResetAction`.
- Scheduled jobs — `RecurringInvoice` and `TaxPayment` reminders.

## Legal boundary

LedgerFlow is management-accounting / financial-operations software. It does
**not** produce GAAP financial statements, file tax returns, provide tax advice,
provide legal advice, or replace a CPA. Every tax-related figure is labelled as
a *planning estimate*.
