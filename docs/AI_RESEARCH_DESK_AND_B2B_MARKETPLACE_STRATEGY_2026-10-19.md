# VialGrade: AI-assisted peptide intelligence + long-term B2B research marketplace

Status: **local research prototype only, not deployed, not professionally validated, not legally cleared.**
Date: October 19, 2026.

## Pinned goal anchor

Retain the old discovery and comparison experience while building a defensible research utility for peptide researchers and life-sciences diligence analysts: exact molecular identity, study-design context, clinical registry status, paper and trial links, recorded organizations, documented source uncertainty, and the ability to build inspectable research briefings. Research material authenticity is a separate optional evidence layer, not an efficacy rating. A future institution-gated sourcing/RFQ workflow is only an adjacent business hypothesis.

Success = researchers and analysts use the source links, avoid incorrect entity/PMID/NCT joins, and complete a real professional task more accurately or faster than their present tools. An AI summary, large catalog or long feature list is not proof of demand.

Not the product: unapproved-peptide retail, treatment advice, automatic biological efficacy or safety certifications, blanket patent/FTO guarantees, regulatory-approval predictions, health-interest tracking, or automatically selling/commissioning generated molecules.

## Feasibility findings from the attached brainstorm

**Realistic now without training new AI**
- Tool-bound structured extraction and research-brief drafting over curated source records, with hard source-ID validation and scoped rights.
- Scientific compound and study dossiers, verified *record attribution* and provenance workpapers.
- Editable/explainable source and material-requirement checklists, without pretending a certificate has been independently authenticated.
- A professional pilot for audit packets and regulatory/scientific information reconciliation.
- In a later stage, a privacy-reviewed model API for Q&A and structured answer proposals, always backed by the original linked records.

**Needs independent partners or evidence**
- Lab-issued certificate verification, exact lot and chain-of-custody attestation, sample testing and accredited method reviews.
- Validated synthesize-ability prediction; a Biopython instability index or an RDKit molecular descriptor is NOT certification of synthetic feasibility or biological safety.
- Commercial chemical sequence/structure models, depending on licensing, scale, trained domain workflows and expert checks.
- Validated automated generation of therapeutically meaningful or safe molecular designs; not a one-click production assurance.
- Current supply capacity, RFQ turnaround and quote comparison across providers; those require actual partnerships and fresh integration data.
- Comprehensive patents and freedom-to-operate conclusions, which require skilled professional review.
- Payments/escrow/procurement and fulfilment, which create legal, partner, tax, financial and organizational compliance burdens.

**Claims from the brainstorm NOT verified as business facts**
- "Overwhelming asymmetric demand," guaranteed 30-day production marketplaces, free-for-profit use of ESM3/AlphaFold3, instant AI chemistry validation, multi-million annual supplier idle-capacity claims, cost/time reductions, and automatic escrow safety were unsupported. These are hypotheses, not VialGrade forecasts.
- Structural prediction does not automatically provide target affinity or experimentally established toxicity. MS can provide mass/composition evidence but does not alone establish all binding constants or potency.
- No sample or report is authenticated just because batch strings match or a supplier describes HPLC/MS in a brochure.
- Regulatory "research use only" disclaimers are not a legal exemption when surrounding facts indicate human drug marketing.

## Product sequence and explicit pivot

Old: science-first dossiers -> publisher/source audits -> pilot users -> possible lab verification and marketplace later.

