import { describe, expect, it } from "vitest";
import { evidenceBadgeFor } from "@/lib/evidence-badge-derive";
import type { Product } from "@/lib/types";

const p = (over: Partial<Product>): Pick<Product, "origin" | "evidenceLevel" | "evidenceLabel" | "trust"> =>
  ({ origin: "live", evidenceLevel: "public-only", evidenceLabel: "Vendor catalog", trust: undefined, ...over } as never);

describe("evidenceBadgeFor — the badge reads the live verdict, not the frozen catalog label", () => {
  it("a live, independently-tested listing badges 'Independent test' — never the stale 'Vendor catalog'", () => {
    const b = evidenceBadgeFor(p({ evidenceLabel: "Vendor catalog", trust: { status: "verified" } as never }));
    expect(b).toEqual({ level: "independent", label: "Independent test" });
  });

  it("a live no-claim listing honestly badges 'Vendor catalog'", () => {
    expect(evidenceBadgeFor(p({ trust: { status: "no-claim" } as never }))).toEqual({ level: "public-only", label: "Vendor catalog" });
  });

  it("a cert mismatch is flagged, not shown as clean evidence", () => {
    expect(evidenceBadgeFor(p({ trust: { status: "mismatch" } as never })).level).toBe("stale");
  });

  it("a demo listing keeps its curated column (fictional data stays as authored)", () => {
    const b = evidenceBadgeFor(p({ origin: "demo", evidenceLevel: "issuer-confirmed", evidenceLabel: "Issuer confirmed", trust: { status: "verified" } as never }));
    expect(b).toEqual({ level: "issuer-confirmed", label: "Issuer confirmed" });
  });

  it("falls back to the stored column when no trust has been computed", () => {
    expect(evidenceBadgeFor(p({ trust: undefined }))).toEqual({ level: "public-only", label: "Vendor catalog" });
  });
});
