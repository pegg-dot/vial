// End-to-end coverage for the news + enforcement collectors against a real database.
//
// `safeFetch` is mocked so no test touches the network — and mocking THAT specific module is
// deliberate: if a collector ever reached for a bare `fetch()`, these tests would silently start
// making real requests instead of receiving the fixture, and the allowlist assertions below would
// have nothing to assert on.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const safeFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/server/refresh/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/refresh/safe-fetch")>()),
  safeFetch: safeFetchMock,
}));

import { getDatabase, resetDatabaseForTests, type SqlConnection } from "@/server/db/client";
import { upsertLiveVendor } from "@/server/ingest/live-sources";
import { collectEnforcement, curatedActions, OPENFDA_HOSTNAMES } from "@/server/collect/enforcement";
import { collectNews, curatedNews, NEWS_FEEDS, NEWS_HOSTNAMES } from "@/server/collect/news";
import { CADENCE_MINUTES, syncCollectionTargets, runCollectionTick } from "@/server/collect/scheduler";
import { listRegulatoryActions, getVendorRegulatoryActions } from "@/server/regulatory/repository";
import { listNews } from "@/server/external/repository";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "intelligence-test-secret-at-least-32-characters-long";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "intelligence-test-privacy-secret-at-least-32-chars";

// ── fixtures (real payload shapes) ───────────────────────────────────────────────────────────────

const OPENFDA_PAYLOAD = {
  meta: { results: { skip: 0, limit: 1000, total: 3 } },
  results: [
    {
      status: "Ongoing", city: "Englewood", state: "CO", country: "United States",
      classification: "Class II", product_type: "Drugs", event_id: "96742",
      recalling_firm: "Thrive Health and Wellness, LLC, dba Thrive Health Solutions (Colorado)",
      voluntary_mandated: "Voluntary: Firm initiated", distribution_pattern: "USA Nationwide",
      recall_number: "D-0484-2025",
      product_description: "Tirzepatide Injections, 30mg/mL, pre-filled syringe, Thrive Health Solutions, Englewood, CO 80112",
      reason_for_recall: "Lack of Assurance of Sterility",
      recall_initiation_date: "20250521", report_date: "20250702",
    },
    {
      status: "Terminated", city: "Exton", state: "PA", country: "United States",
      classification: "Class II", product_type: "Drugs", event_id: "97001",
      recalling_firm: "ProRx LLC", voluntary_mandated: "Voluntary: Firm initiated",
      distribution_pattern: "Nationwide", recall_number: "D-0115-2026",
      product_description: "Semaglutide Injection, 10 mg/4 mL (2.5 mg/mL), 4mL Multidose Vial, For Subcutaneous Use, Rx Only",
      reason_for_recall: "Subpotent Drug",
      recall_initiation_date: "20251015", report_date: "20251029",
    },
    // A record with a name that EXACTLY matches a tracked vendor — attribution must fire here, and
    // only here.
    {
      status: "Ongoing", classification: "Class I", product_type: "Drugs", event_id: "97500",
      recalling_firm: "Swiss Chems", recall_number: "D-0900-2026",
      product_description: "Retatrutide, research vial",
      reason_for_recall: "Unapproved new drug",
      recall_initiation_date: "20260210",
    },
  ],
};

const FDA_RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
<item>
  <title>FDA Issues Emergency Use Authorization for Drug to Treat New World Screwworm in Dogs</title>
  <link>http://www.fda.gov/news-events/press-announcements/eua-screwworm</link>
  <description>An Emergency Use Authorization for the treatment of screwworm infestations in dogs.</description>
  <pubDate>Thu, 13 Aug 2026 13:02:58 EDT</pubDate>
</item>
<item>
  <title>FDA Warns Consumers Not to Use Compounded Semaglutide from Unregistered Sellers</title>
  <link>http://www.fda.gov/news-events/press-announcements/compounded-semaglutide-warning</link>
  <description>The agency warned about compounded semaglutide sold by facilities that are not registered outsourcing facilities, including products marketed as &amp;quot;research chemicals&amp;quot;.</description>
  <pubDate>Tue, 04 Aug 2026 09:00:00 EDT</pubDate>
