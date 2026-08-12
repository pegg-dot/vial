// The lab registry — the single source of truth for every testing laboratory VialGrade references.
//
// This exists for one reason: VialGrade publishes factual claims about real companies, so every claim
// here is sourced, hedged, and tiered by how much we can actually stand behind it. Two rules:
//   1. We only VOUCH that a certificate is "independently tested" when the lab is a confirmed,
//      real, third-party laboratory (independence: "independent"). Everything else is shown for
//      transparency but never counted as independent corroboration.
//   2. We never repeat a vendor's accreditation claim as fact. Accreditation is stated only with
//      its verification status, and — critically — whether the accredited SCOPE actually covers
//      peptide testing (an accreditation for food microbiology does not vouch for a peptide assay).
//
// Sources for every profile are recorded in docs/labs-research.md. Copy is deliberately
// absence-of-evidence framed ("no public accreditation record found"), never a bare negative.

export type LabIndependence = "independent" | "independence-unverified" | "unverified";

export interface LabProfile {
  slug: string;
  displayName: string;
  aliases: string[]; // every raw string seen in COAs that should canonicalize to this lab
  independence: LabIndependence;
  exists: "confirmed" | "unconfirmed";
  independentNote?: string; // shown when independence !== "independent"
  legalName: string | null;
  country: string | null;
  website: string | null;
  accreditation: {
    iso17025: boolean | null;
    standard: string | null;
    body: string | null;
    number: string | null;
    status: "verified-against-accreditor" | "reported-by-third-party" | "claimed-by-lab" | "none-found";
    scopeCoversPeptides: boolean | null;
    note: string;
  };
  techniques: string[];
  testsByDefault: string[];
  doesNotTestByDefault: string[];
  verifyPortal: string | null;
  reputation: string;
  incidents: string[];
  sourceUrls: string[];
}

