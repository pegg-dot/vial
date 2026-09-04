import { describe, expect, it } from "vitest";
import { coverageState, hasImportMethod } from "@/server/collect/coverage";
import knownVendors from "@/server/verify/known-vendors.json";

// The three states send an operator to three different pieces of work, so a mislabel wastes the
// only thing this panel exists to save: knowing which storefronts can never be graded, and why.
describe("coverageState", () => {
  const list = [
    { slug: "shopify-shop", domain: "a.test", productsJsonWorks: true },
    { slug: "woo-shop", domain: "b.test", wooWorks: true },
    { slug: "rsc-shop", domain: "c.test", rscWorks: true },
    { slug: "polled-only", domain: "d.test" },
    { slug: "flagged", domain: "e.test", redFlag: true, productsJsonWorks: true },
  ];

  it("calls a storefront the curated list has never heard of uncurated", () => {
    expect(coverageState("surfaced-from-a-coa", list)).toBe("uncurated");
  });

  it("calls a curated storefront with no import method no-method", () => {
    // This is the actionable bucket: we poll its status and domain every day and never once read
    // its catalogue, so it sits at zero listings forever while every collector reports healthy.
    expect(coverageState("polled-only", list)).toBe("no-method");
  });

  it("treats each of the three import methods as a live collector", () => {
    for (const slug of ["shopify-shop", "woo-shop", "rsc-shop"]) {
      expect(coverageState(slug, list), slug).toBe("collecting");
    }
  });

  it("never reports a red-flagged vendor as collecting", () => {
    // `syncCollectionTargets` filters red-flagged vendors out of every collector, so calling this
    // one "collecting" would send someone to look for a failing job that was never enqueued.
    expect(coverageState("flagged", list)).toBe("no-method");
  });
});

describe("the real curated vendor list", () => {
  const raw = knownVendors as unknown;
  const list = (Array.isArray(raw) ? raw : ((raw as { vendors?: unknown[] }).vendors ?? [])) as Array<Record<string, unknown>>;

  it("still contains storefronts with no catalogue import method", () => {
    // Not an aspiration — a fact about today's coverage that the admin panel reports. If this ever
    // goes to zero the panel should stop naming any "curated, but no import method" vendor, and
    // this test is where that change gets noticed rather than discovered on the page.
    const legit = list.filter((v) => v.slug && v.domain && !v.redFlag);
    const missing = legit.filter((v) => !hasImportMethod(v));
    expect(legit.length).toBeGreaterThan(0);
    expect(missing.length).toBeGreaterThan(0);
  });
});