</item>
<item>
  <title>FDA Cites Peptide Seller Over Unapproved New Drug Claims</title>
  <link>http://www.fda.gov/news-events/press-announcements/peptide-seller-citation</link>
  <description>The agency cited swisschems.is for marketing retatrutide as an unapproved new drug.</description>
  <pubDate>Mon, 03 Aug 2026 09:00:00 EDT</pubDate>
</item>
</channel></rss>`;

function fetchResult(body: string, contentType: string) {
  return { url: "https://example.test/", status: 200, contentType, body, bytes: Buffer.byteLength(body), resolvedIp: "203.0.113.9", notModified: false, redirects: [] };
}

const okOpenFda = () => fetchResult(JSON.stringify(OPENFDA_PAYLOAD), "application/json");
const okRss = () => fetchResult(FDA_RSS, "application/rss+xml");

async function count(db: SqlConnection, table: string): Promise<number> {
  return Number((await db.query<{ c: string | number }>(`SELECT COUNT(*) c FROM ${table}`)).rows[0]!.c);
}

// ── setup ────────────────────────────────────────────────────────────────────────────────────────

let db: SqlConnection;

beforeAll(async () => {
  await resetDatabaseForTests();
  db = await getDatabase();
  await upsertLiveVendor(db, { slug: "swiss-chems", name: "Swiss Chems", domains: ["swisschems.is"], description: "t" });
  await upsertLiveVendor(db, { slug: "paradigm-peptides", name: "Paradigm Peptides", domains: ["paradigmpeptides.com"], description: "t" });
});
afterAll(async () => { await resetDatabaseForTests(); });
beforeEach(() => { safeFetchMock.mockReset(); });

// ── enforcement ──────────────────────────────────────────────────────────────────────────────────

describe("enforcement collection from openFDA", () => {
  it("fetches ONLY through safeFetch with an explicit hostname allowlist", async () => {
    safeFetchMock.mockResolvedValue(okOpenFda());
    await collectEnforcement(db, { terms: ["semaglutide", "tirzepatide"], includeCurated: false });

    expect(safeFetchMock).toHaveBeenCalled();
    for (const [url, options] of safeFetchMock.mock.calls) {
      expect(new URL(url as string).hostname).toBe("api.fda.gov");
      const opts = options as { allowedHostnames: string[]; allowedContentTypes: string[]; timeoutMs: number; maxResponseBytes: number };
      expect(opts.allowedHostnames).toEqual(OPENFDA_HOSTNAMES);
      expect(opts.allowedContentTypes).toEqual(["application/json"]);
      expect(opts.timeoutMs).toBeGreaterThan(0);
      expect(opts.maxResponseBytes).toBeGreaterThan(0);
    }
  });

  it("writes real openFDA recalls into regulatory_actions", async () => {
    safeFetchMock.mockResolvedValue(okOpenFda());
    const result = await collectEnforcement(db, { terms: ["semaglutide", "tirzepatide"], includeCurated: false });
    expect(result.ok).toBe(true);
    expect(result.items).toBe(3);

    const rows = (await db.query<{ subject_name: string; action_type: string; agency: string; severity: string; action_date: string | null; source_url: string; is_primary_source: boolean }>(
      `SELECT subject_name, action_type, agency, severity, action_date, source_url, is_primary_source FROM regulatory_actions WHERE source_url LIKE '%api.fda.gov%' ORDER BY subject_name`,
    )).rows;
    expect(rows).toHaveLength(3);
    const prorx = rows.find((r) => r.subject_name === "ProRx LLC")!;
    expect(prorx.action_type).toBe("recall");
    expect(prorx.agency).toBe("FDA");
    expect(prorx.severity).toBe("caution"); // a recall is never "severe"
    expect(prorx.action_date).toBe("2025-10-15");
    expect(prorx.is_primary_source).toBe(true);
    expect(prorx.source_url).toContain("D-0115-2026");
  });

  it("stores an unmatched company WITHOUT attributing it to a vendor, but still shows it market-wide", async () => {
    safeFetchMock.mockResolvedValue(okOpenFda());
    await collectEnforcement(db, { terms: ["semaglutide", "tirzepatide"], includeCurated: false });

    const unmatched = (await db.query<{ vendor_slug: string | null; match_confidence: string }>(
      `SELECT vendor_slug, match_confidence FROM regulatory_actions WHERE subject_name LIKE 'Thrive Health%'`,
    )).rows[0]!;
    expect(unmatched.vendor_slug).toBeNull();
    expect(unmatched.match_confidence).toBe("none");

    // It is real market intelligence, so it must still appear in the market-wide feed.
    const feed = await listRegulatoryActions(db, 500);
    expect(feed.some((f) => f.subject_name.startsWith("Thrive Health"))).toBe(true);

    // And it must NOT appear on any vendor's page.
    for (const slug of ["swiss-chems", "paradigm-peptides"]) {
      const forVendor = await getVendorRegulatoryActions(slug, db);
      expect(forVendor.some((r) => r.subject_name.startsWith("Thrive Health"))).toBe(false);
    }
  });

  it("still attributes on an exact name match, so strictness is not just 'never match'", async () => {
    safeFetchMock.mockResolvedValue(okOpenFda());
    await collectEnforcement(db, { terms: ["semaglutide", "tirzepatide"], includeCurated: false });
    const rows = await getVendorRegulatoryActions("swiss-chems", db);
    const matched = rows.find((r) => r.source_url.includes("D-0900-2026"))!;
    expect(matched).toBeDefined();
    expect(matched.match_confidence).toBe("high");
  });

  it("is idempotent — re-running does not duplicate a single row", async () => {
    safeFetchMock.mockResolvedValue(okOpenFda());
    await collectEnforcement(db, { terms: ["semaglutide", "tirzepatide"] });
    const afterFirst = await count(db, "regulatory_actions");
    expect(afterFirst).toBeGreaterThanOrEqual(curatedActions().length);

    await collectEnforcement(db, { terms: ["semaglutide", "tirzepatide"] });
    await collectEnforcement(db, { terms: ["semaglutide", "tirzepatide"] });
    expect(await count(db, "regulatory_actions")).toBe(afterFirst);
  });

  it("records a failed fetch as not-ok rather than throwing", async () => {
    safeFetchMock.mockRejectedValue(new Error("Source returned HTTP 503"));
    const result = await collectEnforcement(db, { terms: ["semaglutide"], includeCurated: false });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("openFDA unreachable");
    expect(result.items).toBe(0);
  });

  it("reports not-ok when the source answers with nothing", async () => {
    safeFetchMock.mockResolvedValue(fetchResult(JSON.stringify({ meta: {}, results: [] }), "application/json"));
    const result = await collectEnforcement(db, { terms: ["semaglutide"], includeCurated: false });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no enforcement records/i);
  });

  it("keeps the bundled baseline even when the live source is dead", async () => {
    await db.query(`DELETE FROM regulatory_actions`);
    safeFetchMock.mockRejectedValue(new Error("network-error"));
    const result = await collectEnforcement(db, { terms: ["semaglutide"] });
    expect(result.ok).toBe(false);
    // The curated records are static-imported, so a dead API cannot empty /enforcement.
    expect(await count(db, "regulatory_actions")).toBe(curatedActions().length);
  });

  it("does not lose the batches that worked when one batch fails", async () => {
    await db.query(`DELETE FROM regulatory_actions`);
    safeFetchMock
      .mockRejectedValueOnce(new Error("Source request timed out"))
      .mockResolvedValueOnce(okOpenFda());
    // 24 terms over a batch size of 12 = two requests: one dead, one good.
    const terms = Array.from({ length: 24 }, (_, i) => `compound${String(i).padStart(3, "0")}`);
    const result = await collectEnforcement(db, { terms, includeCurated: false });
    expect(result.ok).toBe(true);
    expect(result.items).toBe(3);
  });
});

// ── news ─────────────────────────────────────────────────────────────────────────────────────────

describe("news collection from FDA feeds", () => {
  it("fetches ONLY through safeFetch with an explicit hostname allowlist", async () => {
    safeFetchMock.mockResolvedValue(okRss());
    await collectNews(db, { includeCurated: false });
    expect(safeFetchMock).toHaveBeenCalledTimes(NEWS_FEEDS.length);
    for (const [url, options] of safeFetchMock.mock.calls) {
      expect(NEWS_HOSTNAMES).toContain(new URL(url as string).hostname);
      const opts = options as { allowedHostnames: string[]; allowedContentTypes: string[] };
      expect(opts.allowedHostnames).toEqual(NEWS_HOSTNAMES);
      expect(opts.allowedContentTypes).toContain("application/rss+xml");
    }
  });

  it("stores market-relevant items and drops unrelated government news", async () => {
    await db.query(`DELETE FROM news_items`);
    safeFetchMock.mockResolvedValue(okRss());
    const result = await collectNews(db, { includeCurated: false, compoundTerms: ["semaglutide", "retatrutide"] });
    expect(result.ok).toBe(true);

    const items = await listNews(db, 200);
    expect(items.some((i) => i.title.includes("Compounded Semaglutide"))).toBe(true);
    // The screwworm authorization is real FDA news but has nothing to do with this market.
    expect(items.some((i) => i.title.includes("Screwworm"))).toBe(false);
  });

  it("normalizes the stored source link to https on an allowlisted host", async () => {
    await db.query(`DELETE FROM news_items`);
    safeFetchMock.mockResolvedValue(okRss());
    await collectNews(db, { includeCurated: false, compoundTerms: ["semaglutide"] });
    for (const item of await listNews(db, 200)) {
      const url = new URL(item.source_url);
      expect(url.protocol).toBe("https:");
      expect(NEWS_HOSTNAMES).toContain(url.hostname);
    }
  });

  it("attributes an item to a vendor only when the article cites that vendor's domain", async () => {
    await db.query(`DELETE FROM news_items`);
    safeFetchMock.mockResolvedValue(okRss());
    await collectNews(db, { includeCurated: false, compoundTerms: ["semaglutide", "retatrutide"] });
    const items = await listNews(db, 200);
    expect(items.find((i) => i.title.includes("Peptide Seller"))!.vendor_slug).toBe("swiss-chems");
    expect(items.find((i) => i.title.includes("Compounded Semaglutide"))!.vendor_slug).toBeNull();
  });

  it("is idempotent — re-running does not duplicate a single row", async () => {
    await db.query(`DELETE FROM news_items`);
    safeFetchMock.mockResolvedValue(okRss());
    await collectNews(db, { compoundTerms: ["semaglutide", "retatrutide"] });
    const afterFirst = await count(db, "news_items");
    expect(afterFirst).toBeGreaterThanOrEqual(curatedNews().length);

    safeFetchMock.mockResolvedValue(okRss());
    await collectNews(db, { compoundTerms: ["semaglutide", "retatrutide"] });
    await collectNews(db, { compoundTerms: ["semaglutide", "retatrutide"] });
    expect(await count(db, "news_items")).toBe(afterFirst);
  });

  it("records a total feed failure as not-ok rather than throwing", async () => {
    safeFetchMock.mockRejectedValue(new Error("Source returned HTTP 403"));
    const result = await collectNews(db, { includeCurated: false });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("all news feeds failed");
  });

  it("reports not-ok when every feed parses but nothing is relevant", async () => {
    const irrelevant = `<rss><channel><item><title>FDA Approves New Melanoma Immunotherapy</title><link>https://www.fda.gov/x</link><description>Accelerated approval.</description><pubDate>Tue, 04 Aug 2026 09:00:00 EDT</pubDate></item></channel></rss>`;
    safeFetchMock.mockResolvedValue(fetchResult(irrelevant, "application/rss+xml"));
    const result = await collectNews(db, { includeCurated: false, compoundTerms: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no market-relevant items/i);
  });

  it("keeps the bundled baseline even when every feed is dead — /news is never empty again", async () => {
    await db.query(`DELETE FROM news_items`);
    safeFetchMock.mockRejectedValue(new Error("Source returned HTTP 403"));
    const result = await collectNews(db);
    expect(result.ok).toBe(false);
    expect(await count(db, "news_items")).toBe(curatedNews().length);
    expect((await listNews(db, 200)).length).toBeGreaterThan(0);
  });
});

