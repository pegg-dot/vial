import type { Product } from "@/lib/types";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { sendPushToUser } from "@/server/push/delivery";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { getAlertsForListingSlugs } from "@/server/intelligence/repository";
import { searchMarket } from "@/server/search/engine";
import {
  getConsumerPreferences,
  getVisitState,
  listDecisionEvents,
  getNotificationChannelPreferences,
  listFollowedListingSlugs,
  listFollows,
  listMarketChangeSummaries,
  listSavedSearches,
  listUserNotifications,
  recordDecisionEvent,
  touchVisit,
  updateSavedSearchResult,
  upsertMarketChangeSummary,
  upsertUserNotification,
} from "./repository";
import { getWatchlistSlugs } from "@/server/account/repository";
import type { ChangeSummaryItem, ConsumerPreferences } from "./types";

function shippingDays(value: string) {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];
  return numbers.length ? Math.max(...numbers) : 99;
}

function evidenceScore(product: Product, preferences: ConsumerPreferences) {
  let score = 0;
  if (product.reportConfirmed) score += preferences.evidencePriorities.includes("report_confirmation") ? 22 : 10;
  if (product.batchLinked) score += preferences.evidencePriorities.includes("batch_linkage") ? 22 : 10;
  if (product.evidenceLevel === "independent") score += 25;
  else if (product.evidenceLevel === "issuer-confirmed") score += 18;
  else if (product.evidenceLevel === "vendor-published") score += 8;
  if (product.evidenceLevel !== "stale") score += preferences.evidencePriorities.includes("freshness") ? 12 : 5;
  if (product.sampleOrigin.toLowerCase().includes("independent")) score += preferences.evidencePriorities.includes("sampling") ? 12 : 5;
  return score;
}

export async function getPersonalizedMarket(userId: string) {
  const [catalog,preferences,watchlist,follows,savedSearches,history,notifications,summaries] = await Promise.all([
    getCatalogSnapshot(),getConsumerPreferences(userId),getWatchlistSlugs(userId),listFollows(userId),listSavedSearches(userId),listDecisionEvents(userId,12),listUserNotifications(userId,{limit:8}),listMarketChangeSummaries(userId,3),
  ]);
  const followedCompounds = new Set(follows.filter(item=>item.entityType==="compound").map(item=>item.entitySlug));
  const followedVendors = new Set(follows.filter(item=>item.entityType==="vendor").map(item=>item.entitySlug));
  const watched = new Set(watchlist);
  const recommendations = catalog.products
    .map(product => {
      let score = evidenceScore(product, preferences);
      const reasons:string[]=[];
      if (preferences.preferredCompoundSlugs.includes(product.compoundSlug) || followedCompounds.has(product.compoundSlug)) {score+=28;reasons.push("Followed compound");}
      if (followedVendors.has(product.vendorSlug)) {score+=20;reasons.push("Followed vendor");}
      else if (preferences.preferredVendorSlugs.includes(product.vendorSlug)) {score+=20;reasons.push("Preferred vendor");}
      if (watched.has(product.slug)) {score+=12;reasons.push("On your watchlist");}
      if (product.price>=preferences.priceFloor&&product.price<=preferences.priceCeiling) {score+=12;reasons.push("Within your price range");}
      if (shippingDays(product.shipping)<=preferences.maxShippingDays) {score+=6;reasons.push("Matches shipping preference");}
      if (preferences.hiddenVendorSlugs.includes(product.vendorSlug)) score-=1000;
      if (preferences.homeView==="price-first") score += Math.max(0,100-product.price)*0.25;
      if (preferences.homeView==="evidence-first") score += evidenceScore(product,preferences)*0.45;
      if (product.availability==="Unavailable") score-=30;
      return {product,score,reasons:reasons.slice(0,3)};
    })
    .filter(item=>item.score>-100)
    .sort((a,b)=>b.score-a.score)
    .slice(0,6);
  const previousVisit = await getVisitState(userId);
  await touchVisit(userId,true);
  return {catalog,preferences,watchlist,follows,savedSearches,history,notifications,summaries,recommendations,previousVisit};
}

export async function runSavedSearch(userId:string,id:string){const searches=await listSavedSearches(userId);const saved=searches.find(item=>item.id===id);if(!saved)return null;const types=Array.isArray(saved.filters.types)?saved.filters.types.filter((value):value is string=>typeof value==="string"):undefined;const result=await searchMarket({query:saved.query,types,limit:30,actorKey:userId});await updateSavedSearchResult(userId,id,result.results.length);await recordDecisionEvent(userId,{eventType:"saved_search_run",subjectType:"saved_search",subjectId:id,metadata:{query:saved.query,resultCount:result.results.length}});return result;}

