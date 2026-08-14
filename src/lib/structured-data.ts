import { siteConfig, siteUrl } from "@/lib/site";

// Structured data (schema.org JSON-LD) for the public surfaces.
//
// Two rules govern everything in this file, and they are not stylistic:
//
// 1. Every emitted claim must correspond to something a reader can see on the same page. Search
//    engines treat structured data that outruns the visible page as deception, and it is also
//    exactly the dishonesty this product exists to catch.
// 2. Nothing here may imply endorsement, safety, medical standing, or that VialGrade sells
//    anything. VialGrade aggregates other people's listings and other people's lab reports.
//
// That second rule is why compounds are DefinedTerm rather than Drug: schema.org/Drug is a
// MedicalEntity, and tagging a grey-market research peptide as a drug entity would assert a
// medical identity for it that no evidence on the page supports. A DefinedTerm says what the page
// actually is — a reference entry in a compound directory, with a name, aliases and a description.

export type JsonLd = Record<string, unknown>;

const ORGANIZATION_ID = `${siteUrl}/#organization`;
const WEBSITE_ID = `${siteUrl}/#website`;

/** Absolute URL for a site-relative path, for the `url`/`@id` fields schema.org requires. */
export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The publisher identity, referenced by @id from every other node rather than repeated. */
export function organizationSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: siteConfig.name,
    url: siteUrl,
    logo: absoluteUrl("/brand/vialgrade-icon.svg"),
    description: siteConfig.description,
  };
}

/**
 * The site node plus its search entry point.
 *
 * The target is /search, which is the route that actually reads `?q=`. It previously pointed at
 * /market, which ignores the parameter entirely — a SearchAction aimed at a page that discards the
 * query is worse than none, because a search engine may surface it as a working sitelinks box.
 */
export function webSiteSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: siteConfig.name,
    url: siteUrl,
    description: siteConfig.description,
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * A compound reference entry. Deliberately NOT schema.org/Drug — see the file header.
 *
 * Every field maps to visible page content: name is the h1, alternateName is the alias row,
 * description is the paragraph under the title, and termCode is the slug in the URL.
 */
export function compoundSchema(input: {
  slug: string;
  name: string;
  description: string;
  aliases: string[];
  category: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": absoluteUrl(`/compounds/${input.slug}`),
    name: input.name,
    description: input.description,
    url: absoluteUrl(`/compounds/${input.slug}`),
    termCode: input.slug,
    ...(input.aliases.length > 0 ? { alternateName: input.aliases } : {}),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      "@id": absoluteUrl("/compounds"),
      name: "VialGrade compound directory",
      url: absoluteUrl("/compounds"),
    },
    ...(input.category ? { additionalType: input.category } : {}),
  };
}

/**
 * A vendor as an Organization.
 *
 * No `aggregateRating` and no `review`, ever. VialGrade's letter grade is our own derived verdict
 * over evidence seams, not a rating by customers, and emitting it as a rating would both fabricate
 * review data and dress an evidence summary up as an endorsement.
 *
 * `url` is omitted rather than pointed at our own vendor page: on an Organization, `url` means the
 * organization's own website, and we do not hold a verified homepage for every vendor.
 * `mainEntityOfPage` carries the "this page is about them" relationship instead.
 */
export function vendorSchema(input: {
  slug: string;
  name: string;
  description: string;
  location: string;
  founded: string;
}): JsonLd {
  const page = absoluteUrl(`/vendors/${input.slug}`);
  // Only a bare four-digit year is safe to publish as a founding date; the column is free text and
  // may hold anything ("Unknown", "early 2010s"), which schema.org would misread as a date.
  const foundingYear = /^\d{4}$/.test(input.founded.trim()) ? input.founded.trim() : null;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": page,
    name: input.name,
    description: input.description,
    mainEntityOfPage: page,
    ...(input.location ? { address: input.location } : {}),
    ...(foundingYear ? { foundingDate: foundingYear } : {}),
    subjectOf: {
      "@type": "WebPage",
      "@id": page,
      url: page,
      name: `${input.name} — evidence record on VialGrade`,
      isPartOf: { "@id": WEBSITE_ID },
    },
  };
}

/**
 * A frequently-asked-questions page. Only pass genuine question/answer pairs that render on the
 * page — a heading that merely restates a question is not an answer, and marking it up as one is
 * the mismatch search engines penalize.
 */
export function faqSchema(input: { url: string; questions: Array<{ question: string; answer: string }> }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": absoluteUrl(input.url),
    url: absoluteUrl(input.url),
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    mainEntity: input.questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** An editorial explainer. `citation` carries the primary sources the page already lists visibly. */
export function articleSchema(input: {
  url: string;
  headline: string;
  description: string;
  dateModified?: string;
  citations?: string[];
}): JsonLd {
  const page = absoluteUrl(input.url);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": page,
    headline: input.headline,
    description: input.description,
    url: page,
    mainEntityOfPage: page,
    isPartOf: { "@id": WEBSITE_ID },
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.citations?.length ? { citation: input.citations } : {}),
  };
}
