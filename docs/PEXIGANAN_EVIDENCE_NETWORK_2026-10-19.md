# VialGrade / Pexiganan Evidence Network pilot

Local research implementation: 2026-10-19.
**NOT LIVE on vialgrade.com.** No Vercel, GitHub push, pull request,
production database changes, personal research history import, seller
catalog import, checkout or referral activation.

## Goal anchor

Help a scientific researcher or life-sciences diligence analyst follow
a *specific scientific question* across molecular identity, primary
experimental papers, trial registry fields, publication links, recorded
sponsors and missing provenance. Each claim should be auditable against
the original source and should remain uncertain where not independently
reviewed.

The original marketplace UX is an **enabler**: approachable browse,
dossiers, quick views, transparent verification, evidence passports,
compare and linked records. It is not a request to start selling
unapproved drugs, advertising research peptides for consumption or
ranking sellers.

Core value to validate: faster, more accurate evidence reconciliation
than a researcher's existing ChatGPT/Claude/PubMed/registry workflow.
Not the product: therapeutic advice, clinical effectiveness verdicts,
material quality or "purity" score, dosing/experimental use instructions,
supplier recommendations, investment predictions or copyright-unlicensed
full-text redistribution.

## Explicit pivot and release policy

**Old sequence:** marketplace-style interface + superficial source-file
letter across 16 subjects -> specialist scientific rubric or catalog
expansion -> pilot.

**New sequence:** one end-to-end Pexiganan experience, using older
marketplace verification and passport patterns -> real interactive
Mac review -> independent methods review and measured real user tasks ->
extend the verified entity graph to other subjects and organization
profiles -> one cost-approved production release.

**Why:** The 16-card index had little connected depth. The old
marketplace was more comprehensive because each listing had a
verification, grade, company and source graph. Restoring those
relationships with original scientific records is more useful than
shipping more unreviewed cards. Do not replicate old shopping funnels
under a "research-only" label.

**Revisit checkpoint:** A qualified researcher checks the six precise
case claims, an analyst reviews attribution and publication/trial
linkage, then five researchers and five analysts independently complete
bounded tasks against their own baseline tools. Scope expansion is
contingent on fewer false joins, correct uncertainty and useful
time savings. Domain/mail, privacy and source-use rights remain
separate release blockers.

## Grounding from October 19 live original sources

Public IDs, rechecked using the official APIs. Editorial curation
is a manually pinned snapshot; opened trial rows call the public NIH
API again (six-hour Next.js cache). Live failures are shown as
unavailable, NOT empty evidence.

- PubChem Pexiganan CID 16132253:
  https://pubchem.ncbi.nlm.nih.gov/compound/16132253
- PubChem Magainin 2 CID 16130189:
  https://pubchem.ncbi.nlm.nih.gov/compound/16130189
- Original biophysical model paper, PMID 12719236 (2003),
  PubMed PublicationTypes including Journal Article:
  https://pubmed.ncbi.nlm.nih.gov/12719236/
- Magainin/Pexiganan relation review, PMID 19010301 (2009),
  PubMed PublicationType Review:
  https://pubmed.ncbi.nlm.nih.gov/19010301/
- Older topical pexiganan comparative clinical publication,
  PMID 18990064 (2008), PubMed PublicationType Randomized
  Controlled Trial, with no exact NCT in the inspected article
  ID list:
  https://pubmed.ncbi.nlm.nih.gov/18990064/
- Later peptide-design publication, PMID 36781451 (2023),
  PubMed PublicationType Review; cited under registry
  bibliography role DERIVED by NCT01594762:
  https://pubmed.ncbi.nlm.nih.gov/36781451/
- NCT01594762 and NCT01590758: both list "Topical pexiganan
  cream 0.8%" as an intervention, Phase 3, completed; on the
  October 19 checked registry versions, both had posted results.
  Lead sponsor recorded: "Dipexium Pharmaceuticals, Inc.".
  https://clinicaltrials.gov/study/NCT01594762
  https://clinicaltrials.gov/study/NCT01590758
- NCT00563394 and NCT00563433: both list MSI-78 and
  ofloxacin in intervention fields, Phase 3, completed,
  no posted results section in checked registry version.
  Lead sponsor recorded: "Abeona Therapeutics, Inc".
  Both cite PMID 18990064 in DERIVED bibliography fields.
  https://clinicaltrials.gov/study/NCT00563394
  https://clinicaltrials.gov/study/NCT00563433

