import { describe, expect, it } from "vitest";
import { extractDomain, looksLikeCoaCode, findKnownVendor, vendorVerdict } from "@/server/verify";
import { composeVerdict, type VerdictInput } from "@/server/verify/trust-graph";
import { normalizeReviewVolume, normalizeReviewConfidence } from "@/server/verify/vendor-reviews";
import { sentimentOf } from "@/server/ingest/reddit";

// A vendor with nothing on record — every seam empty. The base against which each seam is toggled.
const EMPTY: VerdictInput = {
  vendorName: "Test Vendor", coaCount: 0, medianPurity: null, blindCount: 0,
  enforcement: [], reputationDimensions: [], aggregators: [], signals: null,
  review: null, community: null, links: [], status: null, flagCount: 0,
};

describe("verify — query classification", () => {
  it("extracts domains from raw input and URLs", () => {
    expect(extractDomain("bluumpeptides.com")).toBe("bluumpeptides.com");
    expect(extractDomain("https://www.eternalpeptides.com/product/x")).toBe("eternalpeptides.com");
    expect(extractDomain("BPC-157")).toBeNull();
    expect(extractDomain("just some words")).toBeNull();
  });
  it("recognizes Janoshik COA codes", () => {
    expect(looksLikeCoaCode("F8IKXANLGX1R")).toBe(true);
    expect(looksLikeCoaCode("bpc-157")).toBe(false);
    expect(looksLikeCoaCode("short")).toBe(false);
  });
});

describe("verify — the critical scam-detection behavior", () => {
  it("returns AVOID for known defunct/scam vendors (the coverage-gap fix)", () => {
    const ps = findKnownVendor("Peptide Sciences", null);
    expect(ps).not.toBeNull();
    expect(vendorVerdict(ps!).verdict).toBe("avoid");

    const aa = findKnownVendor("aminoasylum.com", "aminoasylum.com");
    expect(aa).not.toBeNull();
    expect(vendorVerdict(aa!).verdict).toBe("avoid");
    expect(vendorVerdict(aa!).link).toBeUndefined(); // never links a buyer to a scam
  });

  it("returns TRUSTED for a well-regarded vendor, matched by name or domain", () => {
    const byDomain = findKnownVendor("bluumpeptides.com", "bluumpeptides.com");
    expect(byDomain?.slug).toBe("bluum-peptides");
    expect(vendorVerdict(byDomain!).verdict).toBe("trusted");

    const byName = findKnownVendor("Ascension Peptides", null);
    expect(vendorVerdict(byName!).verdict).toBe("trusted");
  });
});

