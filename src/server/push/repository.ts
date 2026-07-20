import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

export interface StoredPushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface BrowserPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// One subscription per endpoint. Re-subscribing rebinds it to the current user — a
// device can only ever belong to whoever is signed in on it.
export async function saveSubscription(userId: string, sub: BrowserPushSubscription, userAgent = "", connection?: SqlConnection): Promise<void> {
  const db = connection ?? (await getDatabase());
  await db.query(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent, last_seen_at = NOW()`,
    [newId("push"), userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent],
  );
}

export async function getSubscriptionsForUser(userId: string, connection?: SqlConnection): Promise<StoredPushSubscription[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<StoredPushSubscription>(`SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, [userId])).rows;
}

export async function deleteByEndpoint(endpoint: string, connection?: SqlConnection): Promise<void> {
  const db = connection ?? (await getDatabase());
  await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

// Scoped removal — a user can only unsubscribe their own device.
export async function removeSubscriptionForUser(userId: string, endpoint: string, connection?: SqlConnection): Promise<void> {
  const db = connection ?? (await getDatabase());
  await db.query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint]);
}
