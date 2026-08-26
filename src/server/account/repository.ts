import { getDatabase } from "@/server/db/client";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/server/notifications/policy";

/**
 * The value that is safe to put in `user_notification_preferences.relevance_threshold`.
 *
 * WHY: this used to be a bare `Number(input.relevanceThreshold ?? 0.45)`, so `"high"` was written
 * as NaN. NUMERIC(5,4) stores 'NaN' happily and Postgres sorts NaN ABOVE every other numeric, so
 * `relevance_score >= COALESCE(p.relevance_threshold,0)` matched nothing and the reader's inbox was
 * empty forever, while the policy's `relevance >= NaN` held push false forever. Neither surface
 * reported anything, and nothing in the UI could undo it.
 *
 * The API validates this too, but the API is not the only possible caller and this one column now
 * gates TWO independent suppression paths — so it is refused here as well. Non-finite falls back to
 * the documented default; a finite but out-of-range value is clamped, which also keeps it inside
 * what NUMERIC(5,4) can represent at all (>= 10 would raise a numeric overflow instead of storing).
 *
 * A bare `Number(value)` is NOT enough to decide "is this a number": `Number([])` is 0 and
 * `Number(true)` is 1, so `{"relevanceThreshold":true}` would have quietly set the floor to 1.0 and
 * emptied the inbox exactly as thoroughly as NaN did. Only a number, or a non-empty string that
 * parses to one, counts — the string case is real, because NUMERIC comes back out of Postgres as a
 * string and a caller may hand a read row straight back.
 */
function persistableRelevanceThreshold(value:unknown){
  const numeric=typeof value==="number"?value
    :typeof value==="string"&&value.trim()!==""?Number(value)
    :value===undefined||value===null?DEFAULT_NOTIFICATION_PREFERENCES.relevanceThreshold
    :NaN;
  if(!Number.isFinite(numeric))return DEFAULT_NOTIFICATION_PREFERENCES.relevanceThreshold;
  return Math.min(1,Math.max(0,numeric));
}

export async function getWatchlistSlugs(userId:string){const db=await getDatabase();return(await db.query<{listing_slug:string}>(`SELECT listing_slug FROM user_watchlists WHERE user_id=$1 ORDER BY created_at DESC`,[userId])).rows.map(r=>r.listing_slug)}
export async function setWatchlistItem(userId:string,slug:string,watched:boolean){const db=await getDatabase();if(watched)await db.query(`INSERT INTO user_watchlists(user_id,listing_slug) VALUES($1,$2) ON CONFLICT DO NOTHING`,[userId,slug]);else await db.query(`DELETE FROM user_watchlists WHERE user_id=$1 AND listing_slug=$2`,[userId,slug]);return getWatchlistSlugs(userId)}
export async function getNotificationPreferences(userId:string){const db=await getDatabase();return(await db.query(`SELECT * FROM user_notification_preferences WHERE user_id=$1`,[userId])).rows[0]??null}
export async function updateNotificationPreferences(userId:string,input:Record<string,unknown>){const db=await getDatabase();await db.query(`INSERT INTO user_notification_preferences(user_id,in_app_enabled,email_enabled,price_alerts,evidence_alerts,order_alerts,digest_frequency,saved_search_alerts,followed_entity_alerts,market_digest,quiet_hours_start,quiet_hours_end,timezone,relevance_threshold,availability_alerts,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW()) ON CONFLICT(user_id) DO UPDATE SET in_app_enabled=EXCLUDED.in_app_enabled,email_enabled=EXCLUDED.email_enabled,price_alerts=EXCLUDED.price_alerts,evidence_alerts=EXCLUDED.evidence_alerts,order_alerts=EXCLUDED.order_alerts,digest_frequency=EXCLUDED.digest_frequency,saved_search_alerts=EXCLUDED.saved_search_alerts,followed_entity_alerts=EXCLUDED.followed_entity_alerts,market_digest=EXCLUDED.market_digest,quiet_hours_start=EXCLUDED.quiet_hours_start,quiet_hours_end=EXCLUDED.quiet_hours_end,timezone=EXCLUDED.timezone,relevance_threshold=EXCLUDED.relevance_threshold,availability_alerts=EXCLUDED.availability_alerts,updated_at=NOW()`,[userId,Boolean(input.inAppEnabled),Boolean(input.emailEnabled),Boolean(input.priceAlerts),Boolean(input.evidenceAlerts),Boolean(input.orderAlerts),String(input.digestFrequency||"instant"),Boolean(input.savedSearchAlerts??true),Boolean(input.followedEntityAlerts??true),Boolean(input.marketDigest??true),String(input.quietHoursStart||"22:00"),String(input.quietHoursEnd||"08:00"),String(input.timezone||"America/New_York"),persistableRelevanceThreshold(input.relevanceThreshold),Boolean(input.availabilityAlerts??true)]);return getNotificationPreferences(userId)}
