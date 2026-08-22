// The trust graph — VialGrade's compounding core. Every data seam we hold about a vendor is folded into
// ONE composed verdict here, via transparent rules (never a black-box score, per the doctrine). The
// verdict shows exactly which seams it's built from, each traceable to its source. Adding a new seam
// means adding one case here — and every verdict across the app gets sharper for free.
import type { Verdict, Signal } from "./index";
import { findKnownVendorBySlug } from "./index";
import { YOUNG_DOMAIN_RE } from "@/server/collect/domain-age";
import { checkContent } from "./content-check";
import { getVendorBySlug } from "@/server/catalog/repository";
import { getVendorReputationBySlug } from "@/server/reputation/repository";
import { getVendorRegulatoryActions } from "@/server/regulatory/repository";
import { getStoredCommunitySignal } from "@/server/ingest/reddit";
import { getLabTestsForVendor } from "@/server/ingest/lab-tests";
import { getVendorFlags } from "@/server/verify/coa-integrity";
import { getVendorLinks } from "@/server/verify/vendor-linkage";
import { getVendorReview, normalizeReviewVolume, normalizeReviewConfidence } from "@/server/verify/vendor-reviews";
import { getVendorStatus } from "@/server/verify/vendor-status";
import { getVendorAggregatorRatings, getVendorSignals } from "@/server/external/repository";
import { getDatabase } from "@/server/db/client";

export interface VerdictInput {
  vendorName: string;
  coaCount: number;
  medianPurity: number | null;
  blindCount: number;
  /** Certificates whose measured content fell short of the label. See content-check.ts. */
  underdosedCount?: number;
  /** Generous fills. Counted so the seam can say "we looked", never treated as a concern. */
  overfilledCount?: number;
  enforcement: Array<{ severity: string }>;
  reputationDimensions: Array<{ key: string; status: string; value: string }>;
  aggregators: Array<{ source: string; score: number | null; max_score: number | null }>;
  signals: { domain_age_note: string | null; research_disclaimer: boolean | null; notable_copy: string | null; payment_methods: unknown } | null;
  review: { sentiment: string; reviewVolume?: string; confidence?: string } | null;
  community: { classification?: string | null; sentiment?: string | null; mentionCount?: number | null; negativeCount?: number | null; positiveCount?: number | null } | null;
  links: Array<{ strength: string; linkedSlug: string }>;
  status: { status: string } | null;
  flagCount: number;
}

export interface ComposedVerdict {
  verdict: Verdict;
  headline: string;
  summary: string;
  factors: Signal[];
  weighed: number; // how many seams contributed evidence — the "diversity" the verdict rests on
  verifiedCount: number; // of those, how many are document/record/hard-identifier backed (not a guess)
}

const ALT_RAILS = new Set(["crypto", "zelle", "venmo", "cashapp", "bitcoin", "btc", "gift-certificate"]);