describe("trust graph — composeVerdict folds every seam into ONE verdict (no black-box score)", () => {
  it("an empty record is unproven, not safe — unknown is a loud answer", () => {
    const r = composeVerdict(EMPTY);
    expect(r.verdict).toBe("unproven");
    // Even with nothing on record, it names the empty seams (enforcement + testing) as factors.
    expect(r.factors.some((f) => f.label === "Government enforcement" && f.ok === true)).toBe(true);
    expect(r.factors.some((f) => f.label === "Independent testing" && f.ok === false)).toBe(true);
  });

  it("severe enforcement OR well-supported buyer scam reports force AVOID and outrank everything else", () => {
    expect(composeVerdict({ ...EMPTY, enforcement: [{ severity: "severe" }] }).verdict).toBe("avoid");
    // A scam sentiment backed by real volume + confidence forces avoid.
    expect(composeVerdict({ ...EMPTY, review: { sentiment: "scam", reviewVolume: "heavy", confidence: "high" } }).verdict).toBe("avoid");
    // Real testing evidence does NOT launder a proven enforcement action.
    const withTests = composeVerdict({ ...EMPTY, coaCount: 5, medianPurity: 99, enforcement: [{ severity: "severe" }] });
    expect(withTests.verdict).toBe("avoid");
  });

  it("a THIN negative review does not single-handedly force AVOID — it's caution, and confidence gates the difference", () => {
    // One low-confidence, sparse scam report must not nuke an otherwise-clean vendor. (The confidently-
    // wrong bug: a single sketchy review used to force "avoid".) Fails toward caution, not avoid.
    const thin = composeVerdict({ ...EMPTY, review: { sentiment: "scam", reviewVolume: "sparse", confidence: "low" } });
    expect(thin.verdict).toBe("caution");
    expect(thin.verdict).not.toBe("avoid");
    // Missing volume/confidence (unknown provenance) is treated as NOT well-supported → caution, not avoid.
    expect(composeVerdict({ ...EMPTY, review: { sentiment: "scam" } }).verdict).toBe("caution");
    // But high confidence alone is enough to escalate a sparse report to avoid.
    expect(composeVerdict({ ...EMPTY, review: { sentiment: "negative", reviewVolume: "sparse", confidence: "high" } }).verdict).toBe("avoid");
    // A thin POSITIVE symmetrically does not inflate to "trusted" on its own.
    const thinPos = composeVerdict({ ...EMPTY, review: { sentiment: "positive", reviewVolume: "sparse", confidence: "low" } });
    expect(thinPos.verdict).not.toBe("trusted");
  });

  it("a gatherer typo in volume/confidence can't silently disable the scam gate (fail-safe normalization)", () => {
    // "high" is not a canonical volume enum member, but it plainly means heavy — it must still count
    // as well-supported, or a scam vendor with a typo'd volume would never be flagged.
    expect(composeVerdict({ ...EMPTY, review: { sentiment: "scam", reviewVolume: "high" } }).verdict).toBe("avoid");
    expect(composeVerdict({ ...EMPTY, review: { sentiment: "scam", confidence: "strong" } }).verdict).toBe("avoid");
    // "low" volume normalizes to sparse → still just caution.
    expect(composeVerdict({ ...EMPTY, review: { sentiment: "scam", reviewVolume: "low", confidence: "low" } }).verdict).toBe("caution");
  });

  it("review volume/confidence normalizers map synonyms and reject the unknown", () => {
    expect(normalizeReviewVolume("high")).toBe("heavy");
    expect(normalizeReviewVolume("low")).toBe("sparse");
    expect(normalizeReviewVolume("MODERATE")).toBe("moderate");
    expect(normalizeReviewVolume("heavy")).toBe("heavy");
    expect(normalizeReviewVolume("banana")).toBeNull();
    expect(normalizeReviewConfidence("strong")).toBe("high");
    expect(normalizeReviewConfidence("med")).toBe("medium");
    expect(normalizeReviewConfidence(undefined)).toBeNull();
  });

  it("open_risk_flags semantics: 'established' means NONE on record (good), 'disputed' means flags present (bad)", () => {
    // The bug this locks in: an established/None-on-record dimension must NOT read as a red flag.
    const clean = composeVerdict({ ...EMPTY, coaCount: 2,
      reputationDimensions: [{ key: "open_risk_flags", status: "established", value: "None on record" }] });
    expect(clean.factors.some((f) => f.label === "Scam & red flags")).toBe(false);
    expect(clean.verdict).not.toBe("avoid");
    expect(clean.verdict).not.toBe("caution");

    const flagged = composeVerdict({ ...EMPTY,
      reputationDimensions: [{ key: "open_risk_flags", status: "disputed", value: "1 enforcement record" }] });
    expect(flagged.factors.some((f) => f.label === "Scam & red flags" && f.ok === false)).toBe(true);
    expect(flagged.verdict).toBe("caution");
  });

  it("only evidence_corroboration carries 'conflicting evidence' — mixed community sentiment does not", () => {
    // community_signal 'disputed' (mixed reviews) must not be mislabeled as evidence conflicting with itself.
    const mixedCommunity = composeVerdict({ ...EMPTY, coaCount: 2,
      reputationDimensions: [{ key: "community_signal", status: "disputed", value: "Mixed reports" }] });
    expect(mixedCommunity.factors.some((f) => f.label === "Conflicting evidence")).toBe(false);

    const realConflict = composeVerdict({ ...EMPTY, coaCount: 2,
      reputationDimensions: [{ key: "evidence_corroboration", status: "disputed", value: "2 tests · 1 open conflict" }] });
    expect(realConflict.factors.some((f) => f.label === "Conflicting evidence")).toBe(true);
    expect(realConflict.verdict).toBe("caution");
  });

  it("every factor carries a reliability tier, and verifiedCount counts only document/record-backed ones", () => {
    // A regex read off a storefront must NOT render like a public FDA conviction.
    const r = composeVerdict({ ...EMPTY, enforcement: [{ severity: "severe" }],
      signals: { domain_age_note: "~3 months old, VERY YOUNG", research_disclaimer: true, notable_copy: "back online after downtime", payment_methods: [] } });
    const enforcement = r.factors.find((f) => f.label === "Government enforcement");
    const storefront = r.factors.find((f) => f.label === "Storefront signal");
    expect(enforcement?.confidence).toBe("verified");
    expect(storefront?.confidence).toBe("inferred");
    // verifiedCount ⊆ weighed, and never counts an inferred/reported signal.
    expect(r.verifiedCount).toBe(r.factors.filter((f) => f.confidence === "verified").length);
    expect(r.verifiedCount).toBeLessThanOrEqual(r.weighed);
  });

  it("community: a lone mention can't force avoid — pinned to what the real writer (sentimentOf) actually emits", () => {
    // The protection is a REAL coupling, not a fabricated fixture: the gather resolves a single
    // negative mention to "mixed", which composeVerdict's community seam ignores entirely.
    expect(sentimentOf(1, 1, 0)).toBe("mixed");             // one negative post → mixed, not negative
    const lone = composeVerdict({ ...EMPTY, community: { sentiment: sentimentOf(1, 1, 0), mentionCount: 1, negativeCount: 1 } });
    expect(lone.factors.find((f) => f.label === "Community")).toBeUndefined(); // no community factor at all
    expect(lone.verdict).not.toBe("avoid");

    // The writer only emits "negative" at neg>=2, which the gate treats as well-supported → avoid.
    expect(sentimentOf(5, 3, 0)).toBe("negative");
    const corroborated = composeVerdict({ ...EMPTY, community: { sentiment: sentimentOf(5, 3, 0), mentionCount: 5, negativeCount: 3 } });
    expect(corroborated.verdict).toBe("avoid");
    // The community factor is a third-party account → "reported" tier, never "verified".
    expect(corroborated.factors.find((f) => f.label === "Community")?.confidence).toBe("reported");
  });

  it("an ABSENCE of a record is not counted as verified — no green 'Verified' chip on a gap", () => {
    const r = composeVerdict(EMPTY);
    // The two absence factors (no enforcement, no lab tests) must not claim a document backs them.
    expect(r.factors.find((f) => f.label === "Independent testing")?.confidence).toBeUndefined();
    expect(r.factors.find((f) => f.label === "Government enforcement")?.confidence).toBeUndefined();
    expect(r.verifiedCount).toBe(0);
  });

  it("real independent testing + corroboration earns TRUSTED, and counts the weighed signals", () => {
    const r = composeVerdict({ ...EMPTY, coaCount: 3, medianPurity: 99.2, blindCount: 1,
      reputationDimensions: [{ key: "evidence_corroboration", status: "established", value: "3 tests" }] });
    expect(r.verdict).toBe("trusted");
    expect(r.weighed).toBe(r.factors.length);
    expect(r.weighed).toBeGreaterThanOrEqual(2);
  });
});

