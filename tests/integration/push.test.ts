import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/server/db/client";
import { saveSubscription, getSubscriptionsForUser, removeSubscriptionForUser } from "@/server/push/repository";
import { sendPushToUser, type PushSender } from "@/server/push/delivery";

async function seedUser(id: string, email: string) {
  const db = await getDatabase();
  await db.query(`INSERT INTO auth_users(id,email,display_name,account_type,roles) VALUES($1,$2,$3,'customer','["customer"]'::jsonb) ON CONFLICT(id) DO NOTHING`, [id, email, email]);
}
const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: `p-${endpoint}`, auth: `a-${endpoint}` } });

describe("web push — per-user isolation, targeting, pruning", () => {
  beforeEach(() => {
    process.env.VIAL_PGLITE_MEMORY = "true";
    delete (globalThis as { __vialDbPromise?: unknown }).__vialDbPromise;
    process.env.VAPID_PUBLIC_KEY = "test-pub"; process.env.VAPID_PRIVATE_KEY = "test-priv";
  });

  it("stores subscriptions scoped to the owning user", async () => {
    await seedUser("user:a", "a@vial.test"); await seedUser("user:b", "b@vial.test");
    await saveSubscription("user:a", sub("https://push.example/a1"));
    await saveSubscription("user:b", sub("https://push.example/b1"));
    expect((await getSubscriptionsForUser("user:a")).map((s) => s.endpoint)).toEqual(["https://push.example/a1"]);
    expect((await getSubscriptionsForUser("user:b")).map((s) => s.endpoint)).toEqual(["https://push.example/b1"]);
  });

  it("delivers ONLY to the target user's devices — never another user's", async () => {
    await seedUser("user:a", "a@vial.test"); await seedUser("user:b", "b@vial.test");
    await saveSubscription("user:a", sub("https://push.example/a1"));
    await saveSubscription("user:a", sub("https://push.example/a2"));
    await saveSubscription("user:b", sub("https://push.example/b1"));
    const hit: string[] = [];
    const sender: PushSender = { send: async (s) => { hit.push(s.endpoint); return { statusCode: 201 }; } };
    const result = await sendPushToUser("user:a", { title: "Reviewed change", body: "Price updated" }, { sender });
    expect(result.sent).toBe(2);
    expect(hit.sort()).toEqual(["https://push.example/a1", "https://push.example/a2"]);
    expect(hit).not.toContain("https://push.example/b1");
  });

  it("prunes a subscription the push service reports as gone (410)", async () => {
    await seedUser("user:a", "a@vial.test");
    await saveSubscription("user:a", sub("https://push.example/live"));
    await saveSubscription("user:a", sub("https://push.example/dead"));
    const sender: PushSender = { send: async (s) => { if (s.endpoint.endsWith("dead")) throw Object.assign(new Error("gone"), { statusCode: 410 }); return { statusCode: 201 }; } };
    const result = await sendPushToUser("user:a", { title: "t", body: "b" }, { sender });
    expect(result.sent).toBe(1);
    expect(result.pruned).toBe(1);
    expect((await getSubscriptionsForUser("user:a")).map((s) => s.endpoint)).toEqual(["https://push.example/live"]);
  });

  it("lets a user unsubscribe their own device", async () => {
    await seedUser("user:a", "a@vial.test");
    await saveSubscription("user:a", sub("https://push.example/a1"));
    await removeSubscriptionForUser("user:a", "https://push.example/a1");
    expect(await getSubscriptionsForUser("user:a")).toHaveLength(0);
  });
});
