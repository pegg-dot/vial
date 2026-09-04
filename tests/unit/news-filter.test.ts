import { describe, expect, it } from "vitest";
import curated from "@/server/data/news-items.json";
import { NEWS_TOPICS, classifyNewsTopics, filterNews, leadFirst, type NewsRow } from "@/lib/news-filter";

function row(over: Partial<NewsRow> = {}): NewsRow {
  return {
    id: "n1", title: "", summary: "", publisher: null, news_date: "2026-01-01",
    source_url: "https://example.test/a", source_type: "news", vendor_slug: null, vendor_name: null,
    ...over,
  };
}

describe("classifyNewsTopics", () => {
  // Each case is a REAL headline from src/server/data/news-items.json or the live FDA MedWatch feed.
  // A classifier tested only against strings invented alongside it proves nothing about the corpus.
  it("tags an FDA recall from the live MedWatch feed", () => {
    const topics = classifyNewsTopics(row({
      title: "Optimal Balance Pharmacy Issues Voluntary Nationwide Recall of Certain Lots of Compounded Glutathione 200 mg/mL Multi-Dose Vials Due to Elevated Endotoxin Levels",
      summary: "The product is being recalled because pharmacy testing identified elevated bacterial endotoxin levels.",
      publisher: "FDA MedWatch",
    }));
    expect(topics).toContain("recall");
    expect(topics).toContain("contamination");
  });

  it("tags a DOJ guilty plea as enforcement, not as a private lawsuit", () => {
    const topics = classifyNewsTopics(row({
      title: "United States v. Matthew Kawa et al. — Paradigm Peptides guilty plea",
      summary: "Matthew Kawa and Jennifer Stechkober pleaded guilty over the operation of Paradigm Peptides, which sold SARMs, hCG and peptides nationwide.",
      publisher: "U.S. Department of Justice, USAO Northern District of Indiana",
    }));
    expect(topics).toContain("enforcement");
  });

  it("tags a private infringement suit as a lawsuit", () => {
    const topics = classifyNewsTopics(row({
      title: "Lilly sues online vendors, medical spa over copycat weight-loss drugs",
      summary: "Eli Lilly filed suit against online vendors and a medical spa selling copycat weight-loss drugs.",
      publisher: "Reuters (via AOL)",
    }));
    expect(topics).toContain("lawsuit");
    expect(topics).toContain("glp1");
  });

  it("tags a vendor wind-down as a vendor exit", () => {
    expect(classifyNewsTopics(row({
      title: "Science.bio announces voluntary closure",
      summary: "Research-chemical vendor Science.bio announced a voluntary wind-down, committing to refunds or order fulfillment.",
    }))).toContain("vendor-exit");
    expect(classifyNewsTopics(row({
      title: "Peptide Sciences shuts down — largest U.S. grey-market peptide vendor exits",
      summary: "Peptide Sciences, described by industry trackers as the largest U.S. grey-market peptide vendor, announced a voluntary shutdown.",
    }))).toContain("vendor-exit");
  });

  it("tags a warning letter as enforcement", () => {
    expect(classifyNewsTopics(row({
      title: "FDA Warning Letter to SwissChems (MARCS-CMS 695663)",
      summary: "The FDA issued a warning letter over unapproved new drugs and misbranding.",
    }))).toContain("enforcement");
  });

  it("tags a compounding-policy notice as policy", () => {
    expect(classifyNewsTopics(row({
      title: "FDA clarifies compounding policy as GLP-1 shortages resolve, setting enforcement deadlines",
      summary: "The agency set deadlines for compounders after resolving the semaglutide and tirzepatide shortages.",
    }))).toContain("policy");
  });

  it("returns no topic rather than guessing when nothing matches", () => {
    expect(classifyNewsTopics(row({ title: "Quarterly market report", summary: "General commentary." }))).toEqual([]);
  });

  it("only ever emits ids declared in NEWS_TOPICS", () => {
    const declared = new Set(NEWS_TOPICS.map((topic) => topic.id));
    for (const item of curated as Array<Record<string, string>>) {
      for (const topic of classifyNewsTopics(row({ title: item.title, summary: item.summary, publisher: item.publisher }))) {
        expect(declared).toContain(topic);
      }
    }
  });

  // The chips are only worth showing if they actually cut the real corpus. A topic that matches
  // everything, or nothing, is noise dressed as a filter.
  it("classifies most of the curated corpus without collapsing to one bucket", () => {
    const rows = (curated as Array<Record<string, string>>).map((item) =>
      row({ title: item.title, summary: item.summary, publisher: item.publisher }));
    const tagged = rows.filter((item) => classifyNewsTopics(item).length > 0);
    expect(tagged.length).toBeGreaterThanOrEqual(Math.ceil(rows.length * 0.8));
    for (const topic of NEWS_TOPICS) {
      const hits = rows.filter((item) => classifyNewsTopics(item).includes(topic.id)).length;
      expect(hits, `topic ${topic.id} matches every row`).toBeLessThan(rows.length);
    }
  });
});

