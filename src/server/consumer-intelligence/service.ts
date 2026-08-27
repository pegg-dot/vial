import type { EvidenceLevel, Product } from "@/lib/types";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { sendPushToUser } from "@/server/push/delivery";
import { asAlertCategory, decideDelivery } from "@/server/notifications/policy";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { getAlertsForListingSlugs, getRecentListingChangeActivity } from "@/server/intelligence/repository";
import { searchMarket } from "@/server/search/engine";
import {
  getConsumerPreferences,
  getVisitState,
  listDecisionEvents,
  getNotificationChannelPreferences,
  listFollowedListingSlugs,
  listFollows,
  markNotificationPushed,
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
import type { ChangeSummaryItem, EvidencePriority } from "./types";

function shippingDays(value: string) {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];
  return numbers.length ? Math.max(...numbers) : 99;
}

/**
 * Evidence strength as an ORDER, strongest first. `requiredEvidenceLevels` is a floor stated in
 * these terms, so the ordering has to live in exactly one place.
 */
const EVIDENCE_RANK: Record<EvidenceLevel, number> = {
  "independent": 4,
  "issuer-confirmed": 3,
  "vendor-published": 2,
  "public-only": 1,
  "stale": 0,
};
function evidenceRank(level: string) {
  return level in EVIDENCE_RANK ? EVIDENCE_RANK[level as EvidenceLevel] : 0;
}

/**
 * A named laboratory. Both the fixtures and the ingestion pipeline write the literal string
 * "Unknown" when a listing names no issuer, so an empty string is not the only unnamed case.
 */
function hasNamedIssuer(product: Product) {
  const issuer = (product.reportIssuer ?? "").trim();
  return issuer.length > 0 && issuer.toLowerCase() !== "unknown";
}

/** A declared amount that parses to a real number is the only kind a report can be checked against. */
function hasReadableAmount(product: Product) {
  return typeof product.mg === "number" && Number.isFinite(product.mg) && product.mg > 0;
}

/** How far back "recent change activity" reaches for the changes-first home view. */
const CHANGE_ACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Evidence quality for one listing, weighted by the priorities the reader ticked.
 *
 * Priorities are passed in rather than read off the preference record because
 * `getPersonalizedMarket` must be able to score on NEUTRAL weights when the reader has switched
 * personalization off — a weighted evidence score is still this reader's profile talking.
 */
function evidenceScore(product: Product, priorities: readonly EvidencePriority[]) {
  const wants = (key: EvidencePriority) => priorities.includes(key);
  let score = 0;
  if (product.reportConfirmed) score += wants("report_confirmation") ? 22 : 10;
  if (product.batchLinked) score += wants("batch_linkage") ? 22 : 10;
  if (product.evidenceLevel === "independent") score += 25;
  else if (product.evidenceLevel === "issuer-confirmed") score += 18;
  else if (product.evidenceLevel === "vendor-published") score += 8;
  if (product.evidenceLevel !== "stale") score += wants("freshness") ? 12 : 5;
  if (product.sampleOrigin.toLowerCase().includes("independent")) score += wants("sampling") ? 12 : 5;
  // "Which lab did it" — attribution. A report nobody signed cannot be chased back to a lab, so an
  // unnamed issuer earns nothing here. `advertisesTesting` deliberately earns nothing either: the
  // type is explicit that advertising testing must never satisfy a confirmation gate.
  if (hasNamedIssuer(product)) score += wants("issuer") ? 16 : 6;
  // "Is the dose really there" — a dose claim is only CHECKABLE when the listing states an amount
  // that parses at all, and it is only checked when a confirmed report is tied to the batch that
  // amount was measured on. Both halves are scored, so a legible-but-unbacked amount ranks below a
  // legible amount whose report the issuer confirmed for this batch.
  if (hasReadableAmount(product)) {
    score += wants("quantity") ? 8 : 3;
    if (product.reportConfirmed && product.batchLinked) score += wants("quantity") ? 14 : 5;
  }
  return score;
}