// Compose the whole trust picture. Pure — callers pass the seams they already loaded.
export function composeVerdict(v: VerdictInput): ComposedVerdict {
  const factors: Signal[] = [];
  const reasons: { avoid: string[]; caution: string[]; trust: string[] } = { avoid: [], caution: [], trust: [] };

  // 1. Enforcement / regulatory — the strongest, safest signal (public government records).
  const severe = v.enforcement.filter((a) => a.severity === "severe").length;
  const cautionActions = v.enforcement.filter((a) => a.severity === "caution").length;
  if (severe > 0) { factors.push({ ok: false, label: "Government enforcement", detail: `On a public enforcement record — ${severe} proven-severe action${severe === 1 ? "" : "s"} (FDA/DOJ/FTC).`, confidence: "verified" }); reasons.avoid.push("a proven enforcement action"); }
  else if (cautionActions > 0) { factors.push({ ok: false, label: "Government enforcement", detail: `Named in ${cautionActions} public regulatory record${cautionActions === 1 ? "" : "s"} (e.g. an FDA warning letter).`, confidence: "verified" }); reasons.caution.push("a public regulatory record"); }
  // An ABSENCE of a record is not itself verified evidence — leave it untagged so it earns no
  // "Verified" chip and isn't counted as an independently-verified signal (that would oversell a gap).
  else factors.push({ ok: true, label: "Government enforcement", detail: "No FDA/DOJ/FTC enforcement or recall record on file." });

  // 2. Independent lab testing — the core physical-evidence seam.
  if (v.coaCount > 0) {
    const bits = [`${v.coaCount} independent lab test${v.coaCount === 1 ? "" : "s"} on record`];
    if (v.medianPurity != null) bits.push(`median ${v.medianPurity.toFixed(1)}%`);
    if (v.blindCount > 0) bits.push(`${v.blindCount} blind`);
    factors.push({ ok: true, label: "Independent testing", detail: `${bits.join(" · ")}.`, confidence: "verified" });
    reasons.trust.push(`${v.coaCount} independent lab test${v.coaCount === 1 ? "" : "s"}${v.blindCount > 0 ? " (incl. blind purchases)" : ""}`);
  } else factors.push({ ok: false, label: "Independent testing", detail: "No third-party lab tests on record for this vendor." }); // absence, not a verified record — untagged

  // 2b. Dose accuracy — what those certificates actually SAY, not how many there are.
  //
  // A vial can be 99% pure, the right molecule, and still be 7 mg where the label says 10. That is
  // the fraud this market runs on, and until now it could not reach a verdict: content-check.ts
  // measured it and only ever drew a table cell, while the seam above counted the same certificate
  // as a verified positive. Ten certificates documenting a short fill read as ten reasons to trust
  // the vendor. The evidence of the defect was raising the grade.
  //
  // A lab measurement is the strongest evidence this product holds, so it is tagged `verified` —
  // the inferred-only guards must not discard it. An overfill is not a concern: vials run generous
  // and getting more than you paid for is not a warning.
  const underdosed = v.underdosedCount ?? 0;
  if (underdosed > 0) {
    factors.push({
      ok: false,
      label: "Dose accuracy",
      detail: `${underdosed} independent certificate${underdosed === 1 ? "" : "s"} measured LESS peptide than the label claims.`,
      confidence: "verified",
    });
    reasons.caution.push(`${underdosed} certificate${underdosed === 1 ? "" : "s"} showing an underdosed vial`);
  }

  // 3. Reputation dimensions — the composed-but-not-scored reputation record.
  // NOTE on semantics (easy to get backwards): a dimension's status "established" means the
  // reputation record has SETTLED that dimension, not that something bad is settled. For
  // open_risk_flags, "established" = "None on record" (no flags) and "disputed" = flags present.
  const riskDim = v.reputationDimensions.find((d) => d.key === "open_risk_flags");
  const hasRiskFlags = riskDim?.status === "disputed"; // disputed here = genuine adverse findings on record
  // Only the evidence-corroboration dimension carries "the lab evidence conflicts with itself"
  // (open review-queue conflicts). Do NOT treat community_signal's "disputed" (= mixed/negative
  // buyer sentiment) as conflicting evidence — that's handled by the review/community seams below.
  const corrDim = v.reputationDimensions.find((d) => d.key === "evidence_corroboration");
  const evidenceConflict = corrDim?.status === "disputed";
  if (hasRiskFlags) { factors.push({ ok: false, label: "Scam & red flags", detail: riskDim!.value, confidence: "reported" }); reasons.caution.push("open risk flags in its reputation record"); }
  if (evidenceConflict) { factors.push({ ok: null, label: "Conflicting evidence", detail: `Independent evidence for this vendor conflicts with itself (${corrDim!.value}) — a genuine reason for caution.`, confidence: "verified" }); reasons.caution.push("independent evidence that conflicts with itself"); }
  if (corrDim?.status === "established" && !hasRiskFlags) reasons.trust.push("independently corroborated evidence");

  // 4. Third-party aggregators — outside opinions, shown as their own.
  const scored = v.aggregators.filter((a) => a.score != null && a.max_score != null);
  if (scored.length > 0) {
    const best = scored.map((a) => `${a.source} ${Number(a.score)}/${Number(a.max_score)}`).join(", ");
    const anyGood = scored.some((a) => Number(a.score) / Number(a.max_score!) >= 0.75);
    const anyBad = scored.some((a) => Number(a.score) / Number(a.max_score!) < 0.4);
    factors.push({ ok: anyGood ? true : anyBad ? false : null, label: "Third-party trackers", detail: `${best} (their opinion, not ours).`, confidence: "reported" });
    if (anyGood) reasons.trust.push("high scores from independent trackers");
    if (anyBad) reasons.caution.push("a low score from an independent tracker");
  }

  // 5. Operational signals — read from the vendor's own storefront.
  if (v.signals) {
    const young = YOUNG_DOMAIN_RE.test(v.signals.domain_age_note ?? "");
    const methods = Array.isArray(v.signals.payment_methods) ? (v.signals.payment_methods as string[]) : [];
    const altOnly = methods.length > 0 && methods.every((m) => ALT_RAILS.has(m.toLowerCase()));
    const noRuo = v.signals.research_disclaimer === false;
    const riskCopy = /RISK|workaround|back online|downtime/i.test(v.signals.notable_copy ?? "");
    // These three are all `inferred` — nobody examined this vendor, a registry date and some page
    // copy were read. Each is recorded as a factor either way, so the Business-signals dimension
    // fills and a buyer can see it. What changed is when one becomes a VERDICT.
    //
    // Measured, not assumed: of 35 tracked vendors with a young domain, three were real
    // storefronts. Twenty-six were zero-listing manufacturers who would have been pulled out of
    // the reference band and handed a buyer-facing C+ for the sole offence of being new — which
    // is the scale inversion the reference band exists to prevent. The avoid/high-risk branch
    // already declines to publish a letter on inference alone and says why; the same reasoning
    // holds a band up. One inferred concern is context. Two that co-occur is a pattern.
    const operational: string[] = [];
    if (young) { factors.push({ ok: false, label: "Domain age", detail: v.signals.domain_age_note ?? "Recently registered domain.", confidence: "inferred" }); operational.push("a very young domain"); }
    if (riskCopy) { factors.push({ ok: false, label: "Storefront signal", detail: v.signals.notable_copy ?? "", confidence: "inferred" }); operational.push("a risk signal on its own storefront"); }
    if (altOnly && v.coaCount === 0) operational.push("alternative-only payment rails with no test record");
    if (operational.length >= 2) reasons.caution.push(...operational);
    if (noRuo) factors.push({ ok: null, label: "Research-use notice", detail: "No research-use-only disclaimer found on the homepage.", confidence: "inferred" });
  }

  // 6. Buyer reputation (gathered reviews). Weigh the signal by how well-supported it is, never by
  // sentiment alone. A negative verdict only ENDS in "avoid" when it's well-supported — high
  // confidence, or real volume. A lone, low-confidence report is a reason for CAUTION, not a
  // verdict-ending "avoid": fail toward unknown, don't let one sketchy review nuke an otherwise-clean
  // vendor. Symmetrically, a thin positive doesn't get to inflate trust.
  if (v.review) {
    const s = v.review.sentiment;
    // Normalize free-text volume/confidence to the canonical enum so a gatherer typo can't silently
    // disable the gate (an out-of-enum value like "high" volume must not read as not-well-supported).
    const vol = normalizeReviewVolume(v.review.reviewVolume);
    const conf = normalizeReviewConfidence(v.review.confidence);
    const wellSupported = conf === "high" || vol === "moderate" || vol === "heavy";
    const thin = wellSupported ? "" : " — but from limited or low-confidence reports, so we weigh it lightly";
    if (s === "scam" || s === "negative") {
      factors.push({ ok: false, label: "Buyer reviews", detail: (s === "scam" ? "Buyers report scam/fraud" : "Reviews are mostly negative") + thin + ".", confidence: "reported" });
      if (wellSupported) reasons.avoid.push("well-supported buyer scam/fraud reports");
      else reasons.caution.push("some negative buyer reports (limited or low-confidence)");
    } else if (s === "mixed") {
      factors.push({ ok: null, label: "Buyer reviews", detail: "Mixed reports from buyers.", confidence: "reported" });
      reasons.caution.push("mixed buyer reports");
    } else if (s === "positive") {
      factors.push({ ok: true, label: "Buyer reviews", detail: "Mostly positive buyer reports" + thin + ".", confidence: "reported" });
      if (wellSupported) reasons.trust.push("mostly-positive buyer reports");
    }
  }

  // 7. Community (r/Peptides) signal — weighed by mention volume, exactly like the review seam: one
  // thin mention can't force "avoid" (that's the confidently-wrong pattern — a stranger's single post
  // shouldn't nuke a vendor). It's caution until corroborated. Counts are already in hand from the
  // gather; use them instead of asserting on bare sentiment.
  if (v.community) {
    const c = (v.community.classification ?? v.community.sentiment ?? "").toLowerCase();
    const neg = v.community.negativeCount ?? 0;
    const pos = v.community.positiveCount ?? 0;
    const mentions = v.community.mentionCount ?? 0;
    if (/scam|negative|fraud/.test(c)) {
      const wellSupported = neg >= 2 || (mentions >= 3 && neg >= 1);
      factors.push({ ok: false, label: "Community", detail: wellSupported ? "Community reports lean toward scam/quality complaints." : "A community mention flags a possible problem — thin so far; read it before you buy.", confidence: "reported" });
      if (wellSupported) reasons.avoid.push("corroborated community scam reports");
      else reasons.caution.push("an unconfirmed community complaint");
    } else if (/vouch|positive|trust/.test(c)) {
      factors.push({ ok: true, label: "Community", detail: "Community mentions lean positive.", confidence: "reported" });
      if (pos >= 2) reasons.trust.push("positive community mentions");
    }
  }

  // 8. Operator-network linkage — shared HARD identifiers with a flagged storefront.
  const scamLink = v.links.find((l) => l.strength === "strong" && findKnownVendorBySlug(l.linkedSlug)?.redFlag);
  if (scamLink) { factors.push({ ok: false, label: "Operator network", detail: `Shares hard identifiers with ${findKnownVendorBySlug(scamLink.linkedSlug)?.name ?? scamLink.linkedSlug}, a flagged storefront.`, confidence: "verified" }); reasons.avoid.push("shared identifiers with a flagged storefront"); }

  // 9. Site status — a single unretried probe, so it's the lowest-confidence seam. It still names the
  // problem (and a genuinely dead store is a real reason to avoid), but the tier marks it as inferred.
  if (v.status && v.status.status !== "operating" && v.status.status !== "unknown" && v.status.status !== "blocked") {
    const dead = v.status.status === "offline" || v.status.status === "parked";
    factors.push({ ok: false, label: "Site status", detail: dead ? "Their storefront is offline or parked." : "Their storefront redirects away.", confidence: "inferred" });
    if (dead) reasons.avoid.push("a dead storefront"); else reasons.caution.push("a redirecting storefront");
  }

  // 10. COA integrity flags (borrowed/mismatched certificates).
  if (v.flagCount > 0) { factors.push({ ok: false, label: "COA integrity", detail: `${v.flagCount} certificate-integrity flag${v.flagCount === 1 ? "" : "s"} (e.g. a cert that resolves to a different maker).`, confidence: "verified" }); reasons.caution.push("a certificate-integrity flag"); }

  // ── Decide the verdict from the collected reasons (priority: avoid > caution > trust) ──
  let verdict: Verdict;
  let headline: string;
  let summary: string;
  const weighed = factors.length;
  // How many seams are backed by a document / record / hard identifier, not a heuristic or a single
  // report — so the UI can say "N signals, M independently verified" instead of overselling all N.
  const verifiedCount = factors.filter((f) => f.confidence === "verified").length;
  if (reasons.avoid.length > 0) {
    verdict = "avoid";
    headline = `${v.vendorName} — avoid`;
    summary = `We'd steer clear: this rests on ${list(reasons.avoid)}. That outweighs anything else on the record.`;
  } else if (reasons.caution.length > 0) {
    verdict = "caution";
    headline = `${v.vendorName} — proceed with caution`;
    summary = `Worth a closer look before you buy: ${list(reasons.caution)}${reasons.trust.length ? `, though it does have ${list(reasons.trust)}` : ""}.`;
  } else if (reasons.trust.length >= 2 || (reasons.trust.length >= 1 && v.coaCount > 0)) {
    verdict = "trusted";
    headline = `${v.vendorName} — generally trusted`;
    summary = `No red flags on record, and the evidence is real: ${list(reasons.trust)}. Not an endorsement — just what the data shows.`;
  } else {
    verdict = "unproven";
    headline = `${v.vendorName} — not enough to say yet`;
    summary = `We track this vendor but hold thin evidence${v.coaCount === 0 ? " and no independent lab tests" : ""}. Unknown isn't the same as safe — check the specific listing before you buy.`;
  }

  return { verdict, headline, summary, factors, weighed, verifiedCount };
}

