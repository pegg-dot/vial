# VialGrade 1.0 deployment

## Supported runtime

- Node.js 20.9 or newer
- Managed PostgreSQL
- Persistent secrets supplied by the deployment platform
- HTTPS public origin

PGlite is supported for local development and automated tests only.

## Required production environment

```text
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://your-domain.example
DATABASE_URL=postgresql://...
DATABASE_POOL_MAX=5
DATABASE_SSL=true
VIALGRADE_SESSION_SECRET=<independent random value, at least 32 characters>
VIALGRADE_PRIVACY_HASH_SECRET=<independent random value, at least 32 characters>
VIALGRADE_SEED_FIXTURES=false
VIALGRADE_SEED_DEMO_ACCOUNTS=false
VIALGRADE_BUILD_SHA=<immutable commit or build identifier>
VIALGRADE_RELEASE=1.0.0
CRON_SECRET=<independent random value>
```

Run `npm run env:check` before deployment. Production fails closed when required values are missing.

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The default local database is `.data/pglite`.

## Verification

```bash
npm run verify:v1
```

This runs linting, typechecking, 27 tests, static security checks, the backup and restore drill, dependency auditing, the production build, runtime role checks, and structural accessibility checks.

The browser Playwright suite is separate:

```bash
npx playwright install chromium
npm run test:e2e
```

## PostgreSQL contract

Use the included Compose environment:

```bash
docker compose up --build
```

Or use the GitHub Actions `postgres-contract` job. A PostgreSQL-backed build and readiness check are required before deployment.

## Database recovery

- Use `scripts/postgres-backup.sh` to create a provider-independent logical backup.
- Use `scripts/postgres-restore.sh` only after validating the destination and maintenance window.
- Enable provider point-in-time recovery.
- Run a restore drill in a non-production environment before launch and at a defined recurring cadence.

## Health probes

- `/api/health/live` confirms the process is alive.
- `/api/health/ready` confirms database connectivity and expected schema state.

The deployment platform should route traffic only after readiness succeeds.

## Container

The Dockerfile uses separate dependency, build, and non-root runtime stages. The runtime health check calls the readiness endpoint.

## Release gate

Do not deploy when any of these fail:

- Environment contract
- Lint or typecheck
- Unit or integration tests
- Static security audit
- Production build
- Runtime role audit
- Readiness probe
- PostgreSQL contract
- Backup and restore drill
- Dependency audit

## VialGrade 5 commerce configuration

The safe default is:

```text
VIALGRADE_COMMERCE_MODE=sandbox
VIALGRADE_PAYMENT_PROVIDER=mock
VIALGRADE_LIVE_COMMERCE_ENABLED=false
```

Stripe test mode requires:

```text
VIALGRADE_COMMERCE_MODE=test
VIALGRADE_PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Configure the provider webhook to send signed account, payment, and dispute events to:

```text
/api/v1/commerce/provider/webhook
```

Do not enable live mode until processor underwriting, seller accounts, SKUs, customer types, jurisdictions, merchant model, tax liability, fraud operations, reserve policy, refund/dispute allocation, insurance, and legal approval have all been recorded in the activation policy.
