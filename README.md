# truevisible-app

TrueVisible — AI visibility for your brand. By The Growth Lab.
Product brief: `PROJECT-BRIEF.md` and `SPEC.md` (in the TrueVisible Claude Project). Visual system: `tokens.json` → `app/globals.css`.

**Stack:** Next.js 15 (App Router) · Supabase (Auth, Postgres, RLS) on the shared project `rmrauejublipukulnjou` · Railway.

## What's here (Day 1 — 30 Oct 2026)
| Area | Files | Evidence |
|---|---|---|
| Schema per SPEC §11 + shared `tenants / subscriptions / usage_costs` | `supabase/migrations/` | Applied to production Supabase; `supabase/tests/rls_smoke.sql` 17/17 PASS (live run, rolled back) |
| `prospects` anon hole closed | `20261030150000_truevisible_tenancy.sql` | Live run: anon now sees 0 rows (was 1) |
| Magic-link auth, session middleware, sign-out | `app/login`, `app/auth/*`, `middleware.ts` | Build + typecheck; **live email sign-in not yet tested** (see setup step 3) |
| Onboarding wizard: Brand → Competitors & market → Prompts | `app/onboarding/*`, `lib/onboarding/*` | Unit tests 4/4; screens rendered against a local stand-in, 390px + 1280px, no console errors |
| Dashboard skeleton (Overview; other tabs labelled "coming") | `app/dashboard/page.tsx` | Every figure reads a stored row or shows "—" |
| Health check | `/api/health` | 200 |

### Data model notes
- `tenants.id` is **text** (`'tgl'` = tenant zero) so it matches `prospects.tenant_id`. New tenants get `t_<12 hex>`.
- `tenant_members` links Supabase users to tenants. `private.user_tenant_ids()` = your tenants + (for agencies) their client tenants. Every policy uses it.
- Child tables use composite foreign keys `(brand_id, tenant_id)` → a row can't point at another tenant's brand even with a forged id.
- Clients may write only setup tables (`brands, brand_variants, domains, competitors, products_icps, prompts`). Runs, answers, citations, reports, alerts, recommendations etc. are written by the service role (engine runners, Delivery pod).
- `usage_costs` has no client policy at all — the margin number is internal.
- Billing rows are visible only to the **paying** tenant, so an agency's client never sees wholesale prices.
- Plan limits live in the database: trial = 10 active prompts, paid = 50, one brand per direct tenant. `tv_bootstrap_tenant()` creates tenant + owner + 14-day trial on first sign-in. `tgl` has an `internal` plan (never invoiced).
- `subscriptions.product` (`truevisible | truelead`) because the table is shared with TrueLead.

## Run locally
```bash
npm install
cp .env.example .env.local      # values are already filled for the shared project
npm run dev                     # http://localhost:3000
npm test && npm run typecheck
```

## One-time setup (Architect)
1. **GitHub** — empty private repo `tejinder-cloud/truevisible-app`, then from this folder: `git push -u origin main`.
2. **Railway** — New Project → Deploy from GitHub repo → `truevisible-app`. Variables: copy the three `NEXT_PUBLIC_*` lines from `.env.example`; set `NEXT_PUBLIC_SITE_URL` to the Railway domain (Settings → Networking → Generate Domain). Redeploy after changing it (public vars are baked in at build).
3. **Supabase → Authentication → URL Configuration** — Site URL = the Railway domain; Redirect URLs add `https://<railway-domain>/auth/callback`, `https://<railway-domain>/auth/confirm`, `http://localhost:3000/auth/callback`.
4. **Supabase → Authentication → SMTP** — connect Resend (already in the stack). Supabase's built-in mailer only delivers to project team members and a few per hour, so strangers can't sign in until this is done.
5. Live check: sign up with a fresh email on the Railway URL → link arrives → wizard → dashboard shows "We're checking your setup".

## Not in Day 1 (by plan)
Citation Tracker runs (Day 17) · setup-verification queue (Day 19) · dashboard tabs (20–21) · recommendations + *Start managed AEO* (22) · reports (23–24) · alerts (25) · Razorpay (26) · agency UI (v2).