// Calibrating the operational signals, measured rather than guessed.
//
// Turning domain-age collection on showed what the signal actually does: of 35 vendors with a
// young domain, only THREE were real storefronts. The other 26 were zero-listing manufacturers
// who would be dragged out of the reference band and handed a buyer-facing C+ — re-breaking the
// exact thing the reference band was added to fix — plus 6 already carrying real warnings.
//
// A young domain is `inferred`: nobody looked at this vendor, a registry date was read. The
// avoid/high-risk branch already refuses to publish a letter on inference alone, saying so in as
// many words. The same argument holds one band up. So one inferred operational concern is
// CONTEXT — recorded, shown, not a verdict. Two or more co-occurring is a pattern, and counts.
describe("trust graph — inferred operational signals are context until they corroborate", () => {
  const withSignals = (over: Partial<NonNullable<VerdictInput["signals"]>>): VerdictInput => ({
    ...EMPTY,
    coaCount: 4,
    signals: { domain_age_note: null, research_disclaimer: null, notable_copy: null, payment_methods: [], ...over },
  });

  const YOUNG = "Domain registered 2025-11-29 (~9 months old) — VERY YOUNG, a notable risk signal";

  it("records a young domain as a factor without making the verdict caution", () => {
    const r = composeVerdict(withSignals({ domain_age_note: YOUNG }));
    expect(r.factors.some((f) => f.label === "Domain age")).toBe(true);
    expect(r.verdict).toBe("trusted");
  });

  it("treats two co-occurring operational concerns as a pattern worth caution", () => {
    const r = composeVerdict(withSignals({ domain_age_note: YOUNG, notable_copy: "back online after downtime — RISK" }));
    expect(r.verdict).toBe("caution");
    expect(r.summary).toContain("young domain");
  });

  // The softening applies only to inference. Anything a person or a registry actually recorded
  // still lands on its own.
  it("still cautions on a single verified concern", () => {
    const r = composeVerdict({ ...withSignals({ domain_age_note: YOUNG }), flagCount: 1 });
    expect(r.verdict).toBe("caution");
  });

  it("still avoids on a single enforcement record", () => {
    const r = composeVerdict({ ...withSignals({ domain_age_note: YOUNG }), enforcement: [{ severity: "severe" }] });
    expect(r.verdict).toBe("avoid");
  });

  it("leaves a vendor with no operational signals exactly as it was", () => {
    expect(composeVerdict({ ...EMPTY, coaCount: 4 }).verdict).toBe("trusted");
  });
});

