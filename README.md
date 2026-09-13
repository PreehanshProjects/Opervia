# Opervia

A mobile-friendly React + Vite app for customer invoices, payments, a receivables ledger, and everyday expenses. Supabase provides authentication, PostgreSQL, and the backend API. There is no separate Node server to deploy.

## Run locally

Requires Node.js 20.19+ (or a supported newer LTS).

```powershell
npm ci
npm run dev
```

Open http://localhost:5173 and choose **Explore the demo**. Demo transactions are fictional, inspired by the supplied paper invoice format. The example business details are editable. Demo changes only live in memory and disappear on reload/exit; they never reach Supabase.

## Connect your Supabase project

Project: `vlgapyuvtwygstwwogps`.

1. In your [Supabase project dashboard](https://supabase.com/dashboard/project/vlgapyuvtwygstwwogps), open **SQL Editor → New query**. Paste the complete contents of [the database migration](supabase/migrations/202609130001_opervia.sql) and run it **once**. It creates five tables, ownership policies, and three validated write functions. It makes no changes to existing tables with other names; if those five names already exist, stop and inspect before adapting the migration.
2. In **Settings → API Keys**, copy the **publishable key** (`sb_publishable_…`). The legacy `anon` key also works. Do not use `service_role`, a secret API key, your database password, or a personal access token in this app.
3. Copy `.env.example` to `.env.local` and fill in the publishable key:

   ```dotenv
   VITE_SUPABASE_URL=https://vlgapyuvtwygstwwogps.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

4. In **Authentication**, enable the email/password provider, keep email confirmation enabled, and set a minimum password length of **12**. Enable leaked-password protection if available on your plan. Keep anonymous sign-ins disabled.
5. In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:5173` for local testing. Add both `http://localhost:5173` and `http://localhost:5173/?recovery=1` to the redirect allowlist. After deployment, set Site URL to the final HTTPS origin and allow that exact origin plus its `/?recovery=1` reset URL. The PKCE email flow must be completed in the same browser that requested it.
6. Set up **custom SMTP** in Authentication for reliable confirmation and password-reset email. Supabase's default mailer is for testing and restricts delivery to authorized project team addresses. Configure your mail provider and verified sender domain in the dashboard; no SMTP secrets go in the frontend.
7. Restart `npm run dev`. Create your Opervia account, confirm your email, and sign in. Your GitHub login to the **Supabase dashboard** is separate from your **Opervia account**.
8. Open **Settings** in Opervia and save your real business details before creating the first invoice. Add a customer, create a small test invoice, record a payment, and verify those records in the Supabase table editor.

For an owner-only production app, create and confirm the owner account, then disable new user sign-ups in Supabase. Each account otherwise gets a separate private workspace; separate staff accounts do not share books in this version.

Official setup references: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [password authentication](https://supabase.com/docs/guides/auth/passwords), [password security](https://supabase.com/docs/guides/auth/password-security), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Everyday use

- **Invoices:** add customers, quantities with up to three decimals, units, prices, optional sections (e.g. Kitchen / Bar), notes, tax rate, and an optional deposit. Amounts use MUR and decimal rounding to cents. Tax defaults to zero; enter only a rate applicable to your business.
- **Blank invoice:** print an empty sheet with your business details and fourteen rows for handwriting. It creates no invoice number and no ledger entry.
- **Print / Save PDF:** opens your browser's print dialog. Select A4 and Save as PDF; disable browser headers/footers for a clean invoice. Long invoices continue across pages.
- **Payments:** record partial or full payments on a saved invoice. Payment history updates the balance automatically.
- **Ledger:** invoices and payments, with customer filtering, running receivables balance, and CSV export. Expenses are shown separately and are not customer debt. The dashboard's net cash movement is received payments minus recorded expenses; it is not profit.
- **Customers / Settings:** store your trading name, optional proprietor name, individual or company BRN, address, telephone, email, and optional bank name, account holder and account number. Account numbers are stored as text to preserve leading zeros. Business and bank details appear on new invoices and blank sheets; issued invoices retain their original snapshots. Real business details are entered through Settings, never seeded in source code. These fields use the existing private business profile JSON; no additional database migration is needed.
- **Void:** an unpaid invoice can be voided, remains in history, and is excluded from balances. An invoice with payments cannot be voided.

## Security and financial integrity

- All five tables have row-level security based on `auth.uid()`. Anonymous users have no table access. Customers and business profiles allow only owner-scoped writes.
- Invoice and payment tables cannot be directly written by browser roles. The RPC functions derive the owner from the authenticated token, compute totals on the server, validate amounts/dates, and copy trusted customer/business details from the database.
- Invoice creation and the initial deposit run in one transaction. Payment and void operations lock their invoice row. UUID-based idempotency prevents duplicated writes when a request is retried. Invoice numbering uses a PostgreSQL sequence; numbers are global and gaps are possible.
- The frontend uses only a publishable key. Auth sessions are managed by Supabase in browser storage. React escapes displayed text; no arbitrary HTML rendering is used. Production header files include CSP, framing restrictions, HTTPS-only policy, and MIME sniffing protection.
- Financial history cannot be deleted or edited through the app. This first version does not implement credit notes, refunds, expense corrections, draft persistence, shared staff workspaces, bank reconciliation, opening balances, inventory, VAT filing, or full double-entry accounting.
- Configure managed database backups and periodically test restoration. CSV exports are useful records but are not a complete database backup. Sign out on shared devices.

## Deploy

Build command: `npm run build`. Output directory: `dist`. Set the two `VITE_…` environment variables in the hosting provider **before building**. Deploy the static output over HTTPS. Vercel configuration and Netlify-compatible `_headers` are included. If using another host, apply equivalent response headers and rewrite unknown paths to `index.html`.

Update Supabase's Site URL / redirect allowlist after deployment. Run a live signup, confirmation, login, password-reset, invoice and payment smoke test against the actual hosted project before using real records. Those hosted flows require your project connection and were not verified by the local tests.

## Verification

```powershell
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

`npm test` checks decimal arithmetic and runs the actual SQL migration in PGlite (embedded PostgreSQL), testing two-account isolation, anonymous denial, unauthorized writes, server totals, deposit rollback, payment limits, idempotency, snapshot preservation, and void rules. PGlite tests use a small `auth.uid()` fixture; they do not substitute for testing Supabase Auth or concurrent sessions against the hosted project.

Playwright checks desktop and mobile demo workflows: customer creation, fractional invoice with tax/deposit, settlement, customer ledger, CSV download, blank sheet, printing CSS, search, expense recording, voiding, and demo exit. Screenshots are written to `test-results/`.
#   O p e r v i a  
 