import { describe, expect, it } from "vitest";
import { articleSchema, compoundSchema, faqSchema, organizationSchema, vendorSchema, webSiteSchema } from "@/lib/structured-data";
import { siteUrl } from "@/lib/site";

// These assertions are product rules, not formatting preferences. Structured data is the copy of
// the page that search engines and language models read, so anything this file lets through is a
// claim VialGrade is making at scale, unsupervised, about products it does not sell.

describe("site-wide identity", () => {
  it("points the search action at the route that actually reads the query", () => {
    const site = webSiteSchema();
    const action = site.potentialAction as { target: { urlTemplate: string } };
    // /market ignores ?q= entirely. A SearchAction aimed there advertises a search box that
    // silently drops what the visitor typed.
    expect(action.target.urlTemplate).toBe(`${siteUrl}/search?q={search_term_string}`);
  });

  it("derives every absolute URL from the configured origin instead of hardcoding one", () => {
    // The home page used to ship a WebSite node with "https://vialgrade.example" written into it
    // literally, so it stayed wrong on the real domain no matter how the deployment was
    // configured. Every URL must now move with NEXT_PUBLIC_SITE_URL.
    const serialized = JSON.stringify([organizationSchema(), webSiteSchema()]);
    for (const url of serialized.match(/https?:\/\/[^"]+/g) ?? []) {
      if (url.startsWith("https://schema.org")) continue;
      expect(url.startsWith(siteUrl)).toBe(true);
    }
  });
});

describe("compound schema", () => {
  const compound = {
    slug: "bpc-157",
    name: "BPC-157",
    description: "A synthetic peptide fragment studied in animal models.",
    aliases: ["Body Protection Compound 157", "PL 14736"],
    category: "Repair",
  };

  it("describes a directory entry, never a medical entity", () => {
    const schema = compoundSchema(compound);
    expect(schema["@type"]).toBe("DefinedTerm");
    // Drug/MedicalEntity would assert a medical identity no evidence on the page supports.
    expect(JSON.stringify(schema)).not.toContain("Drug");
    expect(JSON.stringify(schema)).not.toContain("MedicalEntity");
  });

  it("carries the aliases the page shows, and omits the key when there are none", () => {
    expect(compoundSchema(compound).alternateName).toEqual(compound.aliases);
    expect(compoundSchema({ ...compound, aliases: [] })).not.toHaveProperty("alternateName");
  });
});

describe("vendor schema", () => {
  const vendor = { slug: "acme-peptides", name: "Acme Peptides", description: "A storefront.", location: "Nevada, US", founded: "2019" };

  it("never rates a vendor", () => {
    const serialized = JSON.stringify(vendorSchema(vendor));
    // The VialGrade letter is our derived verdict over evidence, not customers rating a seller.
    expect(serialized).not.toContain("aggregateRating");
    expect(serialized).not.toContain("ratingValue");
    expect(serialized).not.toContain("\"review\"");
  });

  it("publishes a founding date only when the free-text column holds a bare year", () => {
    expect(vendorSchema(vendor).foundingDate).toBe("2019");
    for (const founded of ["Unknown", "early 2010s", "", "circa 2015"]) {
      expect(vendorSchema({ ...vendor, founded })).not.toHaveProperty("foundingDate");
    }
  });

  it("omits address when the vendor's location is unknown", () => {
    expect(vendorSchema({ ...vendor, location: "" })).not.toHaveProperty("address");
  });
});

describe("page-level schema", () => {
  it("maps every FAQ entry to a question with its own answer", () => {
    const schema = faqSchema({ url: "/help", questions: [{ question: "Does VialGrade sell products?", answer: "No." }] });
    expect(schema.mainEntity).toEqual([
      { "@type": "Question", name: "Does VialGrade sell products?", acceptedAnswer: { "@type": "Answer", text: "No." } },
    ]);
  });

  it("keeps optional article fields absent rather than empty", () => {
    const bare = articleSchema({ url: "/how-we-check", headline: "H", description: "D" });
    expect(bare).not.toHaveProperty("citation");
    expect(bare).not.toHaveProperty("dateModified");
    const cited = articleSchema({ url: "/grades", headline: "H", description: "D", dateModified: "2026-08-14", citations: ["https://www.ecfr.gov/x"] });
    expect(cited.citation).toEqual(["https://www.ecfr.gov/x"]);
  });
});

describe("nothing implies VialGrade sells or endorses", () => {
  it("emits no Offer, price, or endorsement vocabulary anywhere in the shared builders", () => {
    const all = JSON.stringify([
      organizationSchema(),
      webSiteSchema(),
      compoundSchema({ slug: "s", name: "n", description: "d", aliases: [], category: "c" }),
      vendorSchema({ slug: "s", name: "n", description: "d", location: "l", founded: "2019" }),
      faqSchema({ url: "/help", questions: [] }),
      articleSchema({ url: "/grades", headline: "h", description: "d" }),
    ]);
    for (const forbidden of ["Offer", "priceCurrency", "\"price\"", "seller", "InStock"]) {
      expect(all).not.toContain(forbidden);
    }
  });
});
