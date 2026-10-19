# VialGrade research marketplace: simplify and release

Date: October 19, 2026

## Pinned goal

Make VialGrade the approachable source-linked peptide research browsing product that the original marketplace suggested. A researcher or biotech analyst should find a molecule quickly, understand what information is on file, compare two records, and follow original studies and quality documentation without mistaking incomplete evidence for a certification.

Primary user: research scientist / biotech diligence analyst. North star: reliable claim-to-source inspection, not AI-generated illustrations, a long list of feature entrances, unsubstantiated grades, or retail drug sourcing.

## Original experience inspection

Historical anchor: archived tag `archive/marketplace-pre-research-2026-10-18` in the preserved local review repository. Home/market pages used a direct collection entry point, category rail, quick look, comparison dock, compound details, provider context, laboratory certificates, and passports. Much of the interaction architecture is reusable without the sale-of-unapproved-peptides data or commercial flows.

Specifically reused: a clear all-compound library; visible search; horizontal category selection; fast detail preview; sticky compare tray; linked original evidence; publicly attributed organization and laboratory source documents; file-grade methodology as an optional *source-coverage* filter.

Not restored: prices, listings, product inventory, merchant grades, external seller referral links, purchase/contact paths, credentialed COA authenticity claims, customer behavior data or any mechanism suggesting legal authorization of unapproved human-use drugs.

## User feedback and pivot

Owner reports: previous research design was extremely AI-y, difficult to understand, and worse to navigate than the original marketplace.

Old approach: 9 global navigation entries, oversized cartoon hero, 7 equally prominent feature cards, duplicated experimental graphics on molecule cards, long disclaimers and multiple shelves before primary browse.

New approach: **browse-first**. Plain "Explore peptides" library hero -> one search box -> horizontal biology categories -> compact evidence filters -> 16 card records with identity, source layer and explicit details/quickview/compare -> optional tools below. Header is Explore / Compare / Verify / More. Secondary study/organization/material/AI tools remain accessible from a labeled More menu and the "Go deeper" section. Mobile has direct Explore and one Menu. The overlapping animal/cartoon chemical illustrations were replaced by small editorial identity panels, not invented structural diagrams.

Supporting pages: short intros replace oversized decorative hero treatments on Research Desk, Materials, and Organizations; comparison heading is now "Compare compounds". Optional model UI stays **local-only**, hidden entirely on production without a verified live provider pilot. Research briefings and original sources remain usable without AI.

## Release safety, limitations

- Research-only production flag `VIALGRADE_PUBLIC_EVIDENCE_ONLY=true`; original commerce APIs are HTTP 410. Existing historical accounts and privacy rights are preserved.
- Research file A/B/C letters count three curated source layers **for VialGrade's documentation**, NOT biological promise, clinical efficacy, material QC, or a recommended supplier.
- All physical lots unverified; company-authored QC documents are not independent certificates or endorsed sources. One external company may deny bot access; recheck sources and rights before changing that label.
- The model endpoint cannot be active in a public deployment, because `VIALGRADE_LOCAL_PREVIEW` must be true; no real gateway credential and no independent scientific judgment of generative output.
- Clinical study and publication associations are provisional source reconciliation, not a systematic literature review; legal/scientific expert review remains a future release gate for commercial evaluation/supplier recommendation.
- Only public source metadata, research profiles and transparent workpapers appear in this batch; no procurement integration.

## Roadmap ledger

- **Current:** build and test the redesigned browse-first research experience with real browser, mobile screenshots, API commerce denial and release CI.
- **Next:** merge approved researched code into GitHub production and verify Vercel READY, domain alias, GET route health, historic account access, and deny purchase paths.
- **Parked:** unapproved drugs commerce, price or vendor rankings, synthesis ordering, private recommendations, new peptide design.
- **Open:** real user's first-use comprehension, scientific/source reviewer signoff, legal and source rights, unresolved GenScript external access, live model credential+budget, user interview outcome.

**Goal check:** Reducing the number of first-step decisions advances research discovery; the source record and its documented limits remain the authority.
