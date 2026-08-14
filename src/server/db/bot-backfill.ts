import type { SqlConnection } from "./client";
import { attributionSchemaSql } from "./attribution-schema";
import { pageviewsSchemaSql } from "./pageviews-schema";

/**
 * Adds the is_bot columns and retro-classifies what was already recorded.
 *
 * Clicks logged before visitor tracking existed have no user-agent and no address, so they cannot
 * be attributed to a person — and they were the bulk of a "676 buyers sent" figure that resolved to
 * "1 distinct person". They are marked as bots rather than deleted: the rows are still evidence the
 * handoff works, they just must never appear in a number shown to a vendor.
 */
export async function backfillBotFlags(db: SqlConnection): Promise<{ clicks: number; views: number }> {
  for (const statement of `${attributionSchemaSql}\n${pageviewsSchemaSql}`.split(";").map(s => s.trim()).filter(Boolean)) {
    await db.query(`${statement};`);
  }
  // CREATE TABLE IF NOT EXISTS is a NO-OP on a table that already exists, so a column added inside
  // that statement is never created on a live database — which took production down with
  // 'column "is_bot" does not exist'. New columns on an existing table need an explicit ALTER.
  await db.query(`ALTER TABLE page_views ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE outbound_clicks ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE`);
  const clicks = await db.query(
    `UPDATE outbound_clicks SET is_bot = TRUE WHERE visitor_hash IS NULL AND NOT is_bot`,
  );
  const views = await db.query(
    `UPDATE page_views SET is_bot = TRUE WHERE visitor_hash IS NULL AND NOT is_bot`,
  );
  return { clicks: clicks.rowCount ?? 0, views: views.rowCount ?? 0 };
}
