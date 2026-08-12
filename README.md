# VialGrade 6.0

**The peptide market, made legible through market data, consumer intelligence, seller operations, approval-gated commerce, and sample-linked evidence.**

VialGrade is a web-first market intelligence and marketplace platform. V6 adds an evidence and laboratory network on top of the V1 production foundation, V2 canonical market-data engine, V3 consumer intelligence, V4 seller operating system, and V5 approved-commerce architecture.

> Every company, listing, laboratory, report, sample, result, price, batch, account, and transaction in this repository is fictional or sandbox data. VialGrade 6.0 does not provide medical guidance, establish product safety, verify real inventory, or enable unapproved production commerce.

## VialGrade 6.0 evidence and laboratory network

- Laboratory identity, team, onboarding, quality-system, and method-scope records
- Method versions with technique, analyte, matrix, dimensions, limits, uncertainty, validation, and accreditation coverage
- Independent testing programs with vendor-selected, customer-sealed, blind-purchase, and multi-source sampling models
- Sample kits, tamper seals, accessioning, storage, and append-only custody events
- Stable, hash-chained custody receipts with tamper detection
- Analytical runs, raw-data hashes, system suitability, deviations, review, and structured results
- Versioned reports with issuance, supersession, correction, revocation, and public verification
- Batch passports that preserve separate dimensions, conflicts, sampling provenance, confidence, report history, and explicit unknowns
- Public laboratory directory, testing-program explorer, passport directory, and report-verification API
- Laboratory operating system for orders, samples, custody, methods, runs, reports, quality, onboarding, and developer access
- Seller testing workspace and product-level passport links
- Staff evidence-network, laboratory, sampling, passport, and report-integrity consoles
- Scoped laboratory REST APIs and a real proposal-only MCP server

## Central evidence principle

A document is not a physical-product verification. VialGrade links every analytical claim to:

```text
laboratory → method version → test order → physical sample → custody chain
→ analytical run → reviewed result → versioned report → batch passport
```

A result remains sample-specific. A passport never silently converts identity, purity, quantity, sterility, endotoxin, or representativeness into one universal safety score.

## Retained platform layers

- V5 processor-ready, approval-gated checkout, signed provider events, tax, fraud, transfers, reserves, settlement, and reconciliation
- V4 self-serve seller onboarding, canonical catalog matching, imports, evidence, batches, inventory, teams, APIs, and Seller MCP
- V3 personalized market, saved searches, follows, comparisons, notifications, watchlists, and decision history
- V2 canonical graph, parser benchmarks, freshness, corrections, reliability, and deterministic search
- V1 durable identity, revocable sessions, deny-by-default authorization, PostgreSQL boundary, migrations, security, CI, backups, and observability

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Enable fictional fixtures and demo identities locally:

```text
VIALGRADE_SEED_FIXTURES=true
VIALGRADE_SEED_DEMO_ACCOUNTS=true
```

Demo laboratory:

```text
elena@aperture.test
VialGradeDemoLaboratory!2026
```

## Laboratory MCP

Create a scoped laboratory token in `/lab/developer`, then run:

```bash
VIALGRADE_MCP_LAB_TOKEN=vlab_... npm run mcp:lab
```

The MCP server can read laboratory status, methods, test orders, and custody, and prepare result/report proposals. It cannot approve results, issue reports, revoke reports, publish passports, or change marketplace policy.

## Verification

```bash
npm run verify:v6
```

Focused V6 checks:

```bash
npm run test:v6
npm run audit:evidence-v6
npm run audit:lab-mcp
```

## V6 surfaces

Public:

```text
/labs
/labs/[slug]
/testing
/passports
/passports/[slug]
/api/v1/reports/[id]/verify
```

Laboratory:

```text
/lab
/lab/onboarding
/lab/orders
/lab/samples
/lab/custody
/lab/methods
/lab/runs
/lab/reports
/lab/quality
/lab/developer
```

Seller:

```text
/seller/testing
```

Staff:

```text
/admin/evidence-network
/admin/laboratories
/admin/sampling
/admin/passports
/admin/report-integrity
```

## Documentation

- `docs/EVIDENCE_LABORATORY_NETWORK.md`
- `docs/RELEASE_NOTES_6.0.md`
- `docs/AUDIT_6.0.md`
- `docs/LEGAL_BOUNDARIES.md`
- `docs/THREAT_MODEL.md`
- `docs/ROADMAP.md`

## Next phase

VialGrade 7.0 is the production agent control plane: versioned prompts and workflows, tool permissions, evaluation gates, replay, shadow and canary deployments, model routing, budgets, failure clustering, observability, and rollback.
