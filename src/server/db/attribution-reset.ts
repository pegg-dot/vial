import type { SqlConnection } from "./client";

/**
 * Excludes every click and view recorded before bot detection existed.
 *
 * Those rows carry no user-agent, so there is no way to tell retroactively whether a click was a
 * person or a crawler — and the evidence says mostly crawler: 721 clicks resolving to 2 distinct
 * visitors is not two very enthusiastic shoppers.
 *
 * A number we cannot stand behind is worth less than no number. The first thing a vendor does with
 * "we sent you 721 buyers" is check their own analytics, and an inflated figure ends the
 * conversation permanently. So the historical rows are marked as bots — kept as evidence the
 * handoff works, excluded from anything we would say out loud — and the counter starts clean from
 * the moment we could actually distinguish a person.
 */
export async function resetUnverifiableAttribution(db: SqlConnection): Promise<{ clicks: number; views: number }> {
  const clicks = await db.query(
    `UPDATE outbound_clicks SET is_bot = TRUE
     WHERE NOT is_bot AND created_at < (SELECT COALESCE(MAX(applied_at), NOW()) FROM schema_migrations WHERE version = 39)`,
  );
  const views = await db.query(
    `UPDATE page_views SET is_bot = TRUE
     WHERE NOT is_bot AND created_at < (SELECT COALESCE(MAX(applied_at), NOW()) FROM schema_migrations WHERE version = 39)`,
  );
  return { clicks: clicks.rowCount ?? 0, views: views.rowCount ?? 0 };
}