function periodKey(start:Date,end:Date){return `${start.toISOString().slice(0,10)}:${end.toISOString().slice(0,10)}`;}
export async function generateMarketChangeSummary(userId:string,connection?:SqlConnection){const db=connection??await getDatabase();const [watchlist,follows,visit]=await Promise.all([getWatchlistSlugs(userId),listFollows(userId),getVisitState(userId)]);const end=new Date();const start=visit?.previous_seen_at?new Date(visit.previous_seen_at):new Date(end.getTime()-7*24*60*60*1000);const followCompounds=follows.filter(f=>f.entityType==="compound").map(f=>f.entitySlug);const followVendors=follows.filter(f=>f.entityType==="vendor").map(f=>f.entitySlug);
  const result=await db.query<{id:string;category:string;severity:string;title:string;message:string;created_at:Date|string;listing_slug:string;compound_slug:string;vendor_slug:string}>(`SELECT ae.id,ae.category,ae.severity,ae.title,ae.message,ae.created_at,l.slug listing_slug,c.slug compound_slug,o.slug vendor_slug FROM alert_events ae JOIN listings l ON ae.entity_type='listing' AND l.id=ae.entity_id JOIN products p ON p.id=l.product_id JOIN compounds c ON c.id=p.compound_id JOIN organizations o ON o.id=p.vendor_id WHERE ae.created_at>=$1 ORDER BY ae.created_at DESC LIMIT 100`,[start]);
  const items:ChangeSummaryItem[]=result.rows.map(row=>{let relevance=0.25;if(watchlist.includes(row.listing_slug))relevance+=0.5;if(followCompounds.includes(row.compound_slug))relevance+=0.25;if(followVendors.includes(row.vendor_slug))relevance+=0.2;if(row.severity==="warning")relevance+=0.1;return{kind:row.category,title:row.title,detail:row.message,href:`/products/${row.listing_slug}`,relevance:Math.min(1,relevance),occurredAt:new Date(row.created_at).toISOString()}}).filter(item=>item.relevance>=0.4).sort((a,b)=>b.relevance-a.relevance||b.occurredAt.localeCompare(a.occurredAt)).slice(0,12);
  if(!items.length){const publications=await db.query<{listing_slug:string;product_name:string;vendor_name:string;published_at:Date|string}>(`SELECT l.slug listing_slug,p.name product_name,o.display_name vendor_name,pe.published_at FROM publication_events pe JOIN listings l ON l.id=pe.entity_id JOIN products p ON p.id=l.product_id JOIN organizations o ON o.id=p.vendor_id WHERE pe.entity_type='listing' AND pe.published_at>=$1 ORDER BY pe.published_at DESC LIMIT 6`,[start]);items.push(...publications.rows.map(row=>({kind:"market_update",title:`${row.product_name} record updated`,detail:`A reviewed change was published for ${row.vendor_name}.`,href:`/products/${row.listing_slug}`,relevance:0.45,occurredAt:new Date(row.published_at).toISOString()})));}
  const title=items.length?`${items.length} meaningful market change${items.length===1?"":"s"} since your last review`:"No meaningful changes since your last review";
  const summary=items.length?`VialGrade prioritized changes connected to your watchlist, followed entities, and explicit preferences. ${items.filter(i=>i.relevance>=0.75).length} were high relevance.`:"Your followed market records remained stable during this period.";
  const generated=await upsertMarketChangeSummary(userId,{periodStart:start,periodEnd:end,title,summary,items,relevanceScore:items.length?items.reduce((sum,item)=>sum+item.relevance,0)/items.length:0,dedupeKey:periodKey(start,end)},db);
  for(const item of items.slice(0,8))await upsertUserNotification(userId,{category:item.kind,title:item.title,body:item.detail,actionHref:item.href,relevanceScore:item.relevance,dedupeKey:`change:${item.kind}:${item.href}:${item.occurredAt.slice(0,10)}`},db);
  return generated;
}

/**
 * Turn reviewed market changes into this user's inbox.
 *
 * It used to read ONLY `user_watchlists` while /account/notifications told the reader it delivered
 * "changes to the things you follow" — so following a vendor produced nothing here, and the copy
 * was a promise the code did not keep. Both subscriptions now feed the same pipeline.
 *
 * `followed_entity_alerts` finally binds: the column has existed and been toggleable in
 * /account since the preferences panel shipped, and no code has ever read it.
 */
export async function syncWatchlistNotifications(userId:string){
  const [watchedSlugs,followed,channels]=await Promise.all([
    getWatchlistSlugs(userId),
    listFollowedListingSlugs(userId),
    getNotificationChannelPreferences(userId),
  ]);
  const followedListings=channels.followedEntityAlerts?followed:[];
  const reasonBySlug=new Map(followedListings.map(item=>[item.listingSlug,item.reason]));
  // A listing the user both watches and follows is ONE subscription, not two. The watchlist is the
  // more deliberate act, so it names the reason.
  for(const slug of watchedSlugs)reasonBySlug.set(slug,"On your watchlist");
  const slugs=Array.from(reasonBySlug.keys());
  if(!slugs.length)return listUserNotifications(userId,{limit:100});
  const alerts=await getAlertsForListingSlugs(slugs,150);
  for(const alert of alerts){
    const watched=watchedSlugs.includes(alert.listingSlug);
    let relevance=alert.severity==="warning"?0.9:alert.category.includes("price")?0.72:0.68;
    // A follow is a broader net than a watchlist save — the user asked about a compound or a
    // vendor, not this listing. Rank it below an explicit save so the inbox does not invert.
    if(!watched)relevance=Math.max(0.5,relevance-0.12);
    const reason=reasonBySlug.get(alert.listingSlug);
    await upsertUserNotification(userId,{
      category:alert.category,
      title:alert.title,
      // Why this reached you. A notification that cannot say that is indistinguishable from spam.
      body:reason?`${alert.message} · ${reason}`:alert.message,
      actionHref:`/products/${alert.listingSlug}`,
      relevanceScore:relevance,
      dedupeKey:`alert:${alert.id}`,
    });
    try{await sendPushToUser(userId,{title:alert.title,body:alert.message,url:`/products/${alert.listingSlug}`,tag:`alert:${alert.id}`});}catch{/* best-effort: push must never break notification creation */}
  }
  return listUserNotifications(userId,{limit:100});
}
