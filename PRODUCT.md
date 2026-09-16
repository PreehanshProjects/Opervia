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

It does not try to be accounting software. It deliberately omits credit notes, refunds, bank reconciliation, inventory, VAT filing, and double-entry.

## Operating Context

- **The paper artifact is still the deliverable.** Invoices are printed or saved as PDF to A4 and handed to the customer. A **blank invoice sheet** — business details, fourteen empty rows — is printed for handwriting when the job is faster with a pen. Both are first-class outputs.
- **Mauritius.** Amounts in MUR, rounded to cents. Business identity is a trading name, optional proprietor name, and an **individual or company BRN**. Tax defaults to zero; a rate is entered only when applicable to the business.
- **Line items carry sections** (e.g. *Kitchen* / *Bar*), quantities to three decimals, and units — the shape of a real trade invoice, not a generic product list.
- **Two modes of entry:** a demo workspace (fictional data, memory-only, never reaches Supabase) used for exploring and for end-to-end tests, and the real signed-in workspace.
- **Workflow:** add customer → create invoice (optional deposit) → print/hand over → record partial or full payments → watch the receivables balance → export CSV when an outside party needs the numbers. Expenses are recorded separately and are never customer debt.
- **Auth reality:** email/password with confirmation, PKCE reset completed in the same browser, custom SMTP required for reliable delivery. Sign-out matters on shared devices.

## Capabilities and Constraints

**Surfaces:** Overview, Invoices, Ledger, Customers, Expenses, Settings — plus the Auth surface and two print surfaces (`InvoicePrint.tsx`, `StatementPrint.tsx`). Modal-based creation for invoice, customer, expense, blank sheet, and customer statement.

`StatementPrint` deliberately reuses the invoice sheet's own classes (`invoice-paper`, `paper-*`) rather than growing a second print stylesheet: everything learned about printing this product — A4 sizing, the repeating table head, page breaks, mono mode, killing the animations that once printed the modal's opening frame — keys off those names. A statement is not a financial record but a statement of one as it stands today, so it takes the *current* business details rather than a snapshot, as the blank sheet does.

**Confirmed capabilities:** customer records; invoices with sections, fractional quantities, units, notes, tax rate, optional deposit; partial payments with history; running receivables balance with customer filtering; a cash book reading of the same ledger; a printable per-customer statement of account; CSV export; expense recording; invoice voiding; blank printable sheet; editable business and bank details that snapshot onto issued invoices.

**Durable constraints (non-negotiable):**

1. **MUR and the Mauritian context.** Not a generic multi-currency product. BRN, local invoice conventions, MUR to cents.
2. **The printed A4 invoice is the deliverable.** The print layout is a primary surface, must stay clean across page breaks, and the blank sheet must stay handwriting-compatible at fourteen rows.
3. **Financial history is immutable.** Void-only; a voided invoice stays visible in history and is excluded from balances. An invoice with payments cannot be voided. The interface must never imply a record can be changed.

   This is enforced in PostgreSQL, not just the UI: the `own_invoices` and `own_payments` policies grant `select` only, so no browser role can delete a financial record. **Reaffirmed by the owner on 14 September 2026** when asked directly whether invoice deletion should be added: keep void-only. Do not propose or implement a migration granting DELETE on these tables.

   What *can* be removed, and why: **expenses** are the owner’s own note-to-self, hold nothing a customer relies on, and are editable and deletable (`own_expenses` is `FOR ALL`). A **customer** can be deleted only while they have no invoices, no opening balance and no payments — after that they are part of the record. Customers and expenses use the same confirmation dialog; only permanent customer deletion requires typing the name back.
4. **"Net cash movement" is not profit.** The Overview figure, and the Cash book closing figure, are received payments minus recorded expenses. No P&L framing, no "profit" label, no implication of an accounting result.
5. **Expenses belong to no customer.** Stock is bought in bulk — a crate of vegetables, a tray of cakes — and sold on to whoever buys it, so attributing an expense to a customer is work the owner cannot honestly do. **Confirmed by the owner on 16 September 2026.** Do not add a customer field to expenses, and do not let expenses reach a receivables balance.

   The Ledger therefore serves two readings, chosen by `mode` in `list_ledger`: `account` (the default — openings and invoices as debits, payments as credits, balance = owed, filterable by customer) and `cash` (payments in, expenses out, balance = net cash movement, always the whole business). Invoices are absent from the cash book because an unpaid invoice is not cash, and the customer filter is dropped there because keeping it would retain the credits and silently discard every debit.

**Data loading:** transactions are queried a page at a time on the server
(`list_invoices`, `list_expenses`, `list_ledger`), with filtering, sorting,
paging and counting all done in SQL under the same owner isolation as the row
policies. Only reference data — the business profile, customers and opening
balances — is loaded whole, because it is small and every screen needs it.

Because of that, **every headline figure is computed server-side**
(`workspace_summary`, `customer_balances`). Outstanding, received, expenses and
the ledger running balance must never be derived from the rows currently on
screen: a total of page one is wrong in a way that looks right. Demo mode mirrors
the same semantics in memory (`queryInvoices`, `queryExpenses`, `queryLedger`,
`summarise`), and both are tested against the same expectations.

**Further technical constraints:** invoice numbers come from a PostgreSQL sequence — global, and gaps are possible, so the UI must not present them as contiguous. Account numbers are stored as text to preserve leading zeros. Issued invoices retain their original business/customer snapshots; editing Settings must not appear to rewrite history. The frontend holds only a publishable key. No arbitrary HTML is rendered.

**Opening balances (added):** what a customer owed before Opervia is recorded as one dated entry per customer. It is not an invoice — it consumes no number from the sequence, is never printed, and must never be sent to a customer who already holds the paper invoice it represents. Money received against it is recorded as a real payment so the cash figures stay correct. A customer with an opening balance cannot be deleted, and the balance cannot be lowered below what has already been settled against it.

**Explicitly out of scope in this version:** credit notes, refunds, expense corrections, draft persistence, shared staff workspaces, bank reconciliation, inventory, VAT filing, double-entry accounting.

**Known gaps for a one-person business**, in priority order: no credit note (an invoice with a payment cannot be corrected at all), no automated backup the owner controls, no printable customer statement, no aging buckets, and no VAT registration number field for a VAT-registered business.

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