New:
1. **NOW: Research Desk.** Source-grounded Pexiganan investigation cards and a downloadable briefing packet. It uses *existing* six editorial observations and ten original identifiers. Optional copy for an external AI model; **no model call and no drug-design generation**. See /intelligence/desk.
2. **NEXT: real AI evidence assistant.** Scoped model access through tool calls and structured outputs; no free-form model-generated scientific conclusions without deterministic source references, identity/PMID/NCT assertions checked in code, observation timestamps, correction log and expert review. Require user consent if external models receive entered data.
3. **NEXT: professional research validation.** At least five observed researcher tasks and five analyst tasks; independent source/method reviewer for Pexiganan; measure false joins, citation correctness, time and reuse. Discontinue or narrow if not better than existing tools.
4. **CONDITIONAL: evidence-grade material/lab records.** Accredited issuer-confirmed COA and chain-of-custody records with source rights. No association of a provider profile with a specific compound unless shown by a separate original record.
5. **CONDITIONAL: B2B synthesis/RFQ pilot.** Only after verifiable licensed partners, genuine institutional demand, verified compliance boundaries and expert counsel. No retail checkout or referral reactivation. Product-specific eligibility/legal controls are not a substitute for legal clearance.
6. **OPTIONAL research-lab co-design:** validated scientific design-support models and experimental ground-truth loops. Do not connect AI output to a manufacturing transaction without separate protocol, security, scientific and regulatory approvals.

What is deferred: generalized therapeutic lead optimizer, automated FTO scores, "ready to manufacture" tags, real-time provider queues, price and escrow claims, workflow emulating drug dose or individual medical treatment, and merchant fees.

Revisit checkpoint: user sees and tests the local Research Desk; verified source outputs and recorded user feedback show the core evidence workflow has value; legal/source reviews precede any transaction-facing release.

## Practical technology choices

- **Reuse:** current Next.js + React + TypeScript, research source register, public ClinicalTrials.gov/PubMed/PubChem references, request-scoped logic and source workpapers. Keep one repo and its existing locked-down public release mode.
- **Future optional model API:** current structured output + tool-calling model behind a server-only adapter; cap spend, restrict data rights, require source identifiers and machine-checkable output.
- **Scientific libraries (later):** RDKit and Biopython can parse and compute specific descriptors but cannot verify physical manufacturability, toxicity, mechanism or drug success.
- **Structure modeling (later):** commercial rights must be checked by exact license and deployment. Google AlphaFold3 model parameter license limits many uses to non-commercial research; the commercial pathway is separate. EvolutionaryScale API and models also carry separate terms.
- **Data rights:** public metadata versus journal full text and proprietary deal/patent/vendor data must be reviewed independently.
- **Business:** start with paid research utility/seat or issuer-verification software only after genuine evidence of repeat use. Do NOT forecast transaction take-rate before signed supply partner and actual procurement jobs.

## Access and safety

- /intelligence/desk is an explicit read-only anonymous public allowlist route; do not allow any /intelligence/** wildcard in the authenticated perimeter.
- No external request, AI model call, file upload, account, payment, storage of research prompt, vendor data import or third-party sequence optimizer is created in the pilot.
- The generated Markdown brief says no model analysis ran; it includes original URLs, limitations, source roles and unknowns.
- Research-only deployment still denies checkout POST (410) and leaves the original merchant site inactive.
- Do not push or deploy without explicit owner decision and legal/scientific release gate.

## Credible external sources for later review

- OpenAI API Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- RDKit descriptor documentation: https://www.rdkit.org/docs/GettingStartedInPython.html
- AlphaFold3 code/commercial caveat: https://github.com/google-deepmind/alphafold3/blob/main/README.md
- AlphaFold3 weight terms: https://github.com/google-deepmind/alphafold3/blob/main/WEIGHTS_TERMS_OF_USE.md
- EvolutionaryScale model use terms: https://www.evolutionaryscale.ai/policies/terms-of-use
- FDA 2026 research-use-only marketing example: https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/peak-performance-peptides-735127-08242026
- BioCentury BCIQ (existing competing biopharma deal/data platform): https://bciq.biocentury.com/

## Goal check

The Research Desk is an enabler of evidence traceability, not a replacement for market discovery. The meaningful scientific output is what was observed, on which exact source record, what it does not establish, and the next independently inspectable check. Generative AI should help navigate that record, not invent a laboratory result or substitute for an institution's compliance system.