export async function getPersonalizedMarket(userId: string) {
  const [catalog,preferences,watchlist,follows,savedSearches,history,notifications,summaries] = await Promise.all([
    getCatalogSnapshot(),getConsumerPreferences(userId),getWatchlistSlugs(userId),listFollows(userId),listSavedSearches(userId),listDecisionEvents(userId,12),listUserNotifications(userId,{limit:8}),listMarketChangeSummaries(userId,3),
  ]);
  const followedCompounds = new Set(follows.filter(item=>item.entityType==="compound").map(item=>item.entitySlug));
  const followedVendors = new Set(follows.filter(item=>item.entityType==="vendor").map(item=>item.entitySlug));
  const watched = new Set(watchlist);

  // Personalization OFF means this reader's profile stops steering the ranking: no followed
  // compound or vendor boost, no watchlist boost, no price-range or shipping boost, no home-view
  // weighting — and no evidence-priority re-weighting either, because a weighted evidence score is
  // as much this reader's profile as a followed vendor is. What is left is the neutral evidence
  // quality of the record and whether anyone can actually get it.
  const personalized = preferences.personalizationEnabled;
  const priorities: readonly EvidencePriority[] = personalized ? preferences.evidencePriorities : [];

  // The two HARD constraints survive the personalization switch on purpose. Hiding a vendor and
  // requiring an evidence level are exclusions the reader stated outright, not ranking hints;
  // silently re-admitting an excluded record would be a worse surprise than ranking it low.
  const hiddenVendors = new Set(preferences.hiddenVendorSlugs);
  // A listing is kept when it meets at least ONE required level — i.e. only a listing that falls
  // below EVERY required level is excluded — so the weakest level the reader picked is the bar.
  // Unknown strings are dropped rather than ranked 0: the column is a free-text array, and a typo
  // that silently lowered the bar to "nothing is excluded" would look exactly like a working filter.
  const requiredRanks = preferences.requiredEvidenceLevels.filter(level => level in EVIDENCE_RANK).map(evidenceRank);
  const evidenceFloor = requiredRanks.length ? Math.min(...requiredRanks) : null;

  // One query, not one per listing, and only when the reader actually ranks by change activity.
  const changeActivity = personalized && preferences.homeView === "changes-first"
    ? await getRecentListingChangeActivity(new Date(Date.now() - CHANGE_ACTIVITY_WINDOW_MS))
    : null;

  const recommendations = catalog.products
    // Excluded, not down-ranked: a hidden vendor and a record under the reader's evidence floor
    // never reach the ranking at all.
    .filter(product => !hiddenVendors.has(product.vendorSlug))
    .filter(product => evidenceFloor === null || evidenceRank(product.evidenceLevel) >= evidenceFloor)
    .map(product => {
      const quality = evidenceScore(product, priorities);
      let score = quality;
      const reasons:string[]=[];
      if (personalized) {
        if (preferences.preferredCompoundSlugs.includes(product.compoundSlug) || followedCompounds.has(product.compoundSlug)) {score+=28;reasons.push("Followed compound");}
        if (followedVendors.has(product.vendorSlug)) {score+=20;reasons.push("Followed vendor");}
        else if (preferences.preferredVendorSlugs.includes(product.vendorSlug)) {score+=20;reasons.push("Preferred vendor");}
        if (watched.has(product.slug)) {score+=12;reasons.push("On your watchlist");}
        if (product.price>=preferences.priceFloor&&product.price<=preferences.priceCeiling) {score+=12;reasons.push("Within your price range");}
        if (shippingDays(product.shipping)<=preferences.maxShippingDays) {score+=6;reasons.push("Matches shipping preference");}
        if (preferences.homeView==="price-first") score += Math.max(0,100-product.price)*0.25;
        if (preferences.homeView==="evidence-first") score += quality*0.45;
        if (preferences.homeView==="changes-first") {
          // Records that actually moved lately, ranked by how much reviewed change they carry.
          // Capped so one noisy listing cannot own the whole feed.
          const activity = changeActivity?.get(product.slug);
          if (activity?.count) {
            score += Math.min(activity.count, 4) * 18;
            reasons.unshift(activity.count === 1 ? "1 reviewed change recently" : `${activity.count} reviewed changes recently`);
          }
        }
      } else {
        // The feed still has to say WHY a record is here, and with the profile switched off the
        // only honest answers are the evidence on the record and whether it is obtainable.
        if (product.evidenceLevel==="independent") reasons.push("Independent lab evidence");
        else if (product.evidenceLevel==="issuer-confirmed") reasons.push("Issuer confirmed the report");
        else if (product.evidenceLevel==="vendor-published") reasons.push("Vendor-published report");
        if (product.batchLinked) reasons.push("Tied to this batch");
        if (product.availability!=="Unavailable") reasons.push("Available now");
        if (!reasons.length) reasons.push("Ranked on evidence and availability");
      }
      if (product.availability==="Unavailable") score-=30;
      return {product,score,reasons:reasons.slice(0,3)};
    })
    .sort((a,b)=>b.score-a.score)
    .slice(0,6);
  const previousVisit = await getVisitState(userId);
  await touchVisit(userId,true);
  return {catalog,preferences,watchlist,follows,savedSearches,history,notifications,summaries,recommendations,previousVisit};
}

