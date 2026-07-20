import type { SqlConnection } from "@/server/db/client";
import { getVapidConfig } from "./vapid";
import { deleteByEndpoint, getSubscriptionsForUser, type StoredPushSubscription } from "./repository";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Narrow seam over web-push so tests inject a deterministic sender (no network, no key).
// A sender resolves for a delivered push, or throws an error carrying `statusCode` for a
// rejected one — matching how web-push's sendNotification behaves.
export interface PushSender {
  send(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string): Promise<{ statusCode: number }>;
}

export interface DeliveryResult {
  sent: number;
  pruned: number;
  skipped?: string;
}

function isGone(statusCode: number): boolean {
  return statusCode === 404 || statusCode === 410;
}

// Best-effort delivery to every device the user has registered. Prunes a subscription
// the push service reports as gone (404/410). No-ops when VAPID is unconfigured, and
// never throws — a delivery failure must never break notification creation upstream.
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  opts: { sender?: PushSender; db?: SqlConnection } = {},
): Promise<DeliveryResult> {
  const vapid = getVapidConfig();
  if (!vapid) return { sent: 0, pruned: 0, skipped: "vapid-unset" };

  const subscriptions = await getSubscriptionsForUser(userId, opts.db);
  const sender = opts.sender ?? (await createWebPushSender());
  const body = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;

  for (const subscription of subscriptions) {
    try {
      const result = await sender.send(toPushTarget(subscription), body);
      if (isGone(result.statusCode)) {
        await deleteByEndpoint(subscription.endpoint, opts.db);
        pruned += 1;
      } else {
        sent += 1;
      }
    } catch (error) {
      const statusCode = error && typeof error === "object" && "statusCode" in error ? Number((error as { statusCode: unknown }).statusCode) : 0;
      if (isGone(statusCode)) {
        await deleteByEndpoint(subscription.endpoint, opts.db);
        pruned += 1;
      }
      // Any other error (transient network, 5xx) is swallowed — best-effort.
    }
  }
  return { sent, pruned };
}

function toPushTarget(subscription: StoredPushSubscription) {
  return { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } };
}

// The real sender, wired to web-push with the configured VAPID keys. Imported lazily so
// the library is only loaded when a push is actually attempted.
async function createWebPushSender(): Promise<PushSender> {
  const vapid = getVapidConfig();
  const webpush = (await import("web-push")).default;
  if (vapid) webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return {
    send: async (subscription, payload) => {
      const result = await webpush.sendNotification(subscription, payload);
      return { statusCode: result.statusCode };
    },
  };
}
