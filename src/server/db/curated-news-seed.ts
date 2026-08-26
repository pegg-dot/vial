// Put the curated news baseline into every database that boots.
//
// WHY: /news read an empty table on any fresh environment. The curated baseline in
// `src/server/data/news-items.json` reached a database only two ways — `scripts/ingest-external-data.mjs`
// run by hand, or the FDA collector's next 12-hourly tick — so a new deployment published a
// "News & enforcement" page that said "No news on record yet" until someone remembered the errand.
// The DOJ guilty plea and the FDA warning letters are among the most load-bearing records on the
// site; they should not depend on an operator's memory. This is the same lesson, and the same
// mechanism, as `compound-literature-seed.ts` — see the long note at the top of that file.
//
// CONTENT-ADDRESSED, not a numbered migration: editing the JSON must be sufficient to change the
// next deployment. A migration runs once and would silently strand every later edit.
//
// SAFETY: this runs on the boot path, where a throw takes the application down. `recordNewsItem` is
// ON CONFLICT (source_url, title) DO UPDATE, so re-running is a no-op; each record is isolated and
// the whole pass is wrapped, so no data problem can stop a deployment from starting.
//
// It does NOT collect anything. These are curated rows already in the repository, not live fetches,
// so it is unrelated to VIALGRADE_LIVE_INGEST_APPROVED, which gates reaching out to third parties.
import { createHash } from "node:crypto";
import type { SqlConnection } from "@/server/db/client";
import { curatedNews } from "@/server/collect/news";
import { recordNewsItem } from "@/server/external/repository";

function contentHash() {
  return createHash("sha256").update(JSON.stringify(curatedNews())).digest("hex").slice(0, 16);
}

export async function ensureCuratedNews(db: SqlConnection): Promise<void> {
  try {
    const hash = contentHash();
    const stored = (await db.query<{ value: { hash?: string } }>(
      `SELECT value FROM app_meta WHERE key='curated_news_hash'`,
    )).rows[0]?.value;
    if (stored?.hash === hash) return;

    const items = curatedNews();
    for (const item of items) {
      try { await recordNewsItem(db, item); } catch (error) { console.error("[curated-news] skipped one record:", error); }
    }
    await db.query(
      `INSERT INTO app_meta(key,value,updated_at) VALUES('curated_news_hash',$1::jsonb,NOW())
       ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
      [JSON.stringify({ hash, seededAt: new Date().toISOString() })],
    );
    console.log(`[curated-news] seeded ${items.length} news records (${hash})`);
  } catch (error) {
    // Never block a boot over reference data.
    console.error("[curated-news] seed skipped:", error);
  }
}
