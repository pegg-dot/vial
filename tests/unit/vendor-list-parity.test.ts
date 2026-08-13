import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import bundled from "@/server/verify/known-vendors.json";

// Two copies of the vendor list exist: the one bundled into the app (used at runtime by the
// continuous collector) and the one the offline ingest scripts read. They drifted once — the
// bundled copy was missing `wooWorks`, which silently gave the scheduler ZERO WooCommerce targets
// while 14 of 15 tracked storefronts run WooCommerce. Nothing failed; collection just quietly
// covered one vendor.
type Vendor = { slug: string; domain?: string; productsJsonWorks?: boolean; wooWorks?: boolean; redFlag?: boolean };

function list(raw: unknown): Vendor[] {
  const items = Array.isArray(raw) ? raw : ((raw as { vendors?: unknown[] }).vendors ?? []);
  return items as Vendor[];
}

const scriptSide = list(JSON.parse(readFileSync("scripts/data/peptide-vendors.json", "utf8")));
const appSide = list(bundled);

describe("vendor list parity", () => {
  it("tracks the same vendors on both sides", () => {
    expect(appSide.map(v => v.slug).sort()).toEqual(scriptSide.map(v => v.slug).sort());
  });

  it("agrees on the platform flags that decide which collector runs", () => {
    const byScript = new Map(scriptSide.map(v => [v.slug, v]));
    for (const v of appSide) {
      const other = byScript.get(v.slug)!;
      expect(Boolean(v.wooWorks), `wooWorks for ${v.slug}`).toBe(Boolean(other.wooWorks));
      expect(Boolean(v.productsJsonWorks), `productsJsonWorks for ${v.slug}`).toBe(Boolean(other.productsJsonWorks));
      expect(Boolean(v.redFlag), `redFlag for ${v.slug}`).toBe(Boolean(other.redFlag));
    }
  });

  // If this ever hits zero, the scheduler is collecting almost nothing and nothing else complains.
  it("yields a non-trivial number of catalog targets", () => {
    const catalogable = appSide.filter(v => !v.redFlag && (v.wooWorks || v.productsJsonWorks));
    expect(catalogable.length).toBeGreaterThanOrEqual(10);
  });
});