describe("filterNews", () => {
  const rows: NewsRow[] = [
    row({ id: "a", title: "FDA Warning Letter to SwissChems", summary: "Unapproved new drugs.", publisher: "U.S. Food & Drug Administration", source_type: "trade", vendor_slug: "swiss-chems", vendor_name: "Swiss Chems" }),
    row({ id: "b", title: "Science.bio announces voluntary closure", summary: "A voluntary wind-down.", publisher: "TitrateLab", source_type: "blog" }),
    row({ id: "c", title: "Telehealth booms as demand for GLP-1s surges", summary: "Medication-error reports rose.", publisher: "KFF Health News", source_type: "news" }),
  ];

  it("matches the keyword against the title", () => {
    expect(filterNews(rows, { query: "swisschems" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("matches the keyword against the summary", () => {
    expect(filterNews(rows, { query: "wind-down" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("matches the keyword against the publisher", () => {
    expect(filterNews(rows, { query: "kff" }).map((r) => r.id)).toEqual(["c"]);
  });

  it("matches the keyword against the named vendor", () => {
    expect(filterNews(rows, { query: "Swiss Chems" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(filterNews(rows, { query: "  ScIeNcE.bIo " }).map((r) => r.id)).toEqual(["b"]);
  });

  it("filters by source type", () => {
    expect(filterNews(rows, { sourceTypes: ["trade"] }).map((r) => r.id)).toEqual(["a"]);
    expect(filterNews(rows, { sourceTypes: ["blog", "news"] }).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("filters by derived topic", () => {
    expect(filterNews(rows, { topics: ["vendor-exit"] }).map((r) => r.id)).toEqual(["b"]);
  });

  it("intersects every active filter rather than unioning them", () => {
    expect(filterNews(rows, { query: "closure", sourceTypes: ["trade"] })).toEqual([]);
  });

  it("returns everything when no filter is set", () => {
    expect(filterNews(rows, {}).length).toBe(3);
  });
});

// The lead slot is the biggest headline on the site. These pin the one rule that keeps an
// unconfirmed community post out of it — see `leadFirst`.
describe("leadFirst", () => {
  const trade = row({ id: "t", source_type: "trade", title: "DOJ guilty plea", news_date: "2026-05-01" });
  const news = row({ id: "n", source_type: "news", title: "FDA warns sellers", news_date: "2026-04-01" });
  const forum = row({ id: "f", source_type: "forum", title: "Reddit says a vendor is fake", news_date: "2026-06-01" });
  const blog = row({ id: "b", source_type: "blog", title: "Tracker roundup", news_date: "2026-05-15" });

  it("leaves a feed alone when the newest record is already a primary document", () => {
    expect(leadFirst([trade, forum, blog]).map((r) => r.id)).toEqual(["t", "f", "b"]);
  });

  it("promotes the newest credible record over a newer forum post", () => {
    // Chronologically the forum post is newest. It must not get the lead headline.
    expect(leadFirst([forum, blog, trade, news]).map((r) => r.id)).toEqual(["t", "f", "b", "n"]);
  });

  it("keeps everything else in chronological order behind the lead", () => {
    const ordered = leadFirst([forum, blog, news, trade]);
    expect(ordered.map((r) => r.id)).toEqual(["n", "f", "b", "t"]);
  });

  it("leads with the newest record when the reader has filtered to forums only", () => {
    // Nothing to over-amplify: this view is exactly what was asked for.
    const forums = [forum, row({ id: "f2", source_type: "forum", news_date: "2026-03-01" })];
    expect(leadFirst(forums).map((r) => r.id)).toEqual(["f", "f2"]);
  });

  it("handles an empty and a single-record feed", () => {
    expect(leadFirst([])).toEqual([]);
    expect(leadFirst([forum]).map((r) => r.id)).toEqual(["f"]);
  });
});
