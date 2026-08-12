# Legal and Product Boundaries

This document defines product constraints. It is not legal advice.

## Current state

**This section was stale and is corrected as of the VialGrade rename.** It previously read "all
commercial entities and products are fictional," which has not been true since live ingestion was
approved. The product now holds real records about real, named companies, and the boundaries below
apply to statements about actual businesses — not to fixtures.

- Records are **demo unless marked Live**. Demo records are seeded fictional companies, labs,
  prices, and batches. Live records are aggregated from real public third-party sources (vendor
  product pages, the Janoshik public COA feed) through the reviewed ingestion pipeline.
- Live records are never presented as endorsed, verified-safe, or a recommendation.
- Global "everything here is fictional" copy is therefore **wrong** and must not be reintroduced.
- A complete sandbox and provider-test checkout architecture exists; production checkout remains
  disabled. VialGrade is affiliate-out and never takes payment.
- No real participating seller or production seller link exists.
- No product is recommended for human use.
- No dosage, injection, or reconstitution guidance exists.
- No physical product has been verified by VialGrade. Independent test records are read from
  certificates issued by third-party laboratories; VialGrade re-measures nothing.

## Grade boundary

VialGrade publishes a **letter grade about a named real business**. That is the highest-exposure
statement the product makes, and it carries its own constraints.

A grade is a statement about **the evidence on record**, never about a product's safety, purity,
legality, or fitness for any use. The published rationale must say so wherever a grade appears.

Required properties, each enforced in `src/server/verify/grade.ts`:

- **A grade is a projection, not a second opinion.** It is derived from the composed verdict by
  fixed, stateable rules — no weights, no tunable coefficients, no hidden arithmetic. A reader who
  understands the verdict can predict the letter.
- **Thin evidence produces no letter.** An `unproven` verdict returns "Not enough evidence to
  grade". Unknown must never be laundered into a confident letter.
- **A gap is not an accusation.** The trust graph records an absence (no enforcement record found)
  as an untagged signal precisely so it earns no verified chip. A grade must render that as
  "checked — nothing adverse", never as evidence for or against.
- **The decomposition ships with the letter.** The per-dimension evidence and the "why this grade"
  rationale appear alongside the grade, not behind an interaction.
- **An adverse grade must rest on a citable record.** An `avoid` grade about a named company
  requires a primary source (government record, court filing) or a documented review record.
  `scripts/truth-check.mjs` fails the build surface if an adverse grade has neither.
- **A grade must be correctable.** When the curated source record is corrected, the published
  profile must be reconciled — a stale blurb reading "generally considered legitimate" beside an F
  is both misleading and an unnecessary liability. See `scripts/reconcile-vendor-descriptions.mjs`.

Disallowed regardless of grade:

- Presenting a grade as safety, approval, or purchase advice
- Using a grade to create checkout or transaction eligibility (see "Disallowed shortcuts")
- Publishing an adverse grade whose basis cannot be shown to the reader
- Ranking vendors by grade in a way that reads as a recommendation to buy

## Core distinction

A marketplace interface, a public-information comparison site, a research procurement platform, and a consumer drug seller are not the same business.

The product must not silently cross from one role into another.

## Disallowed shortcuts

The following do not establish lawful transaction eligibility:

- A 21-plus modal
- A generic `research purposes only` checkbox
- A `not for human consumption` footer
- A small marketplace fee
- Vendor approval by implication
- A favorable public certificate
- An AI-generated compliance summary
- A high trust or opportunity score

Eligibility must be based on the actual product, intended use, customer, seller relationship, jurisdiction, payment partner, fulfillment role, and applicable policy.

## Source collection boundary

A technically fetchable page is not automatically an approved source.

Before enabling a real source, the platform needs a documented policy covering:

- Permitted collection and publication
- Source ownership and correction channel
- Rate and schedule limits
- Data retention
- Personal information handling
- Copyright and quotation limits
- Terms, robots, and jurisdiction review where applicable
- Escalation for disputes

Live sources are approved per-hostname and gated behind `VIALGRADE_LIVE_INGEST_APPROVED`. Demo fixtures remain for unapproved seams; the two are distinguished by the `origin` column and the DataOriginBadge.

## Publication language

Allowed examples:

- `Vendor-published report located`
- `Report identifier confirmed by the named issuer`
- `The platform did not independently sample this inventory`
- `Sterility was not tested in the displayed report`
- `Observed price as of the stated timestamp`
- `This compound has fragmented public pricing across the tracked catalog`
- `This is an informational market signal, not a product recommendation`

Disallowed examples without appropriate evidence and review:

- `Safe`
- `Guaranteed pure`
- `Best peptide for recovery`
- `Approved vendor`
- `Legal everywhere`
- `Verified vial` when only a document was reviewed
- `Buy now because supply is thin`
- `Recommended based on our opportunity score`

## Opportunity signal boundary

Opportunity signals may describe:

- Incomplete documentation
- Source coverage or source health
- Price dispersion
- Thin observed availability
- Batch-document mismatch
- Vendor profile status
- Issuer or supply concentration

They must not:

- Recommend human use
- Rank products by health effect
- Encourage urgency-based purchase behavior
- Transform a documentation score into a safety claim
- Override a legal or publication review
- Create checkout eligibility

## Commerce gate

VialGrade 5 persists a versioned activation decision before payment intent creation. A browser confirmation, age modal, seller claim, or environment variable cannot independently create eligibility.

### Required checks

A listing may move to marketplace checkout only when all required states are affirmative:

```text
seller_agreement
organization_verification
catalog_eligibility
customer_eligibility
buyer_jurisdiction
shipping_jurisdiction
processor_approval
inventory_freshness
refund_assignment
support_assignment
legal_policy_version
```

A failure or unknown state prevents checkout.

## Seller profiles

An independent public profile must be clearly labeled as unclaimed and independent. A vendor cannot be presented as a participating marketplace seller without a real agreement.

## Evidence and laboratory claims

AI can inspect documents and public records. It cannot determine the contents, sterility, endotoxin level, degradation, or representativeness of a physical vial through a webpage.

Physical verification requires a physical testing process with documented sampling and chain of custody.

## Required professional review before production commerce

- FDA and healthcare regulatory counsel
- Marketplace and consumer-protection counsel
- Payment processor underwriting
- Product liability and insurance review
- Tax and seller-reporting review
- Privacy and data-retention review
- App-store policy review for any native app

## VialGrade 6 laboratory and evidence boundary

A laboratory profile, report, method, or passport is not a declaration that a product is safe, lawful, suitable for human use, or representative of all inventory.

VialGrade separates:

- Laboratory identity and claimed quality posture
- Method validation and accreditation coverage
- Physical sample source
- Chain of custody
- Analytical observation
- Report lifecycle
- Batch linkage
- Conflicts and missing dimensions

Production claims about accreditation, method scope, sample provenance, analytical results, sterility, endotoxin, or other properties require direct verification and contractual correction and revocation procedures. Fictional V6 records must never be presented as real laboratory evidence.
