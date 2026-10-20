# Research materials / original marketplace recovery

**Local-only pilot, October 19, 2026.** No GitHub push or Vercel deployment.

## Goal anchor

Bring back the *experience* of the original VialGrade marketplace: explore compounds, inspect linked organization profiles, compare records and open verification workpapers. Add a second layer for scientific primary-source research. Research-material verification and scientific evidence appraisal are separate judgments. Do not reactivate checkout, product offers, inventory, seller referrals, consumer watchlists or clinical recommendations.

## What was built

- New `/intelligence/materials` read-only index of the same 16 distinct research identities, linked from Research Market and each dossier or quick view.
- Browser-only sample-vs-report **literal** lot identifier comparison. A match is NOT certification. The user can export a plain-text Markdown workpaper marked UNVERIFIED. No uploads, analytics or database writes were added.
- Five explicit evidence requirements: molecular form, lot identity, report issuer confirmation, method suitability, sample chain of custody. None is auto-approved.
- `/intelligence/providers` source-first manufacturer documentation directory and `/intelligence/providers/[slug]` profiles. The two first-party process-documentation examples are Bachem and GenScript. They are not listed as sellers of any specific compound, and VialGrade has **not** independently audited those companies' QC performance or authenticated their lots. Company-sourced URLs are editorial pointers, which must be clicked and checked individually before any public release.
- Existing clinical sponsor organization index remains separate from manufacturers/labs; scientific file A/B/C grades are untouched and cannot be mistaken for material proof.
- Navigation, card controls and source links are connected with no buying paths.

## Current important limitations

The 16 molecular records are not 16 vendor-verified products. Current sample count is zero. This tool cannot inspect genuine lab PDFs, verify issuer signatures, certify accreditation, perform HPLC/MS analysis, establish sample custody, test physical contents or establish a permitted drug-marketing purpose. A lot-number string equality is merely a string check, and a company-authored QC overview cannot certify a particular report or supplier.

Supplier names and URLs are **not** accreditation, availability or endorsement claims. Before expansion, original QC URLs and company descriptions require editorial re-review, jurisdiction-specific counsel must review public net impression, and accredited partner laboratories would have to authenticate actual reports and chain of custody.

## Pivot callout

Old sequence: scientific source dossiers -> researcher pilot -> perhaps bring back materials later.

New sequence: restore research-material verification workbench + public company QC source directory now -> owner visual review -> professional researcher and qualified laboratory validation -> gated expansion.

Why: the original interconnected marketplace experience is central to discovery, but science, provider evidence and actual material quality need independent verification.

Deferred: product sales, price comparisons, vendor rankings, historical COA imports, supplier promotions, direct material procurement and unsupported purity grading. Revisit only with proven source rights, issuer validation, privacy audit, product-specific legal advice and real researcher tasks.

## Roadmap ledger

- **Now:** local builds, typecheck, browser routes, mobile visual QA, checkout denial checks.
- **Next:** confirm each issuer source/URL and work with real scientific and lab reviewers on an authenticated lot-and-report example.
- **Open:** professional usefulness, independent lab authentication, exact source rights, legal clearance of the public flow and release approval.
- **Parked:** sales and commercial supplier integrations.

**Goal check:** marketplace navigation makes research more accessible. Verified evidence is the product. Don't promote a clickable URL, clean UI or self-declared "research use" into scientific or legal clearance.
