import { describe, expect, it } from "vitest";
import { detectAdvertisedTesting } from "@/server/ingest/storefront-coa";

// Real copy pulled from live WooCommerce storefronts during the 2026-08-12 coverage audit.
const ETERNAL = `<p><span>Synthesized to ≥99% purity per component, with every lot supported by an
  independent Janoshik COA and full batch traceability.</span></p>`;
const ETERNAL_2 = `<p>Testing is conducted by independent third-party laboratories including Janoshik.
  COAs are lot-traceable and available on the Lab Tests page.</p>`;

describe("detectAdvertisedTesting", () => {
  it("detects a named independent lab in storefront copy", () => {
    expect(detectAdvertisedTesting(ETERNAL)?.issuer).toBe("Janoshik");
    expect(detectAdvertisedTesting(ETERNAL_2)?.issuer).toBe("Janoshik");
  });

  it("detects an unnamed third-party testing claim", () => {
    const claim = detectAdvertisedTesting("<p>Every batch is verified by independent third-party lab testing.</p>");
    expect(claim?.issuer).toBe("Third-party lab");
  });

  it("recognises the other labs on the feed", () => {
    expect(detectAdvertisedTesting("Tested by MZ Biolabs for purity.")?.issuer).toBe("MZ Biolabs");
    expect(detectAdvertisedTesting("Colmaric Analyticals performs our assays.")?.issuer).toBe("Colmaric");
  });

  // The claim becomes a published statement about a real business, so it must not fire on
  // marketing noise. Everything below is a vendor saying something OTHER than "a third party
  // tested this".
  it("does not fire on in-house or unqualified quality copy", () => {
    for (const text of [
      "<p>99% purity guaranteed. Made in our own facility.</p>",
      "<p>Lab grade research chemicals for laboratory use only.</p>",
      "<p>Our in-house lab tests every batch.</p>",
      "<p>High quality peptides, rigorously quality controlled.</p>",
      "<p>Ships from our US laboratory.</p>",
      "<p>Research use only. Not for human consumption.</p>",
    ]) {
      expect(detectAdvertisedTesting(text), text).toBeNull();
    }
  });

  it("does not fire on a negation or an absence", () => {
    expect(detectAdvertisedTesting("<p>No third-party testing is available for this product.</p>")).toBeNull();
    expect(detectAdvertisedTesting("")).toBeNull();
    expect(detectAdvertisedTesting(null)).toBeNull();
    expect(detectAdvertisedTesting(undefined)).toBeNull();
  });

  it("prefers the named lab over the generic claim when both appear", () => {
    const both = "Independent third-party testing, performed by Janoshik Analytical.";
    expect(detectAdvertisedTesting(both)?.issuer).toBe("Janoshik");
  });

  it("reads through HTML entities and tags", () => {
    expect(detectAdvertisedTesting("<b>third&#45;party</b> lab <i>tested</i> by <a>Janoshik</a>")?.issuer).toBe("Janoshik");
  });
});