// Underdosing is the fraud this market actually runs on, and the codebase already knows how to
// measure it: content-check.ts compares the lab's measured mg against the label and has done since
// it was written. It had exactly one consumer — a table cell in lab-tests-panel.tsx — computed at
// render and thrown away.
//
// Meanwhile the trust graph counts certificates. `coaCount > 0` emits a VERIFIED POSITIVE and
// pushes a trust reason, without ever asking what those certificates say. So ten certificates each
// documenting 8 mg in a 10 mg vial read as ten pieces of evidence that a vendor is trustworthy, and
// on the count ladder that is an A. The evidence of the defect was raising the grade.
//
// Measured against this corpus: of 115 dose-comparable records, 4 are underdosed (3.5%) while only
// 1 of 251 purity-scored records falls below 95% (0.4%). Underdosing is roughly nine times more
// common here than a purity failure, and it was the one axis that could not reach a verdict.
describe("trust graph — a certificate that documents a short fill is not evidence of trust", () => {
  const tested = (over = {}) => ({ ...EMPTY, coaCount: 6, medianPurity: 99.2, ...over });

  it("stays trusted when the doses check out", () => {
    expect(composeVerdict(tested({ underdosedCount: 0 })).verdict).toBe("trusted");
  });

  it("cautions when a lab measured a short fill", () => {
    const r = composeVerdict(tested({ underdosedCount: 1 }));
    expect(r.verdict).toBe("caution");
    expect(r.summary).toMatch(/dose|underdos/i);
  });

  // A lab measurement is the strongest tier the product has. It must not be filed as inference,
  // or the inferred-only guards would discard it.
  it("records the short fill as a verified finding", () => {
    const f = composeVerdict(tested({ underdosedCount: 2 })).factors.find((x) => /dose/i.test(x.label));
    expect(f).toBeDefined();
    expect(f?.ok).toBe(false);
    expect(f?.confidence).toBe("verified");
  });

  // Vials run generous all the time. Getting more than you paid for is not a warning.
  it("says nothing about a generous fill", () => {
    expect(composeVerdict(tested({ underdosedCount: 0, overfilledCount: 3 })).verdict).toBe("trusted");
  });

  it("is silent when no certificate reported a comparable dose", () => {
    const r = composeVerdict(tested({ underdosedCount: 0 }));
    expect(r.factors.some((x) => /dose/i.test(x.label))).toBe(false);
  });
});

// The harshest verdict the product has must not rest on a probe timeout.
//
// Site status is `inferred` by construction — grade.ts calls it "a SINGLE unretried HTTP probe that
// calls a vendor 'offline' on any timeout or 404" — and it was pushing straight to `avoid`. That was
// survivable only while `adverseIsInferredOnly` caught it, which needs it to be the ONLY adverse
// tier. The moment dose accuracy added a verified negative, three real manufacturers were about to
// be published as "F — avoid ... this rests on a dead storefront", alongside Paradigm Peptides,
// whose F rests on a proven enforcement action and a recorded guilty plea. Those are not the same
// claim and must not carry the same letter.
//
// A storefront that is genuinely gone still reaches `avoid` — through scam reports, an enforcement
// record, or a hard link to a flagged operator. It just cannot get there on one failed request.
describe("trust graph — an unretried probe is not grounds for the harshest verdict", () => {
  const withStatus = (status: string, over = {}) => ({ ...EMPTY, coaCount: 3, status: { status }, ...over });

  it("cautions rather than condemns when a storefront looks offline", () => {
    const r = composeVerdict(withStatus("offline"));
    expect(r.verdict).toBe("caution");
    expect(r.factors.some((f) => f.label === "Site status" && f.ok === false)).toBe(true);
  });

  it("treats a parked domain the same way", () => {
    expect(composeVerdict(withStatus("parked")).verdict).toBe("caution");
  });

  it("still reaches avoid when something substantiated says so", () => {
    expect(composeVerdict(withStatus("offline", { enforcement: [{ severity: "severe" }] })).verdict).toBe("avoid");
  });

  it("leaves an operating storefront alone", () => {
    const r = composeVerdict(withStatus("operating"));
    expect(r.factors.some((f) => f.label === "Site status")).toBe(false);
    expect(r.verdict).toBe("trusted");
  });
});
