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

// Every case below was produced by an adversarial audit running the REAL function against real
// vendor-copy shapes. Each one previously returned a claim (or wrongly suppressed one) — publishing
// "this vendor advertises third-party testing" about a named company on the strength of a nav link,
// a smear, or a sentence about animal studies.
describe("detectAdvertisedTesting — audit regressions", () => {
  const MUST_BE_NULL: [label: string, html: string][] = [
    ["literature, not product testing", "<p>BPC-157 has been tested in independent animal studies with promising results.</p>"],
    ["independent research as a subject", "<p>Independent research has analyzed the stability of semaglutide in solution.</p>"],
    ["reviews by researchers", "<div>Verified buyer reviews from independent researchers worldwide.</div>"],
    ["claim spanning two list items", "<ul><li>Independent research library</li><li>Tested for purity in our facility</li></ul>"],
    ["claim spanning heading and body", "<h2>Independent Research Use Only</h2><p>Every batch is tested by us in-house.</p>"],
    ["navigation chrome", "<nav><a>Independent Labs</a><a>Testing FAQ</a><a>Shop</a></nav>"],
    ["a smear about someone else", "<p>Unlike vendors posting fake Janoshik certificates, we ship real product.</p>"],
    ["a promise, not a fact", "<p>Janoshik testing coming soon — results posted when available.</p>"],
    ["an explicit denial", "<p>We do our own in-house QC; we do not pay for Janoshik reports.</p>"],
  ];
  for (const [label, html] of MUST_BE_NULL) {
    it(`does not fire on ${label}`, () => {
      expect(detectAdvertisedTesting(html)).toBeNull();
    });
  }

  // Negation must be scoped to the sentence that contains it. Document-scoped negation let one
  // unrelated "no" anywhere on a page suppress a genuine claim.
  it("still detects a real claim when an unrelated negation appears elsewhere", () => {
    expect(detectAdvertisedTesting("<p>Every batch third-party tested. We use no third-party cookies.</p>")?.issuer).toBe("Third-party lab");
    expect(detectAdvertisedTesting("<p>Third-party tested by an independent laboratory. We are not affiliated with any third-party reseller.</p>")?.issuer).toBe("Third-party lab");
  });
});