// ── queue registration ───────────────────────────────────────────────────────────────────────────

describe("both collectors are registered in the continuous queue", () => {
  it("enqueues one market-wide target each, at the intended cadence", async () => {
    await syncCollectionTargets(db);
    const rows = (await db.query<{ id: string; collector: string; target: string; cadence_minutes: number }>(
      `SELECT id, collector, target, cadence_minutes FROM collection_targets WHERE collector IN ('enforcement-openfda','news-feeds') ORDER BY collector`,
    )).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "ct:enforcement-openfda:market", collector: "enforcement-openfda", target: "market", cadence_minutes: CADENCE_MINUTES["enforcement-openfda"] });
    expect(rows[1]).toMatchObject({ id: "ct:news-feeds:market", collector: "news-feeds", target: "market", cadence_minutes: CADENCE_MINUTES["news-feeds"] });
    expect(CADENCE_MINUTES["enforcement-openfda"]).toBe(24 * 60);
    expect(CADENCE_MINUTES["news-feeds"]).toBe(12 * 60);
  });

  it("stays idempotent across repeated syncs", async () => {
    await syncCollectionTargets(db);
    const before = await count(db, "collection_targets");
    await syncCollectionTargets(db);
    await syncCollectionTargets(db);
    expect(await count(db, "collection_targets")).toBe(before);
  });

  it("runs both through a real tick and records the run", async () => {
    await syncCollectionTargets(db);
    // Only the two market collectors may run — the per-vendor ones probe live storefronts.
    await db.query(`UPDATE collection_targets SET enabled=FALSE WHERE collector NOT IN ('enforcement-openfda','news-feeds')`);
    await db.query(`UPDATE collection_targets SET next_due_at=NOW() - interval '1 hour' WHERE collector IN ('enforcement-openfda','news-feeds')`);
    await db.query(`DELETE FROM collector_runs`);

    safeFetchMock.mockImplementation(async (url: string) =>
      url.includes("api.fda.gov") ? okOpenFda() : okRss());

    const tick = await runCollectionTick({ connection: db, budgetMs: 20_000, maxTargets: 8 });
    const kinds = tick.ran.map((r) => r.collector).sort();
    expect(kinds).toEqual(["enforcement-openfda", "news-feeds"]);
    for (const run of tick.ran) {
      expect(run.ok, `${run.collector}: ${run.error ?? ""}`).toBe(true);
      expect(run.target).toBe("market");
      expect(run.items).toBeGreaterThan(0);
    }

    const runs = (await db.query<{ collector: string; ok: boolean; items: string | number }>(
      `SELECT collector, ok, items FROM collector_runs ORDER BY collector`,
    )).rows;
    expect(runs.map((r) => r.collector)).toEqual(["enforcement-openfda", "news-feeds"]);
    for (const r of runs) expect(r.ok).toBe(true);
  });

  it("a dead source settles the target as failed and RECORDS a not-ok run — it never throws", async () => {
    await syncCollectionTargets(db);
    await db.query(`UPDATE collection_targets SET enabled=FALSE WHERE collector NOT IN ('enforcement-openfda','news-feeds')`);
    await db.query(`UPDATE collection_targets SET enabled=TRUE, consecutive_failures=0, next_due_at=NOW() - interval '1 hour' WHERE collector IN ('enforcement-openfda','news-feeds')`);
    await db.query(`DELETE FROM collector_runs`);

    safeFetchMock.mockRejectedValue(new Error("Source returned HTTP 503"));

    // The whole point: a government API being down is not an exception.
    const tick = await runCollectionTick({ connection: db, budgetMs: 20_000, maxTargets: 8 });
    expect(tick.ran).toHaveLength(2);
    for (const run of tick.ran) {
      expect(run.ok).toBe(false);
      expect(run.error).toBeTruthy();
    }

    const runs = (await db.query<{ collector: string; ok: boolean }>(`SELECT collector, ok FROM collector_runs ORDER BY collector`)).rows;
    expect(runs).toHaveLength(2);
    for (const r of runs) expect(r.ok).toBe(false);

    // The queue backed the target off instead of hammering a dead host every tick.
    const targets = (await db.query<{ consecutive_failures: number; last_ok: boolean; last_error: string | null; next_due_at: string }>(
      `SELECT consecutive_failures, last_ok, last_error, next_due_at FROM collection_targets WHERE collector IN ('enforcement-openfda','news-feeds')`,
    )).rows;
    for (const t of targets) {
      expect(Number(t.consecutive_failures)).toBe(1);
      expect(t.last_ok).toBe(false);
      expect(t.last_error).toBeTruthy();
      expect(new Date(t.next_due_at).getTime()).toBeGreaterThan(Date.now());
    }
  });
});