// Load every seam for a tracked vendor and compose — the SAME picture the vendor page builds,
// so the verify tool is exactly as rich. Returns null for a slug we don't track. This is the
// single place the app fetches "all seams for one vendor"; the page and the verify tool share it.
export async function composeVerdictForVendorSlug(
  slug: string,
): Promise<{ composed: ComposedVerdict; vendorName: string; slug: string } | null> {
  const vendor = await getVendorBySlug(slug);
  if (!vendor) return null;
  const db = await getDatabase();
  const [reputation, communitySignal, vendorLabTests, vendorFlags, vendorLinks, vendorReview, vendorStatus, enforcement, aggregatorRatings, vendorSignals] = await Promise.all([
    getVendorReputationBySlug(slug),
    getStoredCommunitySignal(db, slug),
    getLabTestsForVendor(db, slug, 24),
    getVendorFlags(db, slug),
    getVendorLinks(db, slug),
    getVendorReview(db, slug),
    getVendorStatus(db, slug),
    getVendorRegulatoryActions(slug, db),
    getVendorAggregatorRatings(slug, db),
    getVendorSignals(slug, db),
  ]);
  const composed = composeVerdict({
    vendorName: vendor.name,
    coaCount: vendor.coaCount,
    medianPurity: vendor.medianPurity,
    blindCount: vendorLabTests.filter((t) => t.is_blind).length,
    // Free — these rows are already in hand; no extra query to ask what they say.
    underdosedCount: vendorLabTests.filter((t) => checkContent(t.sample_name ?? "", t.measured_content ?? null).verdict === "underdosed").length,
    overfilledCount: vendorLabTests.filter((t) => checkContent(t.sample_name ?? "", t.measured_content ?? null).verdict === "overfilled").length,
    enforcement: enforcement.map((a) => ({ severity: a.severity })),
    reputationDimensions: reputation?.dimensions ?? [],
    aggregators: aggregatorRatings.map((a) => ({ source: a.source, score: a.score, max_score: a.max_score })),
    signals: vendorSignals,
    review: vendorReview ? { sentiment: vendorReview.sentiment, reviewVolume: vendorReview.reviewVolume, confidence: vendorReview.confidence } : null,
    community: communitySignal ? { sentiment: communitySignal.sentiment, mentionCount: communitySignal.mention_count, negativeCount: communitySignal.negative_count, positiveCount: communitySignal.positive_count } : null,
    links: vendorLinks.map((l) => ({ strength: l.strength, linkedSlug: l.linkedSlug })),
    status: vendorStatus ? { status: vendorStatus.status } : null,
    flagCount: vendorFlags.length,
  });
  return { composed, vendorName: vendor.name, slug: vendor.slug };
}

function list(items: string[]): string {
  const u = [...new Set(items)];
  if (u.length === 1) return u[0];
  if (u.length === 2) return `${u[0]} and ${u[1]}`;
  return `${u.slice(0, -1).join(", ")}, and ${u[u.length - 1]}`;
}
