# Supabase connection status

Verified on 13 September 2026 for project `vlgapyuvtwygstwwogps`:

- The supplied publishable key is accepted by the live project.
- `.env.local` is configured and ignored by version control.
- The running local app loads the Supabase URL and key, and the production build succeeds.
- All five expected tables exist: `business_profiles`, `customers`, `invoices`, `payments`, and `expenses`.
- All three financial functions exist: `create_invoice`, `record_payment`, and `void_invoice`.
- Signed-out requests are denied access to all five tables and all three financial functions.
- Email authentication and account creation are enabled; email confirmation is required; anonymous sign-in is disabled.

Do not rerun the initial migration. These checks establish that the expected objects exist and deny anonymous access. They do not verify the exact deployed function bodies, every authenticated policy, SMTP delivery, redirect allowlist, password policy, or live financial writes.

## Your remaining steps

1. Open http://localhost:5173, choose **Create an account**, enter your own email/password, and confirm the email in the same browser. Your GitHub dashboard login is a separate account.
2. Sign in and save your business/individual BRN and bank details under **Settings**. Reload the page to confirm they persist.
3. Add a customer and create a small test invoice. Record a payment and check that the balance updates after a reload.
4. In Supabase **Authentication → URL Configuration**, verify the Site URL is `http://localhost:5173` for local use and the redirect allowlist includes `http://localhost:5173` and `http://localhost:5173/?recovery=1`. Update these to the final HTTPS address when deployed.
5. Verify confirmation and password-reset emails arrive. If Supabase reports an unauthorized email address, configure custom SMTP; the default sender restricts recipients to the project team. Keep email confirmation enabled.

The publishable key does not provide administration access. No authenticated in-app browser, Supabase CLI session, or Supabase administration token is available in this session, so dashboard settings cannot be changed here. Hosted registration, email delivery and authenticated saving remain pending.

Run `node scripts/check-supabase.mjs` to repeat the live public-access checks. It prints status and permission results, not API keys or stored business records.

Official references: [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) and [SMTP delivery](https://supabase.com/docs/guides/auth/auth-smtp).
