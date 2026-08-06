import { describe, expect, it } from "vitest";
import { extractJanoshikRefs } from "@/server/ingest/storefront-coa";

describe("extractJanoshikRefs — read a storefront's published Janoshik COA links", () => {
  it("pulls a verify link out of an href in product body_html", () => {
    const html = `<p>Third-party tested. <a href="https://verify.janoshik.com/tests/202438-BPC157_F8IKXANLGX1R">View COA</a></p>`;
    expect(extractJanoshikRefs(html)).toEqual([
      { verifyUrl: "https://verify.janoshik.com/tests/202438-BPC157_F8IKXANLGX1R", testId: "202438" },
    ]);
  });

  it("finds a bare-text link and an &amp;-encoded one, and dedupes", () => {
    const html = `See https://verify.janoshik.com/tests/149759-Retatrutide_20mg and again
      <a href="https://verify.janoshik.com/tests/149759-Retatrutide_20mg">same</a>`;
    expect(extractJanoshikRefs(html)).toEqual([
      { verifyUrl: "https://verify.janoshik.com/tests/149759-Retatrutide_20mg", testId: "149759" },
    ]);
  });

  it("returns multiple distinct references in document order", () => {
    const html = `a https://verify.janoshik.com/tests/111-A_K1 b https://verify.janoshik.com/tests/222-B_K2`;
    expect(extractJanoshikRefs(html).map((r) => r.testId)).toEqual(["111", "222"]);
  });

  it("ignores a bare COA IMAGE (editable) — only the immutable verify link is trusted", () => {
    const html = `<img src="https://cdn.shopify.com/s/files/coa-bpc157.png"> Certificate of analysis attached.`;
    expect(extractJanoshikRefs(html)).toEqual([]);
  });

  it("is empty on absent / non-Janoshik text — fail toward unknown", () => {
    expect(extractJanoshikRefs(null)).toEqual([]);
    expect(extractJanoshikRefs("")).toEqual([]);
    expect(extractJanoshikRefs("lab tested, see our other site janoshik.example.com/fake")).toEqual([]);
  });
});
