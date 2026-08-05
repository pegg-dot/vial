import { describe, expect, it } from "vitest";
import { assessVendorRisk } from "@/server/vendors/directory";

// The directory's redFlag is now exactly "the composed verdict is avoid" — the SAME verdict the
// vendor page and /verify show. These cases are the concrete divergences the old ad-hoc gate had.
const V = { name: "Test Vendor", coaCount: 0, medianPurity: null };
const CLEAN = { enforcement: [] as Array<{ severity: string }>, reviewSentiment: null as string | null, reviewVolume: null as string | null, reviewConfidence: null as string | null, communitySentiment: null as string | null, communityMentionCount: null as number | null, communityNegativeCount: null as number | null, links: [] as Array<{ strength: string; linkedSlug: string }>, status: "operating", integrityFlagged: false };
const risk = (over: Partial<typeof CLEAN>) => assessVendorRisk(V, { ...CLEAN, ...over });

describe("assessVendorRisk (directory redFlag == vendor-page verdict avoid)", () => {
  it("a trusted vendor is not flagged", () => {
    const r = assessVendorRisk({ name: "Good", coaCount: 5, medianPurity: 99 }, { ...CLEAN, reviewSentiment: "positive" });
    expect(r.verdict).toBe("trusted");
    expect(r.redFlag).toBe(false);
  });

  it("severe enforcement → avoid (flagged)", () => {
    expect(risk({ enforcement: [{ severity: "severe" }] })).toEqual({ verdict: "avoid", redFlag: true });
  });

  it("caution-level enforcement alone → caution, NOT flagged", () => {
    const r = risk({ enforcement: [{ severity: "caution" }] });
    expect(r.verdict).toBe("caution");
    expect(r.redFlag).toBe(false);
  });

  it("a well-supported negative review → avoid; a thin/low-confidence one is only caution (not flagged)", () => {
    expect(risk({ reviewSentiment: "negative", reviewVolume: "moderate", reviewConfidence: "high" })).toEqual({ verdict: "avoid", redFlag: true });
    // A lone low-confidence negative must NOT red-flag a vendor — fail toward caution, not avoid.
    const thin = risk({ reviewSentiment: "negative", reviewVolume: "sparse", reviewConfidence: "low" });
    expect(thin.verdict).toBe("caution");
    expect(thin.redFlag).toBe(false);
  });

  it("a well-supported scam review → avoid", () => {
    expect(risk({ reviewSentiment: "scam", reviewVolume: "heavy", reviewConfidence: "high" }).redFlag).toBe(true);
  });

  it("a COA integrity flag alone → caution, NOT flagged — the old gate wrongly sank these", () => {
    const r = risk({ integrityFlagged: true });
    expect(r.verdict).toBe("caution");
    expect(r.redFlag).toBe(false);
  });

  it("a blocked (bot-protection) status is ignored — the old gate sank it as 'defunct'", () => {
    const r = risk({ status: "blocked" });
    expect(r.redFlag).toBe(false);
    expect(r.verdict).not.toBe("avoid");
  });

  it("a genuinely dead storefront (offline/parked) → avoid", () => {
    expect(risk({ status: "offline" }).redFlag).toBe(true);
    expect(risk({ status: "parked" }).redFlag).toBe(true);
  });

  it("a redirected storefront → caution, not flagged", () => {
    const r = risk({ status: "redirected" });
    expect(r.verdict).toBe("caution");
    expect(r.redFlag).toBe(false);
  });

  it("a CORROBORATED community negative → avoid; a lone mention is only caution", () => {
    expect(risk({ communitySentiment: "negative", communityMentionCount: 4, communityNegativeCount: 2 })).toEqual({ verdict: "avoid", redFlag: true });
    // One thin community mention must not red-flag a vendor — same fail-toward-caution as reviews.
    const thin = risk({ communitySentiment: "negative", communityMentionCount: 1, communityNegativeCount: 1 });
    expect(thin.verdict).toBe("caution");
    expect(thin.redFlag).toBe(false);
  });

  it("a strong operator-network link to a flagged storefront → avoid", () => {
    expect(risk({ links: [{ strength: "strong", linkedSlug: "paradigm-peptides" }] }).redFlag).toBe(true);
  });
});
