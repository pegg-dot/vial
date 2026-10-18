# Legacy marketplace data: safe reuse plan for VialGrade Intelligence

**Status (October 18, 2026):** Inventory and gated proposal only. No existing marketplace data have been imported into the public research product by this work. No claim of legal clearance, source correctness, licensing, or product-market fit.

**Goal anchor:** Build source-auditable scientific R&D intelligence for scientists and biotech diligence users. The public product must not turn into a peptide-shopping gateway, infer individual health profiles, or represent laboratory results as proof of human-use safety.

## Verified scope of this inventory

Run the local, read-only script:

    node scripts/audit-legacy-research-data.mjs --json

It inspects **Git-tracked JSON files only**. It has no database credentials, network access, write operations, third-party API calls, or production effects. Counts are file entries, **not independently verified facts or records confirmed present in production Postgres**.

- Compound taxonomy: 60 rows, 157 listed aliases. Name/alias normalization yielded no collisions *within these static entries*. This does not validate synonym correctness or distinguish brands, formulations, salts, research products, clinical assets, or differently named molecules.
- Historical regulatory-status assertions: 60 rows holding 152 source references (102 distinct URLs). Every approval/status statement must be rechecked against a current primary regulator source; file flags are not approvals.
- Compound research: 18 compound summaries and 32 findings with source URLs. A link alone does not prove the claim is supported by that source.
- Regulatory-action snapshot: 24 entries with source URLs; an isPrimarySource=true field is a *stored assertion*, not independently verified by this audit.
- News metadata: 12 entries.
- Vendor-related historical data: 34 vendor profile rows, 73 vendor-linked COA rows, 27 flagged COA rows, 5 self-published COA rows, 201 keyed purity fields in a Janoshik-named snapshot, 28 review summaries, 18 vendor signals, 17 aggregator-rating rows, 15 Trustpilot summary rows, and 14 offer records. Some entries overlap and many lack adequate provenance.
- The migration in src/server/db/data-origin-schema.ts explicitly differentiates demo and live origin; demo/fictitious values must never be promoted as observed facts.

## Candidate pathways, in priority order

### A. Scientific identity resolution (highest priority, not yet approved for publication)

Use compound names and aliases as *candidate* synonym mappings to improve retrieval of ClinicalTrials.gov study records and OpenAlex/PubMed metadata, alongside newly verified primary-source names/identifiers. Maintain canonical entity types separately: molecule, formulation/brand, developer, trial, publication, and sampled material. Check identity conflicts, chemical modifications and ambiguous names manually. Never automatically merge unrelated assets based on text similarity.

Pilot on the three current research topics. Measure relevant/irrelevant linked studies, missed identifier variants, and false joins on a versioned, human-reviewed reference set. Changes to public results require regression tests and clear provenance.

### B. Scientific/regulatory source register (high priority, re-fetch from official sources)

Treat existing findings and regulatory links only as candidate discovery pointers. Re-fetch official source metadata. Preserve source ID, canonical URL, source publisher, original issue date, observation time, permissions, change history and evidence span or field. Have a reviewer confirm claim-to-source support and the precise scope of any FDA action. Do not copy protected paper text or distribute third-party documents just because a URL resolves.

Use this to build the first meaningful Intelligence workflow: **what changed in a research asset's public evidence since the last verified snapshot?** Produce exact dated diffs, not AI-made judgments of efficacy or likelihood of approval.

### C. Laboratory-document integrity (separate future product hypothesis)

Existing report/sample identifiers, test links and source history may support an *issuer-confirmed, report-specific* verification workflow. Must secure appropriate source rights and, ideally, a partner lab before publishing or selling a verification service. Check report issuer, sample identity, custody, analysis method, date and claims of independence. A posted COA, measured purity, or a live laboratory URL **does not establish** sterilization, lawful sale, clinical efficacy, final-vial authenticity or batch-wide quality.

Never automatically publish seller grades, reliability accusations, allegedly fraudulent document flags or trust scores from legacy summaries. Allow correction/appeal review for any later verified claims about organizations.

### D. Legacy commerce signals (archive only by default)

Historic vendor identities, product listings, prices, referral performance, discount codes, and purchase paths are *not* the first biotech R&D use case. Keep commerce and referral ingestion disabled. Any different future lawful commercialization requires product-, jurisdiction-, and operator-specific clearance plus source-rights, security and payment review. Preserve historical source code through the existing archive tag; do not rebuild a public seller directory through a research-side door.

### E. Former visitor/account data (exclude)

Never import or train an AI on saved searches, watchlists, compound-follow events, individualized comparisons, referral hashes, page paths, checkout events, or consumer account data for research-intelligence enrichment or commercial behavioral analytics. Even hashed visitor IDs or compound interests can be linkable/infer health-related information. Historical retention, access/deletion requests, logs and backups remain subject to the separate privacy/legal inventory in issue #24. No automatic transfer or repurposing is authorized by this plan.

## Candidate record contract before any feature imports data

A record must carry at least:

- Entity type and verified canonical identity (or explicit *unresolved*).
- Claim text as a **draft candidate**, original source identifier, source URL and source type.
- Collection and publication dates, snapshot/version identifier, and completeness limitations.
- Provenance and legal-use status: demo, unverified, permission-review, licensed/cleared as applicable.
- Reviewer decision, review date, reason, and conflict/correction history.
- Visibility mode: **internal/quarantined by default**; separate explicit publication gate.
- Privacy classification and retention policy. Person-level histories are categorically excluded from the research candidate pipeline.

## Release gates

1. **Rights:** verify permission and source terms for each type of record; do not treat public accessibility as redistribution permission. Revalidate OpenAlex metadata vs individual copyrighted full texts.
2. **Accuracy:** evaluate a blinded 30-50-record identity/source relevance sample before any AI claim summaries; capture source links, exact support, negatives and date discrepancies.
3. **Source integrity:** verify primary records, IDs, issuer authenticity, original data capture, retrieval conditions and stale/unavailable states. Use strict no-evidence/no-claim defaults.
4. **Risk boundary:** no contact with customer behavioral data, old seller-commerce API, partner redirects or checkout. Prevent accidental SEO exposure of old vendor pages.
5. **Customer usefulness:** run analyst tasks and compare against direct official-source research. Track time saved, citation correctness and repeat usage, not mere site visits.
6. **Compliance:** independent legal/privacy/rights review where relevant; mail and historical data-remediation work remains separately open.
7. **Production:** add isolated tests, verify safe publication allowlist and public routes, then go through the standard PR/CI/browser gates. Do not self-promote this inventory to production.

## Roadmap ledger

- **Now:** offline inventory of legacy candidate sources, neither copying production PII nor activating prior ingesters.
- **Next:** select a few trustworthy aliases and primary-source links for manual review on the three existing topics; benchmark mapping against official registries.
- **Then:** reproducible study/publication/version-change register with source-level references.
- **Parking lot:** lab-verification product pilot, any vendor-focused market intelligence, marketplace reactivation, paywalled publication ingestion and personalized investor advice.
- **Open decisions:** first paying research buyer, source rights, whether a legitimate lab partner would want report-integrity software, current Postgres inventory under a privacy-reviewed access process.

**Goal check:** reuse historical technical work and verified research observations only when they improve a concrete professional evidence workflow. Reusing more data is not itself a product advantage.
