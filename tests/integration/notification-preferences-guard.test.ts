import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { getNotificationPreferences, updateNotificationPreferences } from "@/server/account/repository";
import { getNotificationChannelPreferences, listUserNotifications, upsertUserNotification } from "@/server/consumer-intelligence/repository";
import { decideDelivery } from "@/server/notifications/policy";

process.env.VIALGRADE_PGLITE_MEMORY="true";
process.env.VIALGRADE_SEED_FIXTURES="true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS="true";
process.env.VIALGRADE_SESSION_SECRET="preferences-guard-test-secret-at-least-32";
process.env.VIALGRADE_PRIVACY_HASH_SECRET="preferences-guard-privacy-secret-at-least-32";

const userId="user:customer:nora";

/**
 * The repository is the LAST line, not the only one — the API schema rejects these values before
 * they get here. It is still tested at this level because the column gates two independent
 * suppression paths (the inbox query and the push decision), the API is not the only possible
 * caller, and a poisoned value cannot be undone from any surface the reader can reach.
 */
const BASE={
  inAppEnabled:true,emailEnabled:false,priceAlerts:true,evidenceAlerts:true,availabilityAlerts:true,
  orderAlerts:true,savedSearchAlerts:true,followedEntityAlerts:true,marketDigest:true,
  digestFrequency:"instant",quietHoursStart:"22:00",quietHoursEnd:"08:00",timezone:"America/New_York",
  relevanceThreshold:0.2,
};

/** The stored value as Postgres itself renders it — 'NaN' is a legal NUMERIC and must never appear. */
async function storedThresholdText(){
  const db=await getDatabase();
  const row=(await db.query<{value:string}>(`SELECT relevance_threshold::text AS value FROM user_notification_preferences WHERE user_id=$1`,[userId])).rows[0];
  return row?.value??null;
}

/** deliver_after is pinned into the past so the assertion cannot depend on the wall clock. */
async function seedNotification(){
  await upsertUserNotification(userId,{
    category:"price-change",
    title:"Observed price moved",
    body:"A watched listing changed price.",
    relevanceScore:0.9,
    dedupeKey:"preferences-guard:price-change",
    deliverAfter:new Date(Date.now()-60_000),
  });
}

const inboxTitles=async()=>(await listUserNotifications(userId)).map(item=>item.title);

/**
 * The second suppression path. `now` is pinned to 11:00 in the reader's zone so quiet hours (22:00
 * to 08:00) can never be what makes this false — only the relevance floor can.
 */
async function pushAllowed(){
  return decideDelivery({
    category:"price-change",
    source:"watchlist",
    relevance:0.9,
    preferences:await getNotificationChannelPreferences(userId),
    now:new Date("2026-08-25T15:00:00Z"),
  }).push;
}

describe("relevance_threshold cannot be poisoned",()=>{
  beforeAll(async()=>{await resetDatabaseForTests();await getDatabase();await seedNotification()});
  afterAll(async()=>{await resetDatabaseForTests()});

  it("1. the threshold really does gate the inbox, so a poisoned value would be fatal",async()=>{
    // Positive control. Without this, every assertion below could pass against a column nothing
    // reads: a NaN in a dead column would be harmless and the test would prove nothing.
    await updateNotificationPreferences(userId,BASE);
    expect(await inboxTitles()).toContain("Observed price moved");

    await updateNotificationPreferences(userId,{...BASE,relevanceThreshold:0.95});
    expect(await inboxTitles()).not.toContain("Observed price moved");
    expect(await pushAllowed()).toBe(false);
  });

  it("2. refuses to persist NaN and falls back to the default instead",async()=>{
    // The proven payload: PATCH {"relevanceThreshold":"high"} reached the repository as Number("high").
    await updateNotificationPreferences(userId,{...BASE,relevanceThreshold:Number("high")});

    expect(await storedThresholdText()).not.toBe("NaN");
    const stored=Number(await storedThresholdText());
    expect(Number.isFinite(stored)).toBe(true);
    expect(stored).toBe(0.45);
    expect(Number((await getNotificationPreferences(userId))?.relevance_threshold)).toBe(0.45);
    expect((await getNotificationChannelPreferences(userId)).relevanceThreshold).toBe(0.45);

    // The consequence, not just the cell: the inbox still returns the row and push is still allowed.
    expect(await inboxTitles()).toContain("Observed price moved");
    expect(await pushAllowed()).toBe(true);
  });

  it("3. refuses Infinity, -Infinity and non-numeric junk the same way",async()=>{
    for(const poison of [Infinity,-Infinity,"high",{},[],true]){
      await updateNotificationPreferences(userId,{...BASE,relevanceThreshold:poison});
      const stored=Number(await storedThresholdText());
      expect(Number.isFinite(stored),`stored value for ${JSON.stringify(poison)??String(poison)}`).toBe(true);
      expect(stored).toBe(0.45);
      expect(await inboxTitles()).toContain("Observed price moved");
    }
  });

  it("4. clamps a finite value that NUMERIC(5,4) could not even hold",async()=>{
    // 42 overflows NUMERIC(5,4). Unclamped this raises inside the INSERT and the whole save fails.
    await updateNotificationPreferences(userId,{...BASE,relevanceThreshold:42});
    expect(Number(await storedThresholdText())).toBe(1);
    await updateNotificationPreferences(userId,{...BASE,relevanceThreshold:-5});
    expect(Number(await storedThresholdText())).toBe(0);
  });

  it("5. still stores a legitimate value, including one round-tripped back as a string",async()=>{
    await updateNotificationPreferences(userId,{...BASE,relevanceThreshold:0.6});
    expect(Number(await storedThresholdText())).toBe(0.6);
    // getNotificationPreferences hands NUMERIC back as a string; feeding that straight back in must
    // not be treated as junk.
    const readBack=(await getNotificationPreferences(userId))?.relevance_threshold;
    expect(typeof readBack).toBe("string");
    await updateNotificationPreferences(userId,{...BASE,relevanceThreshold:readBack});
    expect(Number(await storedThresholdText())).toBe(0.6);
    // Absent means "use the default", exactly as before.
    await updateNotificationPreferences(userId,{...BASE,relevanceThreshold:undefined});
    expect(Number(await storedThresholdText())).toBe(0.45);
  });
});