**Important reasoning boundary:** A bibliographic link labeled
DERIVED is not equivalent to a journal's ArticleType or to a
verified NCT-to-paper result relation. For PMID 18990064,
the article type is an RCT but we have not proven equivalence to
either listed historical NCT; an ambiguous topical relation is
flagged NEEDS INTERPRETATION. For PMID 36781451, the article is
classified Review, NOT a primary report from the later Phase 3
trial. Posted trial results, article titles and citation labels
do NOT themselves tell us the treatment's effect.

ClinicalTrials.gov sponsor naming is source attribution only.
No assertion about modern ownership, licenses, manufacturing,
corporate health, or pharmaceutical approval. The original
vendor directory, COAs and lab-tester ratings are excluded.

## Implementation

### Case graph

- 2 independently named PubChem molecule CIDs.
- 4 individually chosen ClinicalTrials.gov registry study IDs.
- 4 specific PubMed article records, including 2 reviews.
- 2 organizations named as recorded lead sponsors.
- 6 small claim-to-source observations; each includes which
  facts are observed, how they are linked, what they do not
  establish, links and the next concrete scientific review task.

### Pages

- /intelligence/explore/pexiganan — original marketplace
  illustration and grade; new interactive wayfinder;
  six-claim preview; FOUR official trial summaries and
  results-section state; related original comparison;
  full original-source register.
- /intelligence/passports/pexiganan — full evidence passport,
  source hierarchy/limitations, separate registry checks,
  detailed graph, and downloadable source-cited Markdown.
- /intelligence/verify — input an exact NCT/PMID/CID in the
  *curated source index only*, show its observed publication type/
  record role/limitations, original public URL and connected claims.
  No broad arbitrary internet search, arbitrary URL fetching,
  uploaded PDFs, vendor check or saved user search profile.
- /intelligence/organizations — two historically named lead
  sponsors with cited original trial fields; one explicit
  unverified laboratory subsection, no supplier ratings.

The other 15 curated subjects retain their previous dossiers
without invented publication/lab/company links. Only the
Pexiganan pilot receives this new deep source connection.
All links and routes use explicit research-only allowlists,
not a global public /intelligence* prefix.

### Code/data constraints

- Static curated public identities and source claim labels in
  src/lib/pexiganan-evidence-network.ts (no history from old DB).
- Cached exact NCT lookup reused in
  src/server/intelligence/pexiganan-network.ts; intervention
  names checked before showing registry content as a
  matched source. Failure and identity mismatch fail closed.
- No price, vendor, personal health data, user account activity,
  COA, sample supply, shopping cart or payments.
- Source workpaper is original metadata paraphrase and links,
  not copyrighted journal abstracts/full texts.
- Six-hour cache is not an official real-time trial surveillance
  service. Editorial snapshots have explicit 2026-10-19 date.

## Local QA

Validate new pure source map, allowlist verifier, registry name
boundaries (MSI-78 versus MSI-780), mocked unknown/unavailable
study states, source/claim graph, file download, public routes,
mobile width, default-mode compatibility, old marketplace
transaction endpoint 410s, role/accessibility/security audits.

Run research-only optimized Next.js build, local browser walkthrough
and 1440px / 390px screenshots. The persistent
Documents/VialGrade/Research_Preview_App copy is the owner-visible
artifact; its launcher binds to 127.0.0.1:39571. Commit/backup
locally with bundle and patch. DO NOT deploy while iterating.

### Roadmap ledger

**Now:** finish pilot code, tests, local interactive preview and
source methodology documentation.

**Next:** have an independent methodologist adjudicate each claim,
including exact trial-paper linkage, examine *numerical* outcomes
and permitted published text, and measure real researcher/analyst
completions against existing tools.

**Parked:** commercial supplier verification, paid licensed
content, forensic COA authentication, seller grades, pricing,
checkout, broad automated scientific ranking, live personalized
alerts and procurement.

**Open:** professional usefulness, access/source license terms,
scientific peer review, privacy and archived account retention,
domain email receipt and owner-approved batch release.

**Goal check:** restoring market *relationships* makes the original
scientific source-check task easier. Without verified claimed
findings and a repeat professional use case, it is still a pilot,
not a ready-made biomedical evidence authority.
