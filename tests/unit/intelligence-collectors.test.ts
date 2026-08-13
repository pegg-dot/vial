// Unit coverage for the news + enforcement collectors' pure logic.
//
// The fixtures are REAL payload shapes captured from the live sources (openFDA drug enforcement,
// FDA press-release RSS, FDA MedWatch RSS) — not invented ones. A hand-shaped fixture would prove
// the mapper handles a payload the source never sends.
import { describe, expect, it } from "vitest";
import {
  mapEnforcementRecord, openFdaRecordUrl, openFdaSearchUrl, sanitizeTerms,
  normalizeCuratedAction, curatedActions, OPENFDA_HOSTNAMES,
} from "@/server/collect/enforcement";
import {
  parseRssItems, isMarketRelevant, mapRssItem, curatedNews, normalizeCuratedNews,
  NEWS_FEEDS, NEWS_HOSTNAMES, type NewsFeedSource,
} from "@/server/collect/news";
import { cleanText, decodeEntities, safeSourceUrl, stripTags, toIsoDate } from "@/server/collect/source-text";
import { resolveActionToVendor, severityForAction, type VendorRef } from "@/server/regulatory/actions";

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────

/** Captured verbatim from api.fda.gov/drug/enforcement.json?search=product_description:"tirzepatide" */
const OPENFDA_TIRZEPATIDE = {
  status: "Ongoing",
  city: "Englewood",
  state: "CO",
  country: "United States",
  classification: "Class II",
  openfda: {},
  product_type: "Drugs",
  event_id: "96742",
  recalling_firm: "Thrive Health and Wellness, LLC, dba Thrive Health Solutions (Colorado)",
  address_1: "88 Inverness Cir E Unit A204",
  postal_code: "80112-5521",
  voluntary_mandated: "Voluntary: Firm initiated",
  initial_firm_notification: "E-Mail",
  distribution_pattern: "USA Nationwide",
  recall_number: "D-0484-2025",
  product_description: "Tirzepatide Injections, 30mg/mL, pre-filled syringe, Thrive Health Solutions, 88 Inverness, Cir E, Suite A-204, Englewood, CO 80112",
  product_quantity: "4 syringes",
  reason_for_recall: "Lack of Assurance of Sterility",
  recall_initiation_date: "20250521",
  center_classification_date: "20250620",
  report_date: "20250702",
  code_info: "Lot: H388348",
};

/** Captured verbatim from the FDA press-release RSS feed. */
const FDA_RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0" xml:base="http://www.fda.gov/">
  <channel>
    <title>FDA Press Releases RSS Feed</title>
    <link>http://www.fda.gov/</link>
    <item>
  <title>FDA Issues Emergency Use Authorization for Drug to Treat New World Screwworm in Dogs and Puppies</title>
  <link>http://www.fda.gov/news-events/press-announcements/fda-issues-eua-screwworm-dogs</link>
  <description>The U.S. Food and Drug Administration today issued an Emergency Use Authorization (EUA) for Simparica TRIO for the treatment of New World screwworm infestations in dogs and puppies.</description>
  <pubDate>Thu, 13 Aug 2026 13:02:58 EDT</pubDate>
    <dc:creator>FDA</dc:creator>
    <guid isPermaLink="true">http://www.fda.gov/news-events/press-announcements/fda-issues-eua-screwworm-dogs</guid>
    </item>
<item>
  <title>FDA Warns Consumers Not to Use Compounded Semaglutide from Unregistered Sellers</title>
  <link>http://www.fda.gov/news-events/press-announcements/fda-warns-compounded-semaglutide</link>
  <description>The agency is warning consumers about compounded semaglutide sold by facilities that are not registered outsourcing facilities, including products marketed as &amp;quot;research chemicals&amp;quot;.</description>
  <pubDate>Tue, 04 Aug 2026 09:00:00 EDT</pubDate>
    <guid isPermaLink="true">http://www.fda.gov/news-events/press-announcements/fda-warns-compounded-semaglutide</guid>
    </item>
  </channel>
