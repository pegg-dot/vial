# Testing-lab research — provenance & verification record

This file backs `src/server/labs/registry.ts`. Because VIAL publishes factual claims about real
companies, every material claim about a lab is recorded here with its source and a verification
status. Guiding rules:

- **Never repeat a vendor's accreditation claim as fact.** Accreditation is stated only with its
  status (`verified-against-accreditor` / `reported-by-third-party` / `claimed-by-lab` /
  `none-found`) and whether the accredited **scope covers peptides**.
- **Absence-of-evidence framing, not bare negatives.** "No ISO-17025 accreditation is publicly
  documented," not "is not accredited."
- **We only VOUCH (count as independent corroboration) for a `independent`-tier lab.** Contested or
  unconfirmed labs are shown transparently but never counted.

Researched 2026-07-22 via multi-source web verification (corporate registries, accreditation-body
directories, third-party lab-review sites, community forums). Reputation signals largely come from
commercial peptide-review sites and carry inherent bias — tagged accordingly in the registry.

## Tier 1 — confirmed real & independent (counted)

| Lab | Real? | ISO 17025 | Scope covers peptides | Key sourced facts |
|---|---|---|---|---|
| **Janoshik Analytical** | ✅ Czech register (Janoshik s.r.o., IČO 17668727) | **No** (none documented) | n/a | Public verify portal `public.janoshik.com`. 2 Feb 2026 data breach (extortion attempt), per forum reproductions of the lab's own notice. Vendor sites (e.g. chameleonpeptides.com) falsely call it "ISO 17025 accredited" — do not repeat. |
| **MZ Biolabs** | ✅ Tucson AZ (COA primary source) | **No** | n/a | DEA Schedule III **license** ≠ accreditation. Own COA page states it does NOT test activity, sterility/endotoxin, heavy metals, pH. Analyst Ken Pendarvis. |
| **Colmaric Analyticals** | ✅ Colmaric Analyticals LLC, St. Petersburg FL | **Reported** (PJLA #86258, ISO 17025:2017) | **Unconfirmed** | 17025 corroborated by contractlaboratory.com + lab site, but PJLA authoritative directory unreachable to elevate to accreditor-verified; peptide scope not confirmed. |
| **Vanguard Laboratory** | ✅ Olympic Analytical LLC, Olympia WA | **Yes — verified** (A2LA cert 6377.01, to 2027-09-30) | **NO** ⚠️ | Verified against A2LA directory + Scope-of-Accreditation PDF. Accredited scope = food microbiology + ICP-MS heavy metals + residual solvents. **Peptide purity COAs are OUTSIDE the accredited scope** — marketing them as "ISO 17025 accredited" overstates assurance. |
| **Freedom Diagnostics** | ✅ Franklin TN | **No** | n/a | Strongest independence case: ~3,580 tests across unrelated vendors + buyer submissions; explicit "no vendor affiliations." Chemist Stephen Schmidt is a "Nationally Certified Chemist" (personnel cert ≠ lab accreditation). |
| **BTLabs (BioTools, Inc.)** | ✅ West Palm Beach FL, founded 2000 | **No** (reported) | n/a | Analytical arm of BioTools, Inc. (VCD/ROA/FTIR specialist). Independent of the vendors it serves. Correct domain is **btlabtesting.com** (not btltesting.com). |
| **Nutri Analytical Testing Laboratories** | ✅ CA corp #C4681043, Anaheim CA | **No** (none found in A2LA) | n/a | Real independent contract lab (food/supplement focus), independent of Chemyo. HPLC/FTIR technique detail is vendor-reported (Chemyo COAs), not on Nutri's own site. |

## Tier 2 — real, but independence UNVERIFIED (shown, not counted)

| Lab | Real? | Why not counted |
|---|---|---|
| **Kovera Labs** | ✅ operates a real verifier (~1,816 COAs) | Independence **contested**: unverified community allegations of registration/IP overlap with a vendor client and of favoring high-spend vendors; ~6-month-old domain, mailbox address, no accreditation. We neither vouch nor accuse. (A favorable source, vialaudit.com, would be circular — not relied upon.) |
| **SR Bio Labs** | ✅ SR Biolabs LLC, Orlando FL (2023) | No affirmative independence evidence; the "MD" COA-signature credential unverifiable in state records. |

## Tier 3 — existence or independence UNCONFIRMED (shown with caution, never counted)

| Lab | Finding |
|---|---|
| **Horizon Analytical** | Live COA-issuing operation, but **independence not established**: shares a suite address with the DIRECT PEPTIDES trademark owner (Aspire Labs); domain registered the day after that trademark filing; investor memo reportedly treats it as an operational arm. No registered lab entity or accreditation found. Not asserted fake/vendor-owned — independence unestablished. Used on chameleon-peptides COAs. |
| **SteriGenix Analytical** | **Existence as a real independent lab could not be confirmed**: domain registered ~2 months before review; no physical address, phone, business-registry record, or third-party/directory footprint; only self-hosted testimonial. Claims "ISO-17025-aligned" (not accredited) while the vendor (Vici) markets it as "accredited" — a contradiction. Do NOT confuse with "Sterigenics" (a real, unrelated sterilization company). |

## What we do NOT test (deferred, disclosed)

- We did not directly query the Czech Accreditation Institute (Janoshik) or PJLA's live directory
  (Colmaric); those are `none-found` / `reported-by-third-party`, not accreditor-verified.
- Some primary sites (Freedom Diagnostics, SR Bio, Colmaric) blocked automated fetch (403); those
  facts rest on third-party databases and are tagged as such.
- Reputation is community/commercial-review sourced and carries bias; tagged `reported-by-third-party`.
