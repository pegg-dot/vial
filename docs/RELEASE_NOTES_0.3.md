# VIAL 0.3 Release Notes

## Release name

Controlled refresh and cascading intelligence

## Summary

VIAL 0.3 turns the provenance backend into an active but bounded market-refresh system.

The application can now schedule a controlled source, fetch it through a constrained transport, preserve an immutable snapshot and diff, propose changed claims, require human review, publish one field atomically, and trace every resulting metric, alert, and opportunity signal under one root event.

All market entities and sources remain fictional. Commerce remains disabled.

## New staff capabilities

### Source refresh console

Staff can:

- Inspect refresh policies
- Run a source immediately
- Pause or enable a policy
- Advance deterministic source fixtures
- Inspect schedule and freshness state
- Inspect durable jobs and attempt counts
- Open the resulting causal trace

### Opportunity workspace

Staff can:

- Run a whole-market intelligence sweep
- Filter signals by lifecycle state
- Review score, confidence, entity, and evidence
- Open the originating causal trace
- Watch, reopen, resolve, or dismiss a signal

### Trace explorer

Each trace shows:

- Root trigger
- Refresh start and completion
- Snapshot and claim production
- Reviewed publication
- Compound and vendor recomputation
- Alerts
- Opportunity events
- Typed parent-child relations

## New public capabilities

### Signals

The public signals page exposes selected informational conditions such as:

- Price dispersion
- Thin visible availability
- Compound and vendor evidence gaps
- Source coverage gaps
- Issuer concentration
- Supply concentration

The page explicitly states that these are market and information signals, not product recommendations.

### Watchlist alerts

Anonymous watchlists now request reviewed change alerts for saved listing slugs. Alerts are generated only after a publication enters the causal event graph.

## Refresh safety

The live HTTP transport includes:

- HTTP and HTTPS restriction
- Embedded credential rejection
- Custom port rejection
- Explicit hostname allowlist
- DNS resolution before connection
- Private and reserved network rejection
- Redirect revalidation
- Content type checks
- Response size checks
- Timeouts
- ETag and Last-Modified support

The release seed uses fixtures rather than real external sources.

## Causal guarantees

A publication caused by a source refresh retains the root event that began the workflow. Immediate derived effects run in the publication transaction. This means a failed cascade cannot leave a listing updated while its receipt, metrics, or alerts are missing.

## Opportunity taxonomy

VIAL 0.3 can open or update:

- `source-health`
- `source-coverage-gap`
- `listing-evidence-refresh`
- `new-batch-evidence`
- `batch-document-gap`
- `listing-price-outlier`
- `vendor-evidence-gap`
- `vendor-onboarding`
- `price-dispersion`
- `thin-availability`
- `compound-evidence-gap`
- `issuer-concentration`
- `supply-concentration`

## Verification

The release includes:

- Ten Vitest tests across unit and integration layers
- Eight Playwright browser flows
- TypeScript production build
- ESLint verification
- npm dependency audit
- Visual screenshots of all new staff surfaces
- Lighthouse reports for key public and staff-entry routes

See `docs/AUDIT.md` for exact results.

## Explicitly not included

- Real vendor crawling
- Seller onboarding
- Physical laboratory testing
- Durable user accounts
- Email or push delivery
- Checkout or seller links
- Medical recommendations
- Dosage, injection, or reconstitution content
