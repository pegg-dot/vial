import { afterEach, describe, expect, it, vi } from "vitest";
import { supplierConfidence, supplierGradesReleased, supplierRows, TENTATIVE_BELOW_CERTIFICATES } from "@/lib/supplier-grades";
import type { VendorDirectoryEntry } from "@/lib/vendor-ranking";

function entry(over: Record<string, unknown> = {}, enforcement: "severe" | "caution" | null = null): VendorDirectoryEntry {
  return {
    vendor: {
      slug: "acme", name: "Acme", kind: "storefront", coaCount: 5, medianPurity: 98.2, passportCount: 1, reviewCount: 9,
      latestTestedAt: "2026-09-01T00:00:00Z", grade: { letter: "B", band: "good", headline: "Mostly consistent", rationale: "r", summary: "s", weighed: 5, verifiedCount: 5, gradedAt: "2026-09-02" },
      ...over,
    } as never,
    priceIndex: -30, pricedListings: 12, enforcement, defunct: false, integrityFlagged: false, reviewSentiment: "scam",
    verdict: "avoid" as never, redFlag: true,
  };
}

describe("supplier lens", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless the flag is exactly true", () => {
    expect(supplierGradesReleased("")).toBe(false);
    expect(supplierGradesReleased("1")).toBe(false);
    expect(supplierGradesReleased("TRUE")).toBe(false);
    expect(supplierGradesReleased("true")).toBe(true);
  });

  it("reads the deployment environment by default, whatever the machine running the tests has set", () => {
    vi.stubEnv("VIALGRADE_SUPPLIER_GRADES", "true");
    expect(supplierGradesReleased()).toBe(true);
    vi.stubEnv("VIALGRADE_SUPPLIER_GRADES", "");
    expect(supplierGradesReleased()).toBe(false);
  });

  it("marks thin evidence tentative and no evidence unrated", () => {
    expect(supplierConfidence(0, "B")).toBe("unrated");
    expect(supplierConfidence(5, null)).toBe("unrated");
    expect(supplierConfidence(TENTATIVE_BELOW_CERTIFICATES - 1, "B")).toBe("tentative");
    expect(supplierConfidence(TENTATIVE_BELOW_CERTIFICATES, "B")).toBe("established");
  });

  it("carries evidence fields only: no price, reviews, sentiment or verdict reach the view", () => {
    const [row] = supplierRows([entry()]);
    expect(Object.keys(row).sort()).toEqual([
      "certificates", "confidence", "enforcement", "gradedAt", "headline", "integrityFlagged",
      "kind", "latestTestedAt", "letter", "medianPurity", "name", "passports", "slug",
    ]);
    expect(JSON.stringify(row)).not.toMatch(/price|review|sentiment|verdict|avoid|scam|url|href/i);
  });

  it("orders by certificates then name and keeps ungraded rows unrated", () => {
    const rows = supplierRows([
      entry({ slug: "b", name: "B", coaCount: 2 }), entry({ slug: "a", name: "A", coaCount: 2 }),
      entry({ slug: "c", name: "C", coaCount: 9, grade: null }),
    ]);
    expect(rows.map(r => r.name)).toEqual(["C", "A", "B"]);
    expect(rows[0].confidence).toBe("unrated");
    expect(rows[0].headline).toBe("Not graded yet");
  });
});