</rss>`;

const FDA_FEED: NewsFeedSource = NEWS_FEEDS[0]!;

const VENDORS: VendorRef[] = [
  { slug: "swiss-chems", name: "Swiss Chems", domains: ["swisschems.is"] },
  { slug: "paradigm-peptides", name: "Paradigm Peptides", domains: ["paradigmpeptides.com"] },
];

// ── hostile-text handling ────────────────────────────────────────────────────────────────────────

describe("source text is treated as hostile", () => {
  it("strips markup and script bodies rather than storing them", () => {
    expect(stripTags(`<script>alert(1)</script>Real text`).trim()).toBe("Real text");
    expect(cleanText(`<b>FDA</b> <i>warns</i> <img src=x onerror=alert(1)> sellers`)).toBe("FDA warns sellers");
  });

  it("decodes the double-encoded entities government feeds actually emit, but not without bound", () => {
    expect(decodeEntities("Smith &amp;amp; Wesson")).toBe("Smith & Wesson");
    expect(cleanText("Charlottesville, Va. &amp;nbsp;&amp;nbsp;A grand jury")).toBe("Charlottesville, Va. A grand jury");
    // A triple-encoded payload must NOT decode all the way back into live markup.
    expect(cleanText("&amp;amp;amp;lt;script&amp;amp;amp;gt;")).not.toContain("<script>");
  });

  it("clamps long text instead of storing an unbounded blob", () => {
    const clamped = cleanText("x".repeat(5000), 100);
    expect(clamped).toHaveLength(100);
    expect(clamped.endsWith("…")).toBe(true);
  });

  it("only stores an allowlisted https source link", () => {
    expect(safeSourceUrl("http://www.fda.gov/news/a", NEWS_HOSTNAMES)).toBe("https://www.fda.gov/news/a");
    expect(safeSourceUrl("javascript:alert(1)", NEWS_HOSTNAMES)).toBeNull();
    expect(safeSourceUrl("https://evil.example.com/news", NEWS_HOSTNAMES)).toBeNull();
    expect(safeSourceUrl("https://user:pw@www.fda.gov/news", NEWS_HOSTNAMES)).toBeNull();
  });

  it("normalizes both source date dialects and rejects junk", () => {
    expect(toIsoDate("20250521")).toBe("2025-05-21");            // openFDA
    expect(toIsoDate("Tue, 04 Aug 2026 09:00:00 EDT")).toBe("2026-08-04"); // RSS
    expect(toIsoDate("2025-12-10")).toBe("2025-12-10");
    expect(toIsoDate("not a date")).toBeNull();
    expect(toIsoDate("20259999")).toBeNull();
  });
});

// ── enforcement mapping ──────────────────────────────────────────────────────────────────────────

describe("openFDA enforcement mapping", () => {
  it("turns a real openFDA record into a correct regulatory_actions input", () => {
    const mapped = mapEnforcementRecord(OPENFDA_TIRZEPATIDE)!;
    expect(mapped).not.toBeNull();
    expect(mapped.actionType).toBe("recall");
    expect(mapped.agency).toBe("FDA");
    // The subject is the firm openFDA names, verbatim — never a guess.
    expect(mapped.subjectName).toBe("Thrive Health and Wellness, LLC, dba Thrive Health Solutions (Colorado)");
    expect(mapped.actionDate).toBe("2025-05-21");
    expect(mapped.isPrimarySource).toBe(true);
    expect(mapped.title).toContain("Class II");
    expect(mapped.title).toContain("Tirzepatide Injections");
    expect(mapped.summary).toContain("D-0484-2025");
    expect(mapped.summary).toContain("Lack of Assurance of Sterility");
    // The source URL is a working, unique openFDA permalink on the allowlisted host.
    expect(mapped.sourceUrl).toBe(openFdaRecordUrl("D-0484-2025"));
    expect(new URL(mapped.sourceUrl).hostname).toBe(OPENFDA_HOSTNAMES[0]);
    // A recall is "caution", never "severe" — severity must not overstate a sterility recall.
    expect(severityForAction(mapped)).toBe("caution");
  });

  it("refuses a record it cannot store honestly", () => {
    // No named firm — there is nobody to attribute the action to.
    expect(mapEnforcementRecord({ ...OPENFDA_TIRZEPATIDE, recalling_firm: "" })).toBeNull();
    // No recall number — no stable idempotency key, so re-running would duplicate the row.
    expect(mapEnforcementRecord({ ...OPENFDA_TIRZEPATIDE, recall_number: undefined })).toBeNull();
  });

  it("survives a record with almost every field missing", () => {
    const mapped = mapEnforcementRecord({ recalling_firm: "Some Pharmacy LLC", recall_number: "D-1-2026" });
    expect(mapped?.subjectName).toBe("Some Pharmacy LLC");
    expect(mapped?.actionDate).toBeNull();
  });

  it("NEVER attributes an unmatched company to a vendor", () => {
    const mapped = mapEnforcementRecord(OPENFDA_TIRZEPATIDE)!;
    const resolved = resolveActionToVendor(mapped.subjectName, VENDORS, mapped.subjectDomain);
    expect(resolved).toEqual({ vendorSlug: null, confidence: "none" });
  });

  it("does not attribute on a fuzzy or partial name resemblance", () => {
    for (const name of [
      "Swiss Chems Holdings International LLC", // superset of a vendor name
      "Paradigm Peptide",                        // near-miss singular
      "Swiss Chemical Supply Co",                // shares a word
      "Peptides R Us",
    ]) {
      const resolved = resolveActionToVendor(name, VENDORS);
      expect(resolved.vendorSlug, `"${name}" must not be attributed`).toBeNull();
      expect(resolved.confidence).toBe("none");
    }
  });

  it("attributes only on an exact name or a cited domain", () => {
    expect(resolveActionToVendor("Swiss Chems", VENDORS).vendorSlug).toBe("swiss-chems");
    expect(resolveActionToVendor("Operator of paradigmpeptides.com", VENDORS).vendorSlug).toBe("paradigm-peptides");
    expect(resolveActionToVendor("Anything", VENDORS, "swisschems.is").vendorSlug).toBe("swiss-chems");
  });
});

describe("openFDA query construction", () => {
  it("drops short and unsafe terms so the search stays specific", () => {
    // 3-char catalog compounds would match noise across every drug recall in America.
    expect(sanitizeTerms(["VIP", "MGF", "KPV", "P21"])).toEqual([]);
    expect(sanitizeTerms(["Semaglutide", "BPC-157", "AOD-9604"])).toEqual(["semaglutide", "bpc-157", "aod-9604"]);
    expect(sanitizeTerms(["Semaglutide", "semaglutide"])).toEqual(["semaglutide"]);
  });

  it("neutralizes an attempt to escape the query syntax", () => {
    const [term] = sanitizeTerms([`x" OR product_description:"aspirin`]);
    expect(term).not.toContain('"');
    expect(term).not.toContain(":");
    const url = openFdaSearchUrl([`x" OR product_description:"aspirin`]);
    expect(new URL(url).hostname).toBe("api.fda.gov");
    expect(new URL(url).searchParams.get("search")).not.toContain(`product_description:"aspirin`);
  });

  it("builds an OR-batched search against the allowlisted host", () => {
    const url = openFdaSearchUrl(["semaglutide", "tirzepatide"], 50);
    const parsed = new URL(url);
    expect(parsed.hostname).toBe("api.fda.gov");
    expect(parsed.searchParams.get("search")).toBe('product_description:("semaglutide" OR "tirzepatide")');
    expect(parsed.searchParams.get("limit")).toBe("50");
  });

  it("refuses to build a query with no usable term rather than fetching everything", () => {
    expect(() => openFdaSearchUrl(["VIP"])).toThrow();
  });
});

