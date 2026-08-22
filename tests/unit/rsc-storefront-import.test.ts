import { describe, expect, it } from "vitest";
import { parseFlightPayload, extractRscProducts, rscVariantPrice, rscCoaFromMetadata, productUrlsFromSitemap } from "@/server/ingest/rsc-storefront-import";

// A growing share of this market has left Shopify and WooCommerce for headless storefronts —
// Medusa behind a Next.js app. There is no /products.json and no /wp-json to read, so the whole
// catalog was invisible to us. But the server component payload embeds the complete product,
// variants, prices and COA metadata in the HTML. These fixtures are the REAL shapes taken from
// ascendbiolabs.com (a Medusa + Next.js storefront), reduced in volume, not in structure.

/** Encode a JSON string the way Next.js emits it, so the tests exercise the real envelope. */
const chunk = (s: string) => `self.__next_f.push([1,${JSON.stringify(s)}])`;

const ASCEND_PRODUCT = {
  id: "prod_01KNR2NVAYW8YCMQ0GW1GRD4A2",
  handle: "bpc-157",
  title: "BPC-157",
  metadata: {
    purity: "99.3%",
    coa_lab: "Vanguard Laboratory",
    coa_url: "https://ascendbiolabs-application.b-cdn.net/coas/batch-V260602-23/report-008.pdf",
    coa_batch_id: "V260602-23",
    coa_test_date: "2026-06-12",
    coa_legacy_lab: "Freedom Diagnostics",
    wp_stock_status: "outofstock",
  },
  variants: [
    {
      title: "3 Vials / 10MG",
      sku: "WP-72-V542-3V",
      metadata: { cost_per_vial: 6.8, vials_per_pack: 3 },
      calculated_price: { calculated_amount: 166, currency_code: "usd" },
    },
    {
      title: "1 Vial / 10MG",
      sku: "WP-72-V541",
      metadata: { vials_per_pack: 1 },
      calculated_price: { calculated_amount: 65, currency_code: "usd" },
    },
  ],
};

/**
 * The real page splits one product across several push() chunks — the payload is streamed.
 * Splitting mid-object here is the whole point: a parser that reads chunks independently
 * finds nothing, and that is exactly the bug this fixture exists to catch.
 */
function pageWithProduct(product: unknown, splits = 2): string {
  const json = `1:{"products":[${JSON.stringify(product)}]}\n`;
  const size = Math.ceil(json.length / splits);
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += size) parts.push(json.slice(i, i + size));
  return `<!DOCTYPE html><html><body><script>${parts.map(chunk).join("</script><script>")}</script></body></html>`;
}

describe("flight payload reassembly", () => {
  it("joins push() chunks that split a product mid-object", () => {
    const flight = parseFlightPayload(pageWithProduct(ASCEND_PRODUCT, 4));
    expect(flight).toContain('"handle":"bpc-157"');
    expect(flight).toContain('"coa_batch_id":"V260602-23"');
  });

  it("returns an empty string for a page with no flight payload", () => {
    expect(parseFlightPayload("<html><body>nothing here</body></html>")).toBe("");
  });

  it("skips a malformed chunk instead of losing the whole page", () => {
    const good = chunk('1:{"handle":"bpc-157"}');
    const page = `<html><script>self.__next_f.push([1,"\\uZZZZ"])</script><script>${good}</script></html>`;
    expect(parseFlightPayload(page)).toContain("bpc-157");
  });
});

describe("product extraction", () => {
  it("recovers the product with its variants and COA metadata", () => {
    const products = extractRscProducts(parseFlightPayload(pageWithProduct(ASCEND_PRODUCT)));
    expect(products).toHaveLength(1);
    expect(products[0].handle).toBe("bpc-157");
    expect(products[0].title).toBe("BPC-157");
    expect(products[0].variants).toHaveLength(2);
    expect(products[0].metadata?.coa_batch_id).toBe("V260602-23");
  });

  it("ignores objects that are not products", () => {
    const noise = `1:{"id":"opt_1","title":"Size","value":"10MG"}\n`;
    const page = `<html><script>${chunk(noise)}</script></html>`;
    expect(extractRscProducts(parseFlightPayload(page))).toHaveLength(0);
  });

  // The same product is emitted more than once on a real page (once for the detail view, once
  // for a related-products rail). Recording it twice would double a vendor's listing count.
  it("returns one entry per handle even when the payload repeats it", () => {
    const json = `1:{"a":${JSON.stringify(ASCEND_PRODUCT)},"b":${JSON.stringify(ASCEND_PRODUCT)}}\n`;
    const page = `<html><script>${chunk(json)}</script></html>`;
    expect(extractRscProducts(parseFlightPayload(page))).toHaveLength(1);
  });
});

describe("variant pricing", () => {
  it("reads the calculated amount as dollars", () => {
    expect(rscVariantPrice(ASCEND_PRODUCT.variants[0])).toBe(166);
    expect(rscVariantPrice(ASCEND_PRODUCT.variants[1])).toBe(65);
  });

  it("returns null when a variant carries no resolved price", () => {
    expect(rscVariantPrice({ title: "x", calculated_price: null })).toBeNull();
    expect(rscVariantPrice({ title: "x" })).toBeNull();
  });

  // A non-USD amount recorded as dollars would put a wrong number on a price comparison.
  it("refuses a non-USD price rather than mislabelling it", () => {
    expect(rscVariantPrice({ title: "x", calculated_price: { calculated_amount: 166, currency_code: "eur" } })).toBeNull();
  });
});

