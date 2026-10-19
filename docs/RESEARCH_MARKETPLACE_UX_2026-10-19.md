# Marketplace-style discovery without restarting commerce

Local development checkpoint, 2026-10-19. Not pushed or deployed.

## Goal anchor

A person arriving at VialGrade should be able to browse peptide research as
easily as a product directory, but the destination is a usable **source
workpaper**: what was studied, which exact molecule/intervention, where the
original record can be opened, and what remains unverified.

Primary test audiences are researchers and biotech/life-sciences diligence
analysts. These are customer hypotheses until actual observed tasks and
scientific expert validation. No sales, suppliers, prices, promotional
"best peptide" ranks, medical or financial recommendations.

## Grounding: why the market UI looked better

The original physical marketplace is preserved in git tag
archive/marketplace-pre-research-2026-10-18. Inspection of the original
market page and its MarketExperience revealed five useful navigation
patterns:
- Big, clear visual identity with thick outlines, mint/black color and
  distinctive decorative science art.
- Horizontal category rail.
- A browseable, swipable, curated collection row.
- Quick-view panel before navigating to a detailed record.
- Filterable full catalog with a compare workflow.

Original MarketExperience also contained supplier listings, price
history, seller comparisons, "trending" rankings based on old activity,
lab-certificate claims, availability, external vendors and checkout.
These are NOT reusable research data, nor are those commercial
functions permissioned for the public research product.

## Explicit small pivot

Old sequence: science-led research explorer plus evidence workpapers,
then independent researcher and analyst usefulness validation.

New sequence: preserve the evidence workpapers, but first restore
a faster catalog/quick-view interaction and hand the owner a REAL
interactive local preview on the Mac. Then gather first-use UX feedback
and proceed to independent expert and task tests. This is a UI/product
visibility correction, not a return to a sales business.

The market-styled research surfaces use ONLY the 16 hand-curated
nonpersonal RESEARCH_SUBJECTS. There is no import of legacy market
products, sellers, pricing, user history, vendor quality claims,
inventory, lab certificates, or purchases.

## In this local iteration

- Compact mint/black scientific directory hero, plain purpose statement,
  concrete action to browse and linked guided evidence example.
- Horizontal, scrollable category pills over four areas. Counts are
  numbers of *curated subjects*, not inventory or research volume.
- Swipeable shelf of five explicitly selected NCT trial examples.
  There is NO scientific ranking, trending label, or "best" claim.
- Compact four-column research tiles on wide displays, two columns
  on tablets, single on narrow mobile; bold abstract original-VialGrade
  artwork is decorative, not the molecule's chemical structure.
- Quick-view dialogs for each subject, including molecular identity,
  one investigator question, aliases, original molecular-reference
  link, source limitations and the selected study ID when pinned.
- Filters distinguish five selected official trial examples from
  eleven subject entries with identity sources only. "Identity only"
  never means no clinical study exists.
- An in-session two-to-three-subject comparison tray reuses the
  research comparison workpaper. No purchase cart or saved consumer
  interest profile exists.
- Product-detail-like dossier cover with matching decorative art
  and anchors for Overview / Trial evidence / Sources / Related.
- Existing source-based trial checks, specific original publication
  relationships, study results-section distinctions and the guided
  Magainin 2 / Pexiganan case stay intact.

## Release / validation decisions

The user previously requested to minimize Vercel costs. DO NOT push,
open a PR, create a Vercel preview, merge or deploy every iteration.
Instead open a local optimized evidence-only server at localhost on
their connected Mac (NOT a public Internet endpoint). The browser
must show the exact local commit with a clear local-preview marker.
Save a desktop/mobile image gallery as a fallback, and a git bundle
as a durable restoration checkpoint.

New UI should be tested in research-only mode with Playwright for
theme rails, source facets, quick view (keyboard/Escape), comparison,
dossier links, mobile overflow and direct HTTP 410 transaction blocks.
Also run historical-mode compatibility browser checks, TypeScript,
ESLint, integration/unit, security and role/accessibility scripts.

Professional utility remains to be tested with the already-prepared
scientist and analyst 10-task script. Validation must test correctness,
original-source attribution, completion time and user interest
against PubMed, ClinicalTrials.gov, Google Scholar, ChatGPT/Claude
and actual specialist tools. A prettier research catalog is only an
ENABLER for the source-reconciliation job.

## Current roadmap ledger

Current: one research-only marketplace-style browsing prototype and
a direct local interactive preview, no public deployment.
Next: the user judges the prototype hands-on; close navigational gaps
and run independent scientific/source review and five first-use tasks
per audience before further feature growth.
Parked: extensive source indexing, automatic efficacy ratings,
clinical outcome prediction, procurement, vendors, paid source feeds,
user-history tracking, science-themed shopping and buyer funnels.
Open: research-demand differentiation, source-content reuse rights,
scientific review, privacy/#24, mail receipt/#23, cost-approved
batched production deployment and whether the browsing motif
actually improves a real researcher task.

Goal check: marketplace interaction is an enabler; the core product
is a trusted, faster source-reconciliation workpaper. If professional
tests don't show advantage, don't over-invest in a decorative catalog.
