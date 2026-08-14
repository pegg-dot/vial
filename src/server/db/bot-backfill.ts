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
  const clicks = await db.query(
    `UPDATE outbound_clicks SET is_bot = TRUE WHERE visitor_hash IS NULL AND NOT is_bot`,
  );
  const views = await db.query(
    `UPDATE page_views SET is_bot = TRUE WHERE visitor_hash IS NULL AND NOT is_bot`,
  );
  return { clicks: clicks.rowCount ?? 0, views: views.rowCount ?? 0 };
}
