import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import {
  createNamedComparison,
  createSavedSearch,
  deleteSavedSearch,
  getConsumerPreferences,
  getDefaultComparison,
  listDecisionEvents,
  listFollows,
  listMarketChangeSummaries,
  listSavedSearches,
  listUserNotifications,
  saveDefaultComparison,
  setFollow,
  updateConsumerPreferences,
  updateNotificationStatus,
  upsertUserNotification,
} from "@/server/consumer-intelligence/repository";
import { generateMarketChangeSummary, getPersonalizedMarket, runSavedSearch } from "@/server/consumer-intelligence/service";

process.env.VIALGRADE_PGLITE_MEMORY="true";
process.env.VIALGRADE_SEED_FIXTURES="true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS="true";
process.env.VIALGRADE_SESSION_SECRET="consumer-intelligence-test-secret-at-least-32";
process.env.VIALGRADE_PRIVACY_HASH_SECRET="consumer-intelligence-privacy-secret-at-least-32";
const userId="user:customer:nora";

describe("VIAL 3.0 consumer intelligence",()=>{
  beforeAll(async()=>{await resetDatabaseForTests();await getDatabase()});
  afterAll(async()=>{await resetDatabaseForTests()});

  it("seeds an explicit preference model and personal market",async()=>{
    const preferences=await getConsumerPreferences(userId);
    expect(preferences.homeView).toBe("evidence-first");
    expect(preferences.preferredCompoundSlugs).toContain("bpc-157");
    const market=await getPersonalizedMarket(userId);
    expect(market.recommendations.length).toBeGreaterThan(0);
    expect(market.recommendations[0]?.reasons.length).toBeGreaterThan(0);
    expect(market.savedSearches.length).toBeGreaterThanOrEqual(2);
  });

  it("updates preferences without leaking them to another account",async()=>{
    const current=await getConsumerPreferences(userId);
    await updateConsumerPreferences(userId,{...current,priceCeiling:75,homeView:"price-first"});
    expect((await getConsumerPreferences(userId)).priceCeiling).toBe(75);
    expect((await getConsumerPreferences("user:seller:marcus")).priceCeiling).toBe(500);
  });

  it("persists default and named comparisons across sessions",async()=>{
    const slugs=["northstar-bpc-157-10mg","helix-bpc-157-10mg","meridian-bpc-157-5mg","arcwell-kpv-10mg","northstar-kpv-5mg"];
    const current=await saveDefaultComparison(userId,slugs);
    expect(current?.listingSlugs).toHaveLength(4);
    expect((await getDefaultComparison(userId))?.listingSlugs).toEqual(slugs.slice(0,4));
    const named=await createNamedComparison(userId,{name:"Evidence review",listingSlugs:slugs.slice(0,3),notes:{focus:"batch linkage"}});
    expect(named?.name).toBe("Evidence review");
    expect(named?.notes.focus).toBe("batch linkage");
  });

  it("creates, runs, and deletes a saved search",async()=>{
    const saved=await createSavedSearch(userId,{name:"Epitalon market",query:"epithalon",filters:{types:["compound","listing"]},alertMode:"important"});
    expect(saved?.id).toBeTruthy();
    const result=await runSavedSearch(userId,saved!.id);
    expect(result?.results.some(item=>item.entityId==="cmp:epitalon")).toBe(true);
    const refreshed=(await listSavedSearches(userId)).find(item=>item.id===saved!.id);
    expect(refreshed?.lastResultCount).toBeGreaterThan(0);
    expect(await deleteSavedSearch(userId,saved!.id)).toBe(true);
  });

  it("maintains follows, decision history, summaries, and relevant notifications",async()=>{
    await setFollow(userId,"compound","ghk-cu",true);
    expect(await listFollows(userId)).toContainEqual({entityType:"compound",entitySlug:"ghk-cu"});
    const summary=await generateMarketChangeSummary(userId);
    expect(summary).toBeTruthy();
    expect((await listMarketChangeSummaries(userId)).length).toBeGreaterThan(0);
    expect((await listDecisionEvents(userId)).some(event=>event.eventType==="comparison_created")).toBe(true);
    const notifications=await listUserNotifications(userId,{limit:100});
    expect(notifications.length).toBeGreaterThan(0);
    expect(await updateNotificationStatus(userId,notifications[0]!.id,"read")).toBe(true);
  });

  it("defers new notifications during configured quiet hours",async()=>{
    const db=await getDatabase();
    const now=new Date();
    const timezone="UTC";
    const currentMinutes=now.getUTCHours()*60+now.getUTCMinutes();
    const start=(currentMinutes+1439)%1440;
    const end=(currentMinutes+2)%1440;
    const fmt=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
    await db.query(`UPDATE user_notification_preferences SET quiet_hours_start=$2,quiet_hours_end=$3,timezone=$4,relevance_threshold=0 WHERE user_id=$1`,[userId,fmt(start),fmt(end),timezone]);
    await upsertUserNotification(userId,{category:"test",title:"Quiet notification",body:"Deferred by quiet hours",relevanceScore:1,dedupeKey:"quiet-hours-test"});
    const row=(await db.query<{deliver_after:Date|string}>(`SELECT deliver_after FROM user_notifications WHERE user_id=$1 AND dedupe_key='quiet-hours-test'`,[userId])).rows[0];
    expect(new Date(row!.deliver_after).getTime()).toBeGreaterThan(now.getTime()+30_000);
  });
});
