# Dossier redesign and the supplier/lab grading layer
Date: 2026-11-04. Status: design plus the dossier rebuild in the same PR. The supplier/lab grading layer is **design only** and needs an owner decision (section 4).

## 1. What is wrong today (observed, with screenshots from 2026-11-04)
The landing page (`/intelligence`) and the market page speak one visual language: heavy ink borders (`.ink`), hard offset shadows (`.hard`), very large display type, mint and blue accents, pill chips, one idea per block. The dossier (`/intelligence/explore/<slug>`) speaks a second one: cream ground, thin grey borders, lilac and pale-green tints, small semibold type, and four or five different card styles on one page.

Organization problems on the dossier, beyond colour:
- **Two columns of equal weight.** A main column and a right rail both carry primary content (material check, selected study, related research), so a reader does not know where to look.
- **Navigation hides itself.** Sections are behind a pill row with a "More sections +" menu; the order of the pills does not match the order on the page.
- **No stable order.** Pexiganan, compounds with a pinned study, and compounds without one each get a different sequence of cards, so the page is not learnable.
- **Same fact stated 3-4 times.** "Not verified / not a product / file grade" appears in the hero, the strip under it, the grade card and the material card.
- **Hero is heavy, content is light.** Roughly a screen and a half of chrome before the first real fact (the research question).
- **Technical details hidden in an accordion** while marketing-like copy is open.

## 2. How others organize this (what I could actually read)
- **Examine.com (supplement pages), read 2026-11-04.** Breadcrumb; title; author, reviewer and last-updated line; a "Research Snapshot" box of counts and evidence grades; quick-jump buttons; a **sticky left table of contents** with every section; fixed section order (overview, dosage, database table, safety, FAQs, dated update history, references); numbered inline citations resolving to one reference list. Lesson: one fixed order for every page, a sticky contents list, a snapshot box up top, dated change history, references at the bottom.
- **Finnrick (peptide vendor testing), read 2026-11-04.** Per vendor *and per peptide* ratings from the operator's own purchased and lab-tested samples; the rating is pulled toward a peer baseline when tests are few, and marked tentative or unrated below a threshold; ties broken by published rules; corrections issued as notices; stated policy of no payment for rankings; explicitly "not an endorsement". Lesson: a supplier grade is only credible when it shows sample counts, method, confidence and a corrections policy next to the letter.
- **Not read:** PubChem and DrugBank (bot-blocked), Labdoor (certificate error). I am not citing them. Nate's own landing and market pages are the in-house reference for look and feel.

## 3. Proposed dossier structure (built in this PR)
One visual system (the landing system), one fixed order, one navigation.

1. **Hero (compact).** Breadcrumb, theme chip, name, one-sentence identity, file-coverage mark, three actions. Right: the "snapshot" card (what this is, what is linked, what is not verified), stated once.
2. **Sticky contents** (left on desktop, a horizontal bar on phones): *Overview, Source file, Studies, Sources and organizations, Materials, Limits and related.* Same six on every page; a section with nothing to show says so rather than disappearing.
3. **One section frame** (`ink` border, hard shadow, numbered eyebrow, display-weight heading) for all six, so cards stop competing.
4. The right rail is removed; its cards move into the sections they belong to.
5. Existing anchors (`#overview`, `#file-grade`, `#evidence-review`, `#pexiganan-trials`, `#sources`, `#organizations`, `#material-evidence`, `#related`) are kept so links and tests keep working.
6. Child components keep their logic; only their shells and colours move to the landing palette.

Not changed: copy limits ("not usability-validated", "file coverage is not a quality claim"), the evidence-only quarantine, any data or route.

## 4. Supplier, lab and storefront grading: what exists and what it would take
Nate's direction (2026-11-04): researchers who want to look into individual brands should still be able to see VialGrade's grading of vendors, labs and storefronts; it should not just be removed.

What exists in the repo (retired behind the quarantine): `/vendors`, `/labs`, `/passports` pages; `vendor-grade-schema`, vendor ranking and reviews; collectors for storefronts and lab certificates (`collect`, `provenance` crons, live ingest off unless `VIALGRADE_LIVE_INGEST_APPROVED=true`); the old A-F grade logic. Today `publicReleaseAction` redirects those routes and returns 410 for their APIs "while prior seller/COA sources, privacy rights, and editorial claims are reviewed".

A supplier layer that fits the evidence-first product (modelled on what Finnrick shows, section 2):
- A separate **Suppliers** lens, one page per organization (brand, lab, storefront), reachable from a dossier's Materials section and from the main nav, never mixed into the compound file grade.
- Every grade shows: what was measured, how many samples or documents, date range, method, confidence ("tentative" or "unrated" below a threshold), who tested, and a corrections log. No grade without its evidence beside it.
- No price, stock, cart, referral link or "buy" wording; links go to the organization's own documentation or the lab's published report, labelled "document as published, not independently verified".
- Rights check per document before display (already the owner's decision for COAs).

What I did **not** do, and why: re-enabling these routes means changing `publicReleaseAction` and the 410 policy, which the quarantine and the handoff say needs legal review first (the risk is the surrounding facts, such as human-use peptides and "research use only" labels, reading as marketing; a disclaimer is not an exemption). That is a decision for Nate and counsel, not an engineering default. The path I recommend: (a) counsel review, (b) a deliberate, tested allow-list change in its own PR behind an explicit release flag, (c) rebuild grading from sourced documents with the confidence rules above, not from the old storefront-scrape scores.

## 5. Crons (what each does, and what changed)
| Cron | What it does now | Change |
|---|---|---|
| `refresh` | Retention (privacy-promise deletions), probe-cache prune, cost-signal check, and now deleting unconfirmed email signups. Skips the market sweep under the quarantine. | **Weekly** (was daily). Needed for the privacy deletions; monthly would let promised deletions slip by up to a month. |
| `digest` (new) | Monthly email of changed ClinicalTrials.gov records. | **Monthly**, 2nd of the month. |
| `collect`, `provenance` | Storefront collection and certificate provenance; do nothing unless live ingest is approved. | **Unchanged.** Tests pin their daily cadence and schedule capacity; changing them is part of the supplier-grading decision above. If live ingest is off in production they are free no-ops and can be removed. |
| `notifications` | Hard-coded "paused" response. | **Unchanged**, but removable: a unit test pins its schedule, so removal needs that test and the paused feature retired together. |
