// Retire listings that are the same product scraped twice.
//
// Some storefronts expose one product under several URLs or variant paths, and the importer stored
// each as its own listing. Where two rows share the SAME external URL, the SAME price and the SAME
// product name, they are not two things to choose between — they are one thing counted twice. That
// inflates a vendor's listing count, a compound's listing count, and skews the median price the
// market pages publish.
//
// WHICH ONE SURVIVES, decided by a rule rather than by taste: keep the row whose declared quantity
// actually parses to a weight. `parseTotalMg` turns "5MG" into 5 and "1 vial" into nothing, and it
// is what feeds pricePerMg and therefore compoundMedianPerMg. A row that cannot be priced per mg
// contributes no comparison — so between identical twins, the one that can be measured is kept.
// Ties fall back to the shorter slug and then the lower id, so the outcome is deterministic and a
// re-run cannot flip its mind.
//
// Retired, never deleted — same as the wrong-molecule repair. Status off 'active' removes the row
// from every catalog query while keeping what was scraped on record and the decision reversible.
//
// ⚠️ COST, because getting this wrong took production down once today: this runs on the boot path,
// so it is deliberately TWO round trips regardless of how many duplicates exist — one SELECT to
// find them, one UPDATE to retire them. The per-row decision happens in memory. The failure earlier
// was a boot task that made several queries PER VENDOR over a networked database; this makes a
// fixed number of queries no matter the data size.
import type { SqlConnection } from "./client";
import { parseTotalMg } from "@/lib/format";

interface Row { id: string; slug: string; external_url: string; price: string | number; name: string; declared_quantity: string; product_id: string }

export async function retireDuplicateListings(db: SqlConnection): Promise<void> {
  try {
    const rows = (await db.query<Row>(
      `SELECT l.id, l.slug, l.external_url, l.price, p.name, p.declared_quantity, p.id AS product_id
         FROM listings l JOIN products p ON p.id = l.product_id
        WHERE p.status = 'active' AND COALESCE(l.external_url, '') <> ''`,
    )).rows;

    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const key = `${r.external_url}|${Number(r.price)}|${r.name}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(r);
      else groups.set(key, [r]);
    }

    const retire: string[] = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const ranked = [...group].sort((a, b) => {
        const am = parseTotalMg(a.declared_quantity) != null ? 0 : 1;
        const bm = parseTotalMg(b.declared_quantity) != null ? 0 : 1;
        if (am !== bm) return am - bm;                       // measurable wins
        if (a.slug.length !== b.slug.length) return a.slug.length - b.slug.length;
        return a.id < b.id ? -1 : 1;                         // stable, so re-runs agree
      });
      for (const loser of ranked.slice(1)) retire.push(loser.product_id);
    }
    if (retire.length === 0) return;

    await db.query(
      `UPDATE products SET status = 'retired-duplicate' WHERE id = ANY($1::text[]) AND status = 'active'`,
      [retire],
    );
    console.log(`[duplicate-listings] retired ${retire.length}`);
  } catch (error) {
    // Directory hygiene must never stop the application starting.
    console.error("[duplicate-listings] skipped:", error);
  }
}