describe("the curated enforcement baseline is bundled and valid", () => {
  it("static-imports real records a deployment can read", () => {
    const actions = curatedActions();
    expect(actions.length).toBeGreaterThanOrEqual(20);
    for (const a of actions) {
      expect(a.subjectName).not.toBe("");
      expect(a.sourceUrl).toMatch(/^https:\/\//);
      expect(["warning_letter", "import_alert", "doj_action", "ftc_action", "recall", "advisory"]).toContain(a.actionType);
    }
  });

  it("skips a malformed entry instead of coercing it", () => {
    expect(normalizeCuratedAction({ actionType: "nonsense", agency: "FDA", subjectName: "X", title: "T", sourceUrl: "https://x" })).toBeNull();
    expect(normalizeCuratedAction({ actionType: "recall", agency: "FDA", subjectName: "", title: "T", sourceUrl: "https://x" })).toBeNull();
    expect(normalizeCuratedAction(null)).toBeNull();
    expect(normalizeCuratedAction({ actionType: "recall", agency: "FDA", subjectName: "X", title: "T", sourceUrl: "https://x", outcome: "made_up" })?.outcome).toBeNull();
  });
});

// ── news parsing / relevance ─────────────────────────────────────────────────────────────────────

describe("RSS parsing", () => {
  it("extracts items from a real FDA feed", () => {
    const items = parseRssItems(FDA_RSS);
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toContain("New World Screwworm");
    expect(items[1]!.title).toBe("FDA Warns Consumers Not to Use Compounded Semaglutide from Unregistered Sellers");
    expect(items[1]!.pubDate).toBe("Tue, 04 Aug 2026 09:00:00 EDT");
    expect(items[1]!.description).toContain('"research chemicals"'); // double-encoded quot decoded
  });

  it("returns nothing for an empty, truncated, or non-RSS body instead of throwing", () => {
    expect(parseRssItems("")).toEqual([]);
    expect(parseRssItems("<html><body>Access Denied</body></html>")).toEqual([]);
    expect(parseRssItems("<rss><channel><item><title>No link</title></item>")).toEqual([]);
    expect(parseRssItems(null as unknown as string)).toEqual([]);
  });

  it("bounds how many items a runaway feed can produce", () => {
    const huge = `<rss>${"<item><title>t</title><link>https://www.fda.gov/x</link></item>".repeat(500)}</rss>`;
    expect(parseRssItems(huge, 60)).toHaveLength(60);
  });
});

describe("market relevance", () => {
  const compounds = ["semaglutide", "tirzepatide", "retatrutide", "ipamorelin"];

  it("keeps items about this market", () => {
    const items = parseRssItems(FDA_RSS);
    expect(isMarketRelevant(`${items[1]!.title} ${items[1]!.description}`, compounds)).toBe(true);
  });

  it("rejects unrelated government news", () => {
    const items = parseRssItems(FDA_RSS);
    expect(isMarketRelevant(`${items[0]!.title} ${items[0]!.description}`, compounds)).toBe(false);
    expect(isMarketRelevant("FDA Approves New Engineered Viral Immunotherapy for Advanced Melanoma", compounds)).toBe(false);
    expect(isMarketRelevant("Repeat Human Smuggler Pleads Guilty to Immigration Offense", compounds)).toBe(false);
    expect(isMarketRelevant("", compounds)).toBe(false);
  });
});

describe("news mapping", () => {
  it("maps a real RSS item, forcing the link to https on an allowlisted host", () => {
    const raw = parseRssItems(FDA_RSS)[1]!;
    const mapped = mapRssItem(raw, FDA_FEED, VENDORS)!;
    expect(mapped.sourceUrl).toBe("https://www.fda.gov/news-events/press-announcements/fda-warns-compounded-semaglutide");
    expect(mapped.newsDate).toBe("2026-08-04");
    expect(mapped.publisher).toBe(FDA_FEED.publisher);
    expect(mapped.sourceType).toBe("trade");
    // No vendor domain appears in the article, so it stays unattributed.
    expect(mapped.vendorSlug).toBeNull();
  });

  it("drops an item whose link points off the allowlisted host", () => {
    expect(mapRssItem({ title: "T", link: "https://evil.example.com/a", description: "d", pubDate: "" }, FDA_FEED)).toBeNull();
    expect(mapRssItem({ title: "", link: "https://www.fda.gov/a", description: "d", pubDate: "" }, FDA_FEED)).toBeNull();
  });

  it("attributes to a vendor only when the article text cites that vendor's domain", () => {
    const cited = mapRssItem(
      { title: "FDA warns peptide seller", link: "https://www.fda.gov/a", description: "The agency cited swisschems.is for unapproved new drug claims.", pubDate: "" },
      FDA_FEED, VENDORS,
    )!;
    expect(cited.vendorSlug).toBe("swiss-chems");

    const lookalike = mapRssItem(
      { title: "Swiss chemical maker recalls peptide lot", link: "https://www.fda.gov/b", description: "A Swiss chemicals company recalled a peptide product.", pubDate: "" },
      FDA_FEED, VENDORS,
    )!;
    expect(lookalike.vendorSlug).toBeNull();
  });
});

describe("the curated news baseline is bundled and valid", () => {
  it("static-imports real items a deployment can read", () => {
    const news = curatedNews();
    expect(news.length).toBeGreaterThanOrEqual(10);
    for (const n of news) {
      expect(n.title).not.toBe("");
      expect(n.summary).not.toBe("");
      expect(n.sourceUrl).toMatch(/^https?:\/\//);
      expect(["trade", "news", "blog", "forum"]).toContain(n.sourceType);
    }
    // The baseline carries the honest source-type mix the /news page renders badges for.
    expect(new Set(news.map((n) => n.sourceType)).size).toBeGreaterThan(1);
  });

  it("skips a malformed entry and falls back to a safe source type", () => {
    expect(normalizeCuratedNews({ title: "", sourceUrl: "https://x" })).toBeNull();
    expect(normalizeCuratedNews({ title: "T", sourceUrl: "https://x", sourceType: "endorsement" })?.sourceType).toBe("news");
  });
});

describe("feed configuration", () => {
  it("only reaches hosts that are on the allowlist", () => {
    for (const feed of NEWS_FEEDS) {
      expect(NEWS_HOSTNAMES).toContain(new URL(feed.url).hostname);
      expect(new URL(feed.url).protocol).toBe("https:");
    }
  });
});