// prettier-ignore
export const LAB_REGISTRY: LabProfile[] = [
  {
    slug: "janoshik-analytical", displayName: "Janoshik Analytical", aliases: ["janoshik", "janoshik analytical", "janoshik s.r.o."],
    independence: "independent", exists: "confirmed",
    legalName: "Janoshik s.r.o. (IČO 17668727)", country: "Czech Republic (Prague)", website: "https://janoshik.com",
    accreditation: { iso17025: false, standard: null, body: null, number: null, status: "none-found", scopeCoversPeptides: null,
      note: "No ISO/IEC 17025 accreditation is publicly documented. Stated as absence-of-evidence: multiple independent industry reviews report it holds none, and we did not query the Czech Accreditation Institute directly. Some vendor sites falsely describe Janoshik as ISO-17025 accredited — that claim is not substantiated." },
    techniques: ["HPLC-UV (purity)", "LC-MS (identity)", "GC-MS"], testsByDefault: ["Purity (HPLC)", "Identity (often bundled)"],
    doesNotTestByDefault: ["Sterility", "Endotoxin", "Heavy metals"], verifyPortal: "https://public.janoshik.com",
    reputation: "Widely described as the de-facto most-used third-party tester in the research-peptide community — while explicitly not a pharmaceutical-grade or accredited lab. Legal entity verified in the Czech business register.",
    incidents: ["Data breach on 2 Feb 2026 with an extortion attempt; the lab posted a security notice and restored service. Reported via forum reproductions of the lab's own notice, not independently confirmed by a security firm or regulator."],
    sourceUrls: ["https://public.janoshik.com/", "https://www.northdata.com/Janoshik+s.r.o.,+Praha/ICO+17668727", "https://www.peptideprotocolwiki.com/blog/janoshik-analytical-review"],
  },
  {
    slug: "mz-biolabs", displayName: "MZ Biolabs", aliases: ["mz biolabs", "mzbiolabs", "mz bio labs"],
    independence: "independent", exists: "confirmed",
    legalName: null, country: "United States (Tucson, AZ)", website: "https://www.mzbiolabs.com",
    accreditation: { iso17025: false, standard: null, body: null, number: null, status: "none-found", scopeCoversPeptides: null,
      note: "Not ISO/IEC 17025 accredited (its own COA page makes no such claim; third-party reviews confirm none on file). It describes itself as a US DEA Schedule III licensed facility — a controlled-substance handling license, NOT a testing-competence accreditation, and not to be conflated with one." },
    techniques: ["HPLC-UV (purity)", "HPLC-MS / QTOF (identity)"], testsByDefault: ["Purity", "Identity", "Quantification"],
    doesNotTestByDefault: ["Activity/potency", "Sterility/endotoxin", "Heavy metals", "pH"], verifyPortal: null,
    reputation: "Regarded within the community as a trusted US lab, often grouped with Colmaric and Janoshik. COAs signed by analyst Ken Pendarvis; documented cases of correctly flagging mislabeled samples. Reputation signals are from commercial review sites, not peer-reviewed sources.",
    incidents: [], sourceUrls: ["https://www.mzbiolabs.com/mzbiolabs/coa-testing/", "https://peptigrity.com/testing-labs/mz-biolabs"],
  },
  {
    slug: "colmaric-analyticals", displayName: "Colmaric Analyticals", aliases: ["colmaric", "colmaric analyticals", "colmaric analyticals llc"],
    independence: "independent", exists: "confirmed",
    legalName: "Colmaric Analyticals LLC", country: "United States (St. Petersburg, FL)", website: "https://www.colmaricanalyticals.com",
    accreditation: { iso17025: true, standard: "ISO/IEC 17025:2017", body: "Perry Johnson Laboratory Accreditation (PJLA)", number: "86258", status: "reported-by-third-party", scopeCoversPeptides: null,
      note: "An ISO/IEC 17025:2017 accreditation (PJLA #86258) is stated on the lab's site and corroborated by an independent lab directory, but we could not reach PJLA's authoritative directory to elevate it to accreditor-verified, and could not confirm the accredited scope covers research-peptide RP-HPLC. Treat as well-supported but not accreditor-verified; peptide scope unconfirmed." },
    techniques: ["HPLC", "GC", "LC-MS/MS"], testsByDefault: ["Identity", "Purity", "Assay/potency"],
    doesNotTestByDefault: [], verifyPortal: null,
    reputation: "Established full-service contract lab (supplement/pharma/cosmetic/food), grouped with MZ and Janoshik as a top trusted option for peptide COAs. Reputation signals from commercial review sites.",
    incidents: [], sourceUrls: ["https://contractlaboratory.com/vendor/colmaric-analyticals-llc/", "https://www.contractresearchmap.com/providers/colmaric-analyticals"],
  },
  {
    slug: "vanguard-laboratory", displayName: "Vanguard Laboratory", aliases: ["vanguard", "vanguard laboratory", "vanguard sciences", "olympic analytical", "vanguardeagle"],
    independence: "independent", exists: "confirmed",
    legalName: "Olympic Analytical, LLC (dba Vanguard Laboratory)", country: "United States (Olympia, WA)", website: "https://vanguardlaboratory.com",
    accreditation: { iso17025: true, standard: "ISO/IEC 17025:2017", body: "A2LA", number: "6377.01", status: "verified-against-accreditor", scopeCoversPeptides: false,
      note: "A2LA ISO/IEC 17025:2017 accreditation is REAL and current (cert 6377.01, verified against A2LA's directory and Scope-of-Accreditation PDF, valid to 30 Sep 2027). CRITICAL: the accredited scope covers food microbiology, ICP-MS heavy metals, and residual solvents — NOT peptide purity/identity. So a Vanguard peptide COA is issued OUTSIDE its accredited scope; presenting it as 'ISO-17025 accredited' overstates the assurance." },
    techniques: ["HPLC-UV/VIS (peptide purity — outside accredited scope)", "ICP-MS heavy metals (accredited)", "GC residual solvents (accredited)", "AOAC microbiology (accredited)"],
    testsByDefault: ["Purity", "Identity/quantity (peptide COAs, via HPLC — outside accredited scope)"], doesNotTestByDefault: [], verifyPortal: null,
    reputation: "A genuinely accredited US lab; its peptide COAs are cited by vendors such as Umbrella Labs and Core Peptides. The key buyer caveat is the scope mismatch above.",
    incidents: [], sourceUrls: ["https://customer.a2la.org/index.cfm?event=directory.detail&labPID=AFB43615-8155-4AF3-82FA-2020F7FFA8D6", "https://contractlaboratory.com/vendor/vanguard-laboratory/"],
  },
  {
    slug: "freedom-diagnostics", displayName: "Freedom Diagnostics Testing", aliases: ["freedom diagnostics", "freedom diagnostics testing"],
    independence: "independent", exists: "confirmed",
    legalName: "Freedom Diagnostics Testing", country: "United States (Franklin, TN)", website: "https://freedomdiagnosticstesting.com",
    accreditation: { iso17025: false, standard: null, body: null, number: null, status: "none-found", scopeCoversPeptides: null,
      note: "No ISO/IEC 17025 accreditation on file. Principal chemist Stephen Schmidt is reportedly a 'Nationally Certified Chemist' — a personnel certification, not a lab accreditation, and not to be presented as ISO 17025." },
    techniques: ["HPLC (purity)", "LC-MS/MS (identity)"], testsByDefault: ["Purity + identity (dual-method standard)"],
    doesNotTestByDefault: [], verifyPortal: "https://freedomdiagnosticstesting.com",
    reputation: "Among the strongest independence cases: ~3,580 tests across multiple unrelated vendors plus individual-buyer submissions, and an explicit 'no vendor affiliations' self-statement corroborated by third-party review sites. Still unaccredited.",
    incidents: [], sourceUrls: ["https://peptigrity.com/testing-labs/freedomdiagnosticstesting-com", "https://batchguild.com/labs/freedom-diagnostics/"],
  },
  {
    slug: "btlabs", displayName: "BTLabs (BioTools, Inc.)", aliases: ["btlabs", "btl testing", "btlabs (biotools, inc.)", "biotools", "bt labs"],
    independence: "independent", exists: "confirmed",
    legalName: "BTLabs — analytical division of BioTools, Inc.", country: "United States (West Palm Beach, FL)", website: "https://btlabtesting.com",
    accreditation: { iso17025: false, standard: null, body: null, number: null, status: "reported-by-third-party", scopeCoversPeptides: null,
      note: "A genuine, long-established analytical firm (BioTools, Inc., founded 2000), but a third-party reviewer reports it is not currently ISO/IEC 17025 accredited and none is claimed on its site. Present as a real independent lab with accreditation not verified." },
    techniques: ["HPLC (purity)", "FTIR / MS (identity)", "VCD/ROA (structure)", "In-house microbiology (endotoxin/sterility)"],
    testsByDefault: ["Purity", "Identity", "USP compendial methods"], doesNotTestByDefault: [], verifyPortal: null,
    reputation: "The analytical arm of BioTools, Inc. — a real instrumentation/contract-research company. Independent of the peptide vendors it serves. Peptide testing is one segment of a broad multi-industry portfolio.",
    incidents: [], sourceUrls: ["https://contractlaboratory.com/vendor/btlabs/", "https://peptigrity.com/testing-labs/btlabs"],
  },
  {
    slug: "nutri-analytical", displayName: "Nutri Analytical Testing Laboratories", aliases: ["nutri analytical", "nutri analytical testing laboratories", "nutri analytical testing"],
    independence: "independent", exists: "confirmed",
    legalName: "Nutri Analytical Testing Laboratories (CA entity #C4681043)", country: "United States (Anaheim, CA)", website: "https://nutrianalytical.com",
    accreditation: { iso17025: false, standard: null, body: null, number: null, status: "none-found", scopeCoversPeptides: null,
      note: "A registered California corporation; no ISO/IEC 17025 record found in the A2LA directory and none claimed on its site. Absence of a record is not proof of non-accreditation. Its own site lists analysis categories but not HPLC/FTIR instruments — those specifics come from the vendor's (Chemyo's) COAs, so treat technique detail as vendor-reported." },
    techniques: ["Amino-acid analysis", "Vitamin/nutraceutical analysis", "Mineral & heavy-metal analysis"], testsByDefault: ["Compositional/quantitative analysis"],
    doesNotTestByDefault: [], verifyPortal: null,
    reputation: "A genuine small independent contract lab (food/supplement/nutraceutical focus), independent of the peptide vendor (Chemyo) that publishes its reports.",
    incidents: [], sourceUrls: ["https://nutrianalytical.com/", "https://opencorporates.com/companies/us_ca/C4681043"],
  },
  // ── Tier 2: real labs whose INDEPENDENCE we could not confirm — shown, never vouched-for ──
  {
    slug: "kovera-labs", displayName: "Kovera Labs", aliases: ["kovera labs", "koveralabs", "kovera"],
    independence: "independence-unverified", exists: "confirmed",
    independentNote: "Kovera operates a real public COA verifier (~1,816 certificates), but its independence is contested: community reports allege registration/IP overlap with a vendor client and question its ~6-month-old domain, mailbox address, and lack of accreditation. These are unverified allegations — we neither vouch for nor accuse; we simply do not count it as confirmed independent evidence.",
    legalName: null, country: "United States (Illinois, claimed)", website: "https://koveralabs.com",
    accreditation: { iso17025: null, standard: null, body: null, number: null, status: "none-found", scopeCoversPeptides: null, note: "No accreditation displayed or found." },
    techniques: ["HPLC (purity)", "LC-MS (identity)"], testsByDefault: ["Purity", "Identity"], doesNotTestByDefault: [], verifyPortal: "https://koveralabs.com/verify",
    reputation: "Contested. High COA volume with publicly-visible failures (a good-practice signal), but unverified community allegations of vendor ties and an unestablished physical lab presence.",
    incidents: ["Community allegations (unverified) of registration/IP overlap with vendor InstantPeptides and of favoring high-spend vendors; reported non-response to facility-visit requests."],
    sourceUrls: ["https://community.peptidecritic.com/topic/918/new-lab-koverlabs-a-bit-concerning", "https://www.scamadviser.com/check-website/koveralabs.com"],
  },
  {
    slug: "sr-bio-labs", displayName: "SR Bio Labs", aliases: ["sr bio labs", "sr biolabs", "sr biolabs llc"],
    independence: "independence-unverified", exists: "confirmed",
    independentNote: "SR Biolabs LLC is a real Florida company, but we found no affirmative evidence establishing its independence from the vendors it serves, and the 'MD' credential on its COA signatures could not be verified in state records. Shown, not vouched-for.",
    legalName: "SR Biolabs LLC", country: "United States (Orlando, FL)", website: "https://srbiolabs.com",
    accreditation: { iso17025: null, standard: null, body: null, number: null, status: "none-found", scopeCoversPeptides: null, note: "No ISO/IEC 17025, CLIA, or A2LA accreditation stated or found." },
    techniques: ["LC-MS", "HPLC"], testsByDefault: ["Purity/identity (LC-MS)"], doesNotTestByDefault: [], verifyPortal: "https://srbiolabs.com/coa-lookup/",
    reputation: "Thin public reputation. A real state-registered FL LLC operating a testing site; little independent review data exists.",
    incidents: ["Publicly states it is relocating and advises not to ship samples during the transition."],
    sourceUrls: ["https://www.bizapedia.com/fl/sr-biolabs-llc.html", "https://srbiolabs.com/"],
  },
  // ── Tier 3: existence or independence UNVERIFIED — shown with a clear caution, never counted ──
  {
    slug: "horizon-analytical", displayName: "Horizon Analytical", aliases: ["horizon analytical"],
    independence: "unverified", exists: "unconfirmed",
    independentNote: "We could not confirm Horizon Analytical is a real, independent lab. Circumstantial public records tie it to a peptide-vendor group (a shared suite address with the DIRECT PEPTIDES trademark owner; a domain registered the day after that trademark filing). No registered lab entity or accreditation was found. We do not assert it is fake or vendor-owned — only that its independence is not established.",
    legalName: null, country: "United States (Texas, reported)", website: "https://horizonanalytical.com",
    accreditation: { iso17025: null, standard: null, body: null, number: null, status: "none-found", scopeCoversPeptides: null, note: "No accreditation claimed or found." },
    techniques: ["HPLC/MS (self-described)"], testsByDefault: ["Purity", "Identity", "Endotoxin (self-described)"], doesNotTestByDefault: [], verifyPortal: "https://horizonanalytical.com/verify-coa",
    reputation: "A live COA-issuing operation with a verification portal, but its independence from the vendors it serves is unestablished, with documented circumstantial affiliation red flags.",
    incidents: [], sourceUrls: ["https://horizonanalytical.com/", "https://krysia0430.substack.com/p/direct-peptides-and-horizon-analytical"],
  },
  {
    slug: "sterigenix", displayName: "SteriGenix Analytical", aliases: ["sterigenix", "sterigenix analytical", "sterigenix analytical llc"],
    independence: "unverified", exists: "unconfirmed",
    independentNote: "We could not confirm SteriGenix exists as a real, independent lab. Its domain was registered ~2 months before review; the site publishes no physical address or phone; no business-registry record or any third-party/directory footprint was found. It claims to be 'ISO-17025-aligned' (not accredited), while the vendor using it markets it as 'ISO-17025 accredited' — a contradiction. Do not confuse with 'Sterigenics' (a real, unrelated sterilization company).",
    legalName: null, country: "United States (claimed, no address published)", website: "https://sterigenixanalytical.com",
    accreditation: { iso17025: false, standard: null, body: null, number: null, status: "none-found", scopeCoversPeptides: null, note: "Claims to be 'ISO-17025-aligned' (not accreditation); explicitly states it is not a cGMP-registered facility. No accrediting body, number, or scope exists to verify." },
    techniques: ["HPLC, LC-MS, LAL endotoxin (all self-described, unverified)"], testsByDefault: ["Purity/identity/endotoxin (self-described)"], doesNotTestByDefault: [], verifyPortal: null,
    reputation: "Existence as a real independent lab could not be confirmed; footprint cannot be distinguished from a vendor-created credibility page. Currently used only by one vendor.",
    incidents: [], sourceUrls: ["https://sterigenixanalytical.com/"],
  },
];

const normKey = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const BY_ALIAS = new Map<string, LabProfile>();
for (const lab of LAB_REGISTRY) {
  BY_ALIAS.set(normKey(lab.displayName), lab);
  for (const a of lab.aliases) BY_ALIAS.set(normKey(a), lab);
}

/** Resolve any COA lab string to a known profile, or null if we've never vetted it. */
export function getLabProfile(rawLabName: string): LabProfile | null {
  return BY_ALIAS.get(normKey(rawLabName)) ?? null;
}

/** Canonical display name for a lab string (collapses "Janoshik" and "Janoshik Analytical"). */
export function canonicalizeLabName(rawLabName: string): string {
  return getLabProfile(rawLabName)?.displayName ?? rawLabName.trim();
}

/**
 * Does a certificate from this lab count as INDEPENDENT third-party corroboration? Only true for a
 * confirmed, real, independent lab. An unvetted lab (not in the registry) is conservatively treated
 * as NOT independent — VialGrade never vouches for a lab it has not verified.
 */
export function labCountsAsIndependent(rawLabName: string): boolean {
  const p = getLabProfile(rawLabName);
  return p ? p.independence === "independent" : false;
}
