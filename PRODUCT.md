# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the business owner, plus one trusted helper.** The owner runs the books — issuing invoices, chasing what is owed, logging everyday expenses. A second person (spouse, shop assistant, bookkeeper) also enters invoices and payments in practice.

The two work across both phone and desktop *equally*. Invoices get created wherever the work happens — at a counter, on the move, at a desk in the evening. Neither layout is the secondary one.

**Open product decision:** the current version gives each account a separate private workspace and explicitly does not support shared staff books. The helper therefore shares the owner's single login today. Whether this becomes real multi-user (separate accounts, one shared workspace, per-person attribution on entries) is undecided. Future design must not assume a single pair of hands, and must not invent a sharing model that does not exist yet.

## Product Purpose

Opervia replaces a **paper invoice book** — carbon-copy duplicates, handwritten line items, a manual receivables ledger kept by memory and arithmetic.

It exists so that the totals are right, the history is durable, and the owner always knows who owes what. Success is the owner trusting Opervia the way they trusted the paper book: it is the record, it is on hand, and it produces the document the customer actually receives.

Displacing paper — not spreadsheets, not accounting software — sets the standard. The app must be at least as fast as writing a line by hand, and at least as legible as the sheet it replaces.

## Positioning

A paper-invoice-book replacement built for the Mauritian small business, where the **printed A4 invoice is the product**, the ledger is a by-product of issuing it, and the financial record is append-only by construction.

The mechanism a neighboring product could not truthfully copy: totals, validation, ownership, and numbering are computed and enforced **server-side in PostgreSQL** (`create_invoice`, `record_payment`, `void_invoice` under row-level security), with UUID idempotency and row locking. The browser cannot write an invoice or payment table directly. The arithmetic and the audit trail are not a frontend promise.

It does not try to be accounting software. It deliberately omits credit notes, refunds, bank reconciliation, opening balances, inventory, VAT filing, and double-entry.

## Operating Context

- **The paper artifact is still the deliverable.** Invoices are printed or saved as PDF to A4 and handed to the customer. A **blank invoice sheet** — business details, fourteen empty rows — is printed for handwriting when the job is faster with a pen. Both are first-class outputs.
- **Mauritius.** Amounts in MUR, rounded to cents. Business identity is a trading name, optional proprietor name, and an **individual or company BRN**. Tax defaults to zero; a rate is entered only when applicable to the business.
- **Line items carry sections** (e.g. *Kitchen* / *Bar*), quantities to three decimals, and units — the shape of a real trade invoice, not a generic product list.
- **Two modes of entry:** a demo workspace (fictional data, memory-only, never reaches Supabase) used for exploring and for end-to-end tests, and the real signed-in workspace.
- **Workflow:** add customer → create invoice (optional deposit) → print/hand over → record partial or full payments → watch the receivables balance → export CSV when an outside party needs the numbers. Expenses are recorded separately and are never customer debt.
- **Auth reality:** email/password with confirmation, PKCE reset completed in the same browser, custom SMTP required for reliable delivery. Sign-out matters on shared devices.

## Capabilities and Constraints

**Surfaces:** Overview, Invoices, Ledger, Customers, Expenses, Settings — plus the Auth surface and the print surface (`InvoicePrint.tsx`). Modal-based creation for invoice, customer, expense, and blank sheet.

**Confirmed capabilities:** customer records; invoices with sections, fractional quantities, units, notes, tax rate, optional deposit; partial payments with history; running receivables balance with customer filtering; CSV export; expense recording; invoice voiding; blank printable sheet; editable business and bank details that snapshot onto issued invoices.

**Durable constraints (non-negotiable):**

1. **MUR and the Mauritian context.** Not a generic multi-currency product. BRN, local invoice conventions, MUR to cents.
2. **The printed A4 invoice is the deliverable.** The print layout is a primary surface, must stay clean across page breaks, and the blank sheet must stay handwriting-compatible at fourteen rows.
3. **Financial history is immutable.** No deleting or editing past records. Void-only; a voided invoice stays visible in history and is excluded from balances. An invoice with payments cannot be voided. The interface must never imply a record can be changed.
4. **"Net cash movement" is not profit.** The Overview figure is received payments minus recorded expenses. No P&L framing, no "profit" label, no implication of an accounting result.

**Further technical constraints:** invoice numbers come from a PostgreSQL sequence — global, and gaps are possible, so the UI must not present them as contiguous. Account numbers are stored as text to preserve leading zeros. Issued invoices retain their original business/customer snapshots; editing Settings must not appear to rewrite history. The frontend holds only a publishable key. No arbitrary HTML is rendered.

**Explicitly out of scope in this version:** credit notes, refunds, expense corrections, draft persistence, shared staff workspaces, bank reconciliation, opening balances, inventory, VAT filing, double-entry accounting.

## Brand Commitments

Name: **Opervia**, set lowercase as a wordmark (`opervia`).

**Identity mark:** `public/favicon.svg` — a rounded-square mark in Ledger Green carrying a lime "O" aperture with a paper-white quadrant. It ships as the favicon, the Apple touch icon (`public/apple-touch-icon.png`), and the in-app mark, and is rendered through the shared `src/Brand.tsx` component so the sign-in screen and the sidebar cannot drift apart. This is a binding asset: new surfaces reuse it rather than drawing their own.

It belongs to the *application*, not to the user's business. It must never appear on the printed invoice or the blank sheet — those carry the user's own trading name, BRN and bank details, and branding someone else's commercial document is not Opervia's to do.

Voice, as evidenced by existing product copy and documentation: precise, plain, and careful about what it does *not* claim — it distinguishes net cash movement from profit, CSV export from backup, and existence checks from verification. That carefulness is a brand commitment: **Opervia does not overstate.**

## Evidence on Hand

- Real product docs: `README.md`, `SUPABASE-STATUS.md`.
- The database migration and three validated write functions: `supabase/migrations/202609130001_opervia.sql`.
- Domain tests (`src/domain.test.ts`) and PGlite tests exercising the real migration; Playwright desktop + mobile demo workflows with screenshots in `test-results/`.
- A demo dataset (`src/demo.ts`) — **fictional**, modeled on the supplied paper invoice format.
- The incumbent visual system lives in `src/styles.css` (~2,200 lines) with Lucide icons.

**Absences future work must not fabricate:** there are no customers, testimonials, case studies, press mentions, usage numbers, pricing, or benchmarks. Real business details (trading name, BRN, bank account) are entered by the user through Settings and are never seeded in source. Any example business shown in the product is demo data and must read as such.

## Product Principles

1. **Beat the paper book on its own terms.** Faster than writing a line by hand, and at least as legible as the sheet it replaces. Speed of entry outranks visual expression.
2. **The printed invoice is the product.** Screen design serves the document the customer receives; the print surface is never treated as an export afterthought.
3. **Never overstate the number.** Labels say exactly what a figure is. Where a value could be mistaken for profit, tax advice, or a verified balance, the interface says what it actually is.
4. **The record is append-only, and the UI must feel that way.** Voiding is visible and honest; nothing should look editable that isn't, and nothing destructive should be reachable by accident.
5. **Two hands, two devices, one truth.** Phone and desktop are equal surfaces. A second person shares the work today; the design must survive that without pretending to a permission model that does not exist.

## Accessibility & Inclusion

No formal standard has been established by the user. Product-specific needs that follow from the context above: the interface is used in working environments on both small phone screens and desktop, so touch targets, contrast, and legibility at speed are real requirements, not polish. The existing code already implements focus trapping, `aria-label`s, and Escape handling in modals — a floor to preserve rather than a ceiling.
