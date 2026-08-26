// Order notifications, so the "Order changes" toggle governs something.
//
// `order_alerts` was stored, rendered as a switch on /account, and read by NO code — because no
// order notification existed anywhere to gate. `grep -i notification src/server/commerce/` returned
// nothing at all. A seller could mark an order shipped and the buyer was never told; the only way
// to find out was to open /account/orders and look.

import type { SqlConnection } from "@/server/db/client";
import { getDatabase } from "@/server/db/client";
import { getNotificationChannelPreferences, markNotificationPushed, upsertUserNotification } from "@/server/consumer-intelligence/repository";
import { sendPushToUser } from "@/server/push/delivery";
import { decideDelivery } from "./policy";

/**
 * Tell the buyer their order shipped.
 *
 * Best-effort by contract: this runs AFTER the shipment transaction commits, and every failure is
 * swallowed. A notification problem must never roll back a shipment or fail a seller's request —
 * the shipment is the fact, the notification is a courtesy.
 */
export async function notifyOrderShipped(input: { orderId: string; trackingCode?: string | null }, connection?: SqlConnection) {
  try {
    const db = connection ?? (await getDatabase());
    const order = (await db.query<{ customer_key: string; status: string }>(
      `SELECT customer_key, status FROM commerce_orders WHERE id=$1`,
      [input.orderId],
    )).rows[0];
    // `customer_key` is the buyer's auth id (see the commerce API routes, which pass
    // `principal.id`), so it addresses a notification directly.
    if (!order?.customer_key) return { notified: false, reason: "no-customer" as const };

    const preferences = await getNotificationChannelPreferences(order.customer_key, db);
    const now = new Date();
    const decision = decideDelivery({ category: null, source: "order", relevance: 0.95, preferences, now });
    if (!decision.inApp && !decision.push) return { notified: false, reason: decision.suppressedBy ?? "suppressed" };

    const partial = order.status === "partially_shipped";
    const title = partial ? "Part of your order has shipped" : "Your order has shipped";
    const body = input.trackingCode
      ? `Tracking ${input.trackingCode}.${partial ? " The rest is still with the seller." : ""}`
      : partial ? "The rest is still with the seller." : "The seller has handed it to the carrier.";
    const href = `/orders/${input.orderId}/confirmation`;

    const dedupeKey = `order:${input.orderId}:${order.status}`;
    let alreadyPushed = false;
    if (decision.inApp) {
      ({ alreadyPushed } = await upsertUserNotification(order.customer_key, {
        category: "order",
        title,
        body,
        actionHref: href,
        relevanceScore: 0.95,
        // Keyed on the status too, so a partial shipment and the final one are two events rather
        // than one overwritten row.
        dedupeKey,
        deliverAfter: decision.deliverAfter,
      }, db));
    }
    if (decision.push && !alreadyPushed) {
      await sendPushToUser(order.customer_key, { title, body, url: href, tag: `order:${input.orderId}` }).catch(() => null);
      await markNotificationPushed(order.customer_key, dedupeKey, db).catch(() => null);
    }
    return { notified: true, reason: null };
  } catch (error) {
    console.error("[order-alerts] shipment notification failed:", error);
    return { notified: false, reason: "error" as const };
  }
}
