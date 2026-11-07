import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VendorSourceLink } from "@/components/vendor-source-link";
import { VENDOR_LINK_NOTE } from "@/lib/vendor-source-link";

describe("VendorSourceLink markup", () => {
  const html = renderToStaticMarkup(createElement(VendorSourceLink, { url: "https://acme-peptides.com/" }));

  it("is one external link with safe rel, the host shown, and the disclaimer beside it", () => {
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="https://acme-peptides.com/"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Company&#x27;s own website: acme-peptides.com");
    expect(html).toContain("not verified or endorsed by VialGrade");
  });

  it("carries no tracking, referral or commerce wording", () => {
    // The disclaimer says "not a recommendation to buy"; everything else must be free of commerce wording.
    const rest = html.replace(VENDOR_LINK_NOTE, "");
    expect(rest).not.toMatch(/\/go\b|\bref=|utm_|affiliate|\bbuy\b|\bprice|\bshop\b|\border\b|discount|cart/i);
  });
});