export async function runSavedSearch(userId:string,id:string){const searches=await listSavedSearches(userId);const saved=searches.find(item=>item.id===id);if(!saved)return null;const types=Array.isArray(saved.filters.types)?saved.filters.types.filter((value):value is string=>typeof value==="string"):undefined;const result=await searchMarket({query:saved.query,types,limit:30,actorKey:userId});await updateSavedSearchResult(userId,id,result.totalMatches);await recordDecisionEvent(userId,{eventType:"saved_search_run",subjectType:"saved_search",subjectId:id,metadata:{query:saved.query,resultCount:result.totalMatches,shown:result.results.length}});return result;}

function periodKey(start:Date,end:Date){return `${start.toISOString().slice(0,10)}:${end.toISOString().slice(0,10)}`;}
export async function generateMarketChangeSummary(userId:string,connection?:SqlConnection){const db=connection??await getDatabase();
  // "Market change digest" was a toggle that governed nothing: this ran on every /for-you load
  // whatever the reader had set. Turning it off now stops both the summary and the notifications
  // it spawns.
  const preferences=await getNotificationChannelPreferences(userId,db);
  if(!preferences.marketDigest)return null;
  const [watchlist,follows,visit]=await Promise.all([getWatchlistSlugs(userId),listFollows(userId),getVisitState(userId)]);const end=new Date();const start=visit?.previous_seen_at?new Date(visit.previous_seen_at):new Date(end.getTime()-7*24*60*60*1000);const followCompounds=follows.filter(f=>f.entityType==="compound").map(f=>f.entitySlug);const followVendors=follows.filter(f=>f.entityType==="vendor").map(f=>f.entitySlug);
  const subscribed=Array.from(new Set([...watchlist,...(await listFollowedListingSlugs(userId,db)).map(item=>item.listingSlug)]));
  const result=subscribed.length?await db.query<{id:string;category:string;severity:string;title:string;message:string;created_at:Date|string;listing_slug:string;compound_slug:string;vendor_slug:string}>(`SELECT ae.id,ae.category,ae.severity,ae.title,ae.message,ae.created_at,l.slug listing_slug,c.slug compound_slug,o.slug vendor_slug FROM alert_events ae JOIN listings l ON ae.entity_type='listing' AND l.id=ae.entity_id JOIN products p ON p.id=l.product_id JOIN compounds c ON c.id=p.compound_id JOIN organizations o ON o.id=p.vendor_id WHERE ae.created_at>=$1 AND l.slug = ANY($2::text[]) ORDER BY ae.created_at DESC LIMIT 100`,[start,subscribed]):{rows:[]};
  const alertIdByHref=new Map<string,string>();
  const items:ChangeSummaryItem[]=result.rows.map(row=>{alertIdByHref.set(`/products/${row.listing_slug}`,row.id);let relevance=0.25;if(watchlist.includes(row.listing_slug))relevance+=0.5;if(followCompounds.includes(row.compound_slug))relevance+=0.25;if(followVendors.includes(row.vendor_slug))relevance+=0.2;if(row.severity==="warning")relevance+=0.1;return{kind:row.category,title:row.title,detail:row.message,href:`/products/${row.listing_slug}`,relevance:Math.min(1,relevance),occurredAt:new Date(row.created_at).toISOString()}}).filter(item=>item.relevance>=0.4).sort((a,b)=>b.relevance-a.relevance||b.occurredAt.localeCompare(a.occurredAt)).slice(0,12);
  if(!items.length&&subscribed.length){const publications=await db.query<{listing_slug:string;product_name:string;vendor_name:string;published_at:Date|string}>(`SELECT l.slug listing_slug,p.name product_name,o.display_name vendor_name,pe.published_at FROM publication_events pe JOIN listings l ON l.id=pe.entity_id JOIN products p ON p.id=l.product_id JOIN organizations o ON o.id=p.vendor_id WHERE pe.entity_type='listing' AND pe.published_at>=$1 AND l.slug = ANY($2::text[]) ORDER BY pe.published_at DESC LIMIT 6`,[start,subscribed]);items.push(...publications.rows.map(row=>({kind:"market_update",title:`${row.product_name} record updated`,detail:`A reviewed change was published for ${row.vendor_name}.`,href:`/products/${row.listing_slug}`,relevance:0.45,occurredAt:new Date(row.published_at).toISOString()})));}
  const title=items.length?`${items.length} meaningful market change${items.length===1?"":"s"} since your last review`:"No meaningful changes since your last review";
  const summary=items.length?`VialGrade prioritized changes connected to your watchlist, followed entities, and explicit preferences. ${items.filter(i=>i.relevance>=0.75).length} were high relevance.`:"Your followed market records remained stable during this period.";
  const generated=await upsertMarketChangeSummary(userId,{periodStart:start,periodEnd:end,title,summary,items,relevanceScore:items.length?items.reduce((sum,item)=>sum+item.relevance,0)/items.length:0,dedupeKey:periodKey(start,end)},db);
  for(const item of items.slice(0,8)){
    const decision=decideDelivery({category:asAlertCategory(item.kind),source:"digest",relevance:item.relevance,preferences,now:end});
    if(!decision.inApp)continue;
    // Alert-derived items already have an inbox row, written by syncWatchlistNotifications WITH the
    // reason the reader is getting it. Writing again here produced a second row keyed differently;
    // sharing the key instead made the digest's UPDATE overwrite the body and strip that reason.
    // One writer per row: the sync owns alerts, the digest owns what only it can see.
    if(alertIdByHref.has(item.href))continue;
    await upsertUserNotification(userId,{category:item.kind,title:item.title,body:item.detail,actionHref:item.href,relevanceScore:item.relevance,dedupeKey:`change:${item.kind}:${item.href}:${item.occurredAt.slice(0,10)}`,deliverAfter:decision.deliverAfter},db);
  }
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
export async function syncWatchlistNotifications(userId:string,now=new Date()){
  const [watchedSlugs,followed,preferences]=await Promise.all([
    getWatchlistSlugs(userId),
    listFollowedListingSlugs(userId),
    getNotificationChannelPreferences(userId),
  ]);
  const reasonBySlug=new Map(followed.map(item=>[item.listingSlug,item.reason]));
  // A listing the user both watches and follows is ONE subscription, not two. The watchlist is the
  // more deliberate act, so it names the reason.
  for(const slug of watchedSlugs)reasonBySlug.set(slug,"On your watchlist");
  const slugs=Array.from(reasonBySlug.keys());
  if(!slugs.length)return listUserNotifications(userId,{limit:100});
  const alerts=await getAlertsForListingSlugs(slugs,150);
  for(const alert of alerts){
    const watched=watchedSlugs.includes(alert.listingSlug);
    let relevance=alert.severity==="warning"?0.9:alert.category.includes("price")?0.72:0.68;
    // A follow is a broader net than a watchlist save — the reader asked about a compound or a
    // vendor, not this listing. Rank it below an explicit save so the inbox does not invert.
    if(!watched)relevance=Math.max(0.5,relevance-0.12);
    // Every preference is consulted in ONE place. Before this, seven of the fourteen controls on
    // /account were read by nothing at all.
    const decision=decideDelivery({
      category:asAlertCategory(alert.category),
      source:watched?"watchlist":"follow",
      relevance,
      preferences,
      now,
    });
    if(!decision.inApp)continue;
    const reason=reasonBySlug.get(alert.listingSlug);
    const written=await upsertUserNotification(userId,{
      category:alert.category,
      title:alert.title,
      // Why this reached you. A notification that cannot say that is indistinguishable from spam.
      body:reason?`${alert.message} · ${reason}`:alert.message,
      actionHref:`/products/${alert.listingSlug}`,
      relevanceScore:relevance,
      dedupeKey:`alert:${alert.id}`,
      deliverAfter:decision.deliverAfter,
    });
    if(decision.push&&!written.alreadyPushed){
      try{
        await sendPushToUser(userId,{title:alert.title,body:alert.message,url:`/products/${alert.listingSlug}`,tag:`alert:${alert.id}`});
        await markNotificationPushed(userId,`alert:${alert.id}`);
      }catch{/* best-effort: push must never break notification creation */}
    }
  }
  return listUserNotifications(userId,{limit:100});
}