describe("COA metadata", () => {
  it("reads the named lab, batch, date and purity", () => {
    const coa = rscCoaFromMetadata(ASCEND_PRODUCT.metadata);
    expect(coa).toEqual({
      lab: "Vanguard Laboratory",
      url: "https://ascendbiolabs-application.b-cdn.net/coas/batch-V260602-23/report-008.pdf",
      // Qualified by the report number — see "batch identity across one lab submission" below.
      batchId: "V260602-23-008",
      testedAt: "2026-06-12",
      purityPct: 99.3,
    });
  });

  // The whole value of this seam is that a NAMED third-party lab performed the test. A vendor
  // that publishes a certificate with no lab named has published a self-test, and counting it
  // as independent evidence would inflate their grade on exactly the seam that must stay honest.
  it("refuses a certificate with no lab named", () => {
    expect(rscCoaFromMetadata({ coa_url: "https://x/c.pdf", coa_batch_id: "B1", purity: "99%" })).toBeNull();
  });

  it("refuses a certificate with no document to point at", () => {
    expect(rscCoaFromMetadata({ coa_lab: "Vanguard Laboratory", coa_batch_id: "B1" })).toBeNull();
  });

  // A legacy lab field means they USED to test elsewhere. It is not evidence about this batch.
  it("does not fall back to the legacy lab", () => {
    expect(rscCoaFromMetadata({ coa_legacy_lab: "Freedom Diagnostics", coa_url: "https://x/c.pdf", coa_batch_id: "B1" })).toBeNull();
  });
});

describe("product url discovery", () => {
  const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://ascendbiolabs.com</loc></url>
  <url><loc>https://ascendbiolabs.com/shop</loc></url>
  <url><loc>https://ascendbiolabs.com/product/bpc-157</loc></url>
  <url><loc>https://ascendbiolabs.com/product/tesamorelin</loc></url>
  <url><loc>https://ascendbiolabs.com/about</loc></url>
</urlset>`;

  it("keeps only the product pages", () => {
    expect(productUrlsFromSitemap(SITEMAP, "/product/")).toEqual([
      "https://ascendbiolabs.com/product/bpc-157",
      "https://ascendbiolabs.com/product/tesamorelin",
    ]);
  });

  it("returns nothing for a sitemap with no matching pages", () => {
    expect(productUrlsFromSitemap(SITEMAP, "/collections/")).toEqual([]);
  });

  // A sitemap is third-party content. An off-host <loc> would send the importer somewhere the
  // vendor does not control, and record whatever it found there as that vendor's catalogue.
  it("refuses a url that is not on the vendor's own host", () => {
    const hostile = `<urlset><url><loc>https://evil.example.com/product/x</loc></url>
      <url><loc>https://ascendbiolabs.com/product/ok</loc></url></urlset>`;
    expect(productUrlsFromSitemap(hostile, "/product/", "ascendbiolabs.com")).toEqual([
      "https://ascendbiolabs.com/product/ok",
    ]);
  });
});

// Caught on the first real ingest, before it shipped. `coa_batch_id` on this storefront is the
// LAB SUBMISSION id, not a product lot: Ascend sent ~17 samples to Vanguard on one date and each
// came back as its own report (…/batch-V260602-23/report-008.pdf, report-006, report-012 …). The
// certificate says so itself — "Laboratory ID: V260602-23  008" with "Lot Number: N/A".
//
// Recording the bare submission id as the batch code made eight different compounds share one
// "lot", which trips detectVendorCoaFlags' reused-lot rule at its 3-compound threshold and
// publishes "the certificate is a template, not real per-batch testing" about a vendor whose
// certificates are individually run. A false statement of fact about a real business, from the
// site whose product is checking such statements. The report number is what makes it unique.
describe("batch identity across one lab submission", () => {
  const meta = (url: string) => ({ coa_lab: "Vanguard Laboratory", coa_url: url, coa_batch_id: "V260602-23" });

  it("qualifies the submission id with the report number", () => {
    expect(rscCoaFromMetadata(meta("https://cdn/coas/batch-V260602-23/report-008.pdf"))?.batchId).toBe("V260602-23-008");
  });

  it("gives two products from one submission different batch codes", () => {
    const a = rscCoaFromMetadata(meta("https://cdn/coas/batch-V260602-23/report-008.pdf"))?.batchId;
    const b = rscCoaFromMetadata(meta("https://cdn/coas/batch-V260602-23/report-012.pdf"))?.batchId;
    expect(a).not.toBe(b);
  });

  it("keeps the bare id when the certificate url carries no report number", () => {
    expect(rscCoaFromMetadata(meta("https://cdn/coas/batch-V260602-23/cert.pdf"))?.batchId).toBe("V260602-23");
  });

  it("does not invent a batch code when the vendor publishes none", () => {
    expect(rscCoaFromMetadata({ coa_lab: "Vanguard Laboratory", coa_url: "https://cdn/coas/x/report-008.pdf" })?.batchId).toBeNull();
  });
});
