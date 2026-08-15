# Deploy checklist — VialGrade

Everything is built to deploy demo-free. A production runtime never seeds demo **accounts** — that
is a floor, not a default, and no environment variable lifts it (see below). Demo **fixtures**
(catalog data) are off in production unless you explicitly set `VIALGRADE_SEED_FIXTURES=true`, which
the demo `docker-compose.yml` stack does on purpose. Leave it unset and a fresh deploy holds **only**
the live data the bootstrap loads. You
deploy once and it all comes alive together: real users can browse and click "Buy at vendor," the
outbound click-data starts accumulating (the affiliate leverage), and the cron keeps data fresh.

## 1. Provision a managed Postgres
Neon / Supabase / Railway all work (the DB layer already abstracts PGlite ↔ managed Postgres).
Copy the connection string → `DATABASE_URL`.

## 2. Set environment variables
Required (the app refuses to boot without the secrets):
- `DATABASE_URL` — managed Postgres connection string
- `VIALGRADE_SESSION_SECRET` — ≥32 chars, random
- `VIALGRADE_PRIVACY_HASH_SECRET` — ≥32 chars, random
- `NEXT_PUBLIC_SITE_URL` — the public https URL (e.g. `https://vialgrade.app`)
- `NODE_ENV=production`

Do NOT set (keep demos off):
- `VIALGRADE_SEED_FIXTURES` — leave unset/`false`. Setting `true` would seed demo fixtures.
- `VIALGRADE_SEED_DEMO_ACCOUNTS` — leave unset. In a production runtime it is now **ignored** (and
  logs a warning if set): the demo logins include an `administrator` whose password is published in
  this repo's README, so seeding them into a real database is refused rather than merely discouraged.
  This used to be an OR against `NODE_ENV`, which meant setting the flag *overrode* the production
  check — and `docker-compose.yml` set both, so `docker compose up` provisioned a public-password
  admin on a durable Postgres volume.

For scheduled data refresh:
- `CRON_SECRET` — random; the cron route is disabled until this is set.

Optional (features light up when present):
- `VIALGRADE_LIVE_INGEST_APPROVED=true` — required to run the data bootstrap / collectors.
- `ANTHROPIC_API_KEY` — enables the model extractor (still gated behind approval).
- Reddit API creds — lights up the built-but-inert community stream.

Verify with: `node scripts/check-env.mjs`.

## 3. Deploy
- **Vercel:** connect the repo. `vercel.json` already schedules the hourly refresh cron
  (`/api/internal/cron/refresh` at :17). Migrations run automatically on first DB connection.
- **Docker:** `docker-compose.yml` has `app` + `postgres` + `scheduler` services.

## 4. Load the live data (once, after the DB is up)
```bash
DATABASE_URL=postgres://…  VIALGRADE_LIVE_INGEST_APPROVED=true  ./scripts/bootstrap-live.sh
```
This runs the full pipeline (compounds → vendor catalogs → Janoshik COAs → vendor-published +
self-published COAs → lab reconcile → reviews → **real batch passports** → registry IDs). Idempotent
— safe to re-run. Result: ~60 compounds, ~83 vendors, ~400 listings, ~280 COAs, ~130 passports, 11
sourced labs. No demos.

## 5. Keep it fresh (cron)
With `CRON_SECRET` set, Vercel cron hits `/api/internal/cron/refresh` hourly (the internal refresh +
intelligence sweep). To also re-run the external collectors on a schedule (new Janoshik tests,
prices, reviews, vendor status), run `bootstrap-live.sh` — or the individual `collect-*.mjs` /
`ingest-*.mjs` scripts — from the docker `scheduler` service or a Vercel cron. Each is idempotent
and self-guards against re-seeding demos.

## 6. First-run admin
Because production seeds no demo accounts, create a real admin/owner account before relying on
`/admin`. The supported path is `VIALGRADE_ADMIN_EMAIL` + `VIALGRADE_ADMIN_PASSWORD`
(`src/server/auth/owner-admin.ts`), which provisions exactly one staff owner from operator-supplied
credentials and has no hardcoded fallback. Rotate any secrets that were ever used in dev.

## Notes
- **Affiliate monetization** attaches only in `src/server/outbound/affiliate.ts` (one rule per
  vendor, or a universal `"*"` template). No deals are live yet, so "Buy at vendor" links pass
  through clean and every click is tracked in `outbound_clicks` — that click data is the leverage
  for negotiating deals after launch.
- **Demo accounts** never exist in a production runtime — enforced in
  `src/server/auth/foundation-seed.ts`, not just documented here. Demo **fixtures** can, if you set
  `VIALGRADE_SEED_FIXTURES=true` (the docker demo stack does). `scripts/delete-demos.mjs` cleans a
  dev DB, or any environment where fixtures were seeded and are no longer wanted.

## Rename addendum (VialGrade)

The VIAL → VialGrade rename changed operational names. When deploying:

- **Environment variables are now `VIALGRADE_*`** (was `VIAL_*`) — all 36. `node scripts/check-env.mjs`
  names the missing ones. The app refuses to boot without the secrets, so a half-renamed env is a
  hard failure, not a silent degradation.
- **The registry identifier namespace moved** from `vial:` to `vialgrade:`, and the column
  `registry_identifiers.vial_id` is now `registry_id` (brand-free, so a future rename never touches
  the schema again). Migration **32 `registry-identifier-namespace`** performs this and runs
  automatically on first DB connection. It is idempotent and records every former ID as a
  `former-id` alias, so pre-rename citations still resolve — verify with
  `node --import tsx scripts/verify-registry-rename.mjs`.
- **Published database text** holding the old brand is rewritten by
  `node --import tsx scripts/rename-stored-brand.mjs --apply`. This is NOT part of migrations: it
  rewrites an explicit allowlist of VialGrade-authored phrases and deliberately leaves the physical
  noun ("…PEPTIDE 10MG VIAL") inside scraped vendor product titles untouched. A fresh deploy that
  ingests from scratch does not need it; a deploy restoring an older snapshot does.
- **`docker-compose.yml` Postgres credentials** changed to `vialgrade` / `vialgrade_local_only`.
  An existing local volume still carries the old role; recreate it or create the new role.
