import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import type {
  ComparisonSession,
  ConsumerPreferences,
  DecisionEvent,
  MarketChangeSummary,
  SavedSearch,
  UserNotification,
} from "./types";

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

const defaultPreferences: ConsumerPreferences = {
  priceFloor: 0,
  priceCeiling: 500,
  maxShippingDays: 7,
  evidencePriorities: ["batch_linkage", "report_confirmation", "freshness"],
  requiredEvidenceLevels: [],
  preferredVendorSlugs: [],
  hiddenVendorSlugs: [],
  preferredCompoundSlugs: [],
  homeView: "balanced",
  personalizationEnabled: true,
};

interface PreferenceRow extends QueryResultRow {
  price_floor: string | number;
  price_ceiling: string | number;
  max_shipping_days: number;
  evidence_priorities: unknown;
  required_evidence_levels: unknown;
  preferred_vendor_slugs: unknown;
  hidden_vendor_slugs: unknown;
  preferred_compound_slugs: unknown;
  home_view: ConsumerPreferences["homeView"];
  personalization_enabled: boolean;
}

function toPreferences(row?: PreferenceRow): ConsumerPreferences {
  if (!row) return defaultPreferences;
  return {
    priceFloor: Number(row.price_floor),
    priceCeiling: Number(row.price_ceiling),
    maxShippingDays: Number(row.max_shipping_days),
    evidencePriorities: parseJson(row.evidence_priorities, defaultPreferences.evidencePriorities),
    requiredEvidenceLevels: parseJson(row.required_evidence_levels, []),
    preferredVendorSlugs: parseJson(row.preferred_vendor_slugs, []),
    hiddenVendorSlugs: parseJson(row.hidden_vendor_slugs, []),
    preferredCompoundSlugs: parseJson(row.preferred_compound_slugs, []),
    homeView: row.home_view ?? "balanced",
    personalizationEnabled: Boolean(row.personalization_enabled),
  };
}

export async function getConsumerPreferences(userId: string, connection?: SqlConnection) {
  const db = connection ?? await getDatabase();
  const result = await db.query<PreferenceRow>(`SELECT * FROM user_market_preferences WHERE user_id=$1`, [userId]);
  return toPreferences(result.rows[0]);
}

export async function updateConsumerPreferences(userId: string, input: ConsumerPreferences, connection?: SqlConnection) {
  const db = connection ?? await getDatabase();
  await db.query(
    `INSERT INTO user_market_preferences
      (user_id,price_floor,price_ceiling,max_shipping_days,evidence_priorities,required_evidence_levels,preferred_vendor_slugs,hidden_vendor_slugs,preferred_compound_slugs,home_view,personalization_enabled,updated_at)
     VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,NOW())
     ON CONFLICT(user_id) DO UPDATE SET
      price_floor=EXCLUDED.price_floor,price_ceiling=EXCLUDED.price_ceiling,max_shipping_days=EXCLUDED.max_shipping_days,
      evidence_priorities=EXCLUDED.evidence_priorities,required_evidence_levels=EXCLUDED.required_evidence_levels,
      preferred_vendor_slugs=EXCLUDED.preferred_vendor_slugs,hidden_vendor_slugs=EXCLUDED.hidden_vendor_slugs,
      preferred_compound_slugs=EXCLUDED.preferred_compound_slugs,home_view=EXCLUDED.home_view,
      personalization_enabled=EXCLUDED.personalization_enabled,updated_at=NOW()`,
    [userId,input.priceFloor,input.priceCeiling,input.maxShippingDays,JSON.stringify(input.evidencePriorities),JSON.stringify(input.requiredEvidenceLevels),JSON.stringify(input.preferredVendorSlugs),JSON.stringify(input.hiddenVendorSlugs),JSON.stringify(input.preferredCompoundSlugs),input.homeView,input.personalizationEnabled],
  );
  return getConsumerPreferences(userId, db);
}

interface SavedSearchRow extends QueryResultRow {
  id:string;name:string;query:string;filters:unknown;alert_mode:SavedSearch["alertMode"];active:boolean;last_result_count:number;
  last_run_at:Date|string|null;created_at:Date|string;updated_at:Date|string;
}
function toSavedSearch(row: SavedSearchRow): SavedSearch {
  return {id:row.id,name:row.name,query:row.query,filters:parseJson(row.filters,{}),alertMode:row.alert_mode,active:row.active,lastResultCount:Number(row.last_result_count),lastRunAt:row.last_run_at?new Date(row.last_run_at).toISOString():undefined,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()};
}
export async function listSavedSearches(userId:string,connection?:SqlConnection){const db=connection??await getDatabase();const result=await db.query<SavedSearchRow>(`SELECT * FROM saved_searches WHERE user_id=$1 ORDER BY updated_at DESC`,[userId]);return result.rows.map(toSavedSearch)}
export async function getSavedSearch(userId:string,id:string,connection?:SqlConnection){const db=connection??await getDatabase();const result=await db.query<SavedSearchRow>(`SELECT * FROM saved_searches WHERE user_id=$1 AND id=$2`,[userId,id]);return result.rows[0]?toSavedSearch(result.rows[0]):null}
export async function createSavedSearch(userId:string,input:{name:string;query:string;filters?:Record<string,unknown>;alertMode?:SavedSearch["alertMode"]},connection?:SqlConnection){const db=connection??await getDatabase();const id=newId("saved-search");await db.query(`INSERT INTO saved_searches(id,user_id,name,query,filters,alert_mode) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,[id,userId,input.name,input.query,JSON.stringify(input.filters??{}),input.alertMode??"important"]);return getSavedSearch(userId,id,db)}
export async function updateSavedSearchResult(userId:string,id:string,count:number,connection?:SqlConnection){const db=connection??await getDatabase();await db.query(`UPDATE saved_searches SET last_result_count=$3,last_run_at=NOW(),updated_at=NOW() WHERE user_id=$1 AND id=$2`,[userId,id,count])}
export async function deleteSavedSearch(userId:string,id:string,connection?:SqlConnection){const db=connection??await getDatabase();const result=await db.query(`DELETE FROM saved_searches WHERE user_id=$1 AND id=$2 RETURNING id`,[userId,id]);return Boolean(result.rows[0])}

interface ComparisonRow extends QueryResultRow{id:string;name:string;listing_slugs:unknown;notes:unknown;status:string;is_default:boolean;last_viewed_at:Date|string;updated_at:Date|string}
function toComparison(row:ComparisonRow):ComparisonSession{return{id:row.id,name:row.name,listingSlugs:parseJson<string[]>(row.listing_slugs,[]),notes:parseJson<Record<string,string>>(row.notes,{}),status:row.status,isDefault:row.is_default,lastViewedAt:new Date(row.last_viewed_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()}}
export async function getDefaultComparison(userId:string,connection?:SqlConnection){const db=connection??await getDatabase();const result=await db.query<ComparisonRow>(`SELECT * FROM comparison_sessions WHERE user_id=$1 AND is_default=TRUE LIMIT 1`,[userId]);return result.rows[0]?toComparison(result.rows[0]):null}
export async function listComparisons(userId:string,connection?:SqlConnection){const db=connection??await getDatabase();const result=await db.query<ComparisonRow>(`SELECT * FROM comparison_sessions WHERE user_id=$1 ORDER BY is_default DESC,updated_at DESC`,[userId]);return result.rows.map(toComparison)}
export async function saveDefaultComparison(userId:string,listingSlugs:string[],connection?:SqlConnection){const db=connection??await getDatabase();const current=await getDefaultComparison(userId,db);const id=current?.id??newId("comparison");await db.query(`INSERT INTO comparison_sessions(id,user_id,name,listing_slugs,is_default,last_viewed_at,updated_at) VALUES($1,$2,'Current comparison',$3::jsonb,TRUE,NOW(),NOW()) ON CONFLICT(id) DO UPDATE SET listing_slugs=EXCLUDED.listing_slugs,last_viewed_at=NOW(),updated_at=NOW()`,[id,userId,JSON.stringify(listingSlugs.slice(0,4))]);return getDefaultComparison(userId,db)}
export async function createNamedComparison(userId:string,input:{name:string;listingSlugs:string[];notes?:Record<string,string>},connection?:SqlConnection){const db=connection??await getDatabase();const id=newId("comparison");await db.query(`INSERT INTO comparison_sessions(id,user_id,name,listing_slugs,notes,is_default) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,FALSE)`,[id,userId,input.name,JSON.stringify(input.listingSlugs.slice(0,4)),JSON.stringify(input.notes??{})]);return (await listComparisons(userId,db)).find(item=>item.id===id)??null}

export async function listFollows(userId:string,connection?:SqlConnection){const db=connection??await getDatabase();return (await db.query<{entity_type:string;entity_slug:string}>(`SELECT entity_type,entity_slug FROM entity_follows WHERE user_id=$1 ORDER BY created_at DESC`,[userId])).rows.map(row=>({entityType:row.entity_type,entitySlug:row.entity_slug}))}
/**
 * The listings a user's follows actually cover, with the follow that pulled each one in.
 *
 * Following was a ranking signal and nothing else: `syncWatchlistNotifications` read only
 * `user_watchlists`, so following a vendor produced no alert anywhere while /account/notifications
 * told the user it delivered "changes to the things you follow". This is the missing join.
 *
 * The reason travels with the row because a notification that cannot say why it reached you is
 * indistinguishable from spam — and it is what lets the inbox name the follow the user made.
 */
export async function listFollowedListingSlugs(userId:string,connection?:SqlConnection):Promise<{listingSlug:string;reason:string}[]>{
  const db=connection??await getDatabase();
  const result=await db.query<{listing_slug:string;compound_slug:string;compound_name:string;vendor_slug:string;vendor_name:string}>(
    `SELECT l.slug listing_slug,c.slug compound_slug,c.canonical_name compound_name,o.slug vendor_slug,o.display_name vendor_name
     FROM entity_follows f
     JOIN compounds c ON f.entity_type='compound' AND c.slug=f.entity_slug
     JOIN products p ON p.compound_id=c.id AND p.status='active'
     JOIN organizations o ON o.id=p.vendor_id
     JOIN listings l ON l.product_id=p.id
     WHERE f.user_id=$1
     UNION
     SELECT l.slug,c.slug,c.canonical_name,o.slug,o.display_name
     FROM entity_follows f
     JOIN organizations o ON f.entity_type='vendor' AND o.slug=f.entity_slug
     JOIN products p ON p.vendor_id=o.id AND p.status='active'
     JOIN compounds c ON c.id=p.compound_id
     JOIN listings l ON l.product_id=p.id
     WHERE f.user_id=$1`,
    [userId],
  );
  const follows=await listFollows(userId,db);
  const followedCompounds=new Set(follows.filter(item=>item.entityType==="compound").map(item=>item.entitySlug));
  const followedVendors=new Set(follows.filter(item=>item.entityType==="vendor").map(item=>item.entitySlug));
  // One row per listing. A listing reached by BOTH a followed compound and a followed vendor must
  // not become two notifications for the same change; name the compound, which is the narrower reason.
  const byListing=new Map<string,string>();
  for(const row of result.rows){
    if(byListing.has(row.listing_slug))continue;
    const reason=followedCompounds.has(row.compound_slug)?`You follow ${row.compound_name}`:followedVendors.has(row.vendor_slug)?`You follow ${row.vendor_name}`:"";
    if(reason)byListing.set(row.listing_slug,reason);
  }
  return Array.from(byListing,([listingSlug,reason])=>({listingSlug,reason}));
}

export async function getNotificationChannelPreferences(userId:string,connection?:SqlConnection){
  const db=connection??await getDatabase();
  const row=(await db.query<{followed_entity_alerts:boolean;price_alerts:boolean}>(`SELECT followed_entity_alerts,price_alerts FROM user_notification_preferences WHERE user_id=$1`,[userId])).rows[0];
  // No row means the user has never opened preferences. The schema default is TRUE, so the absence
  // of a row must read as "on" too — defaulting to off here would silently mute a user who never
  // touched the setting.
  return{followedEntityAlerts:row?Boolean(row.followed_entity_alerts):true,priceAlerts:row?Boolean(row.price_alerts):true};
}

export async function setFollow(userId:string,entityType:string,entitySlug:string,followed:boolean,connection?:SqlConnection){const db=connection??await getDatabase();if(followed)await db.query(`INSERT INTO entity_follows(user_id,entity_type,entity_slug) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[userId,entityType,entitySlug]);else await db.query(`DELETE FROM entity_follows WHERE user_id=$1 AND entity_type=$2 AND entity_slug=$3`,[userId,entityType,entitySlug]);return listFollows(userId,db)}

interface DecisionRow extends QueryResultRow{id:string;event_type:string;subject_type:string;subject_id:string;metadata:unknown;occurred_at:Date|string}
export async function recordDecisionEvent(userId:string,input:{eventType:string;subjectType:string;subjectId:string;metadata?:Record<string,unknown>},connection?:SqlConnection){const db=connection??await getDatabase();const id=newId("decision");await db.query(`INSERT INTO decision_events(id,user_id,event_type,subject_type,subject_id,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[id,userId,input.eventType,input.subjectType,input.subjectId,JSON.stringify(input.metadata??{})]);return id}
export async function listDecisionEvents(userId:string,limit=50,connection?:SqlConnection):Promise<DecisionEvent[]>{const db=connection??await getDatabase();const result=await db.query<DecisionRow>(`SELECT * FROM decision_events WHERE user_id=$1 ORDER BY occurred_at DESC LIMIT $2`,[userId,limit]);return result.rows.map(row=>({id:row.id,eventType:row.event_type,subjectType:row.subject_type,subjectId:row.subject_id,metadata:parseJson(row.metadata,{}),occurredAt:new Date(row.occurred_at).toISOString()}))}

interface NotificationRow extends QueryResultRow{id:string;category:string;title:string;body:string;action_href:string|null;relevance_score:number|string;status:UserNotification["status"];created_at:Date|string;read_at:Date|string|null}
function toNotification(row:NotificationRow):UserNotification{return{id:row.id,category:row.category,title:row.title,body:row.body,actionHref:row.action_href??undefined,relevanceScore:Number(row.relevance_score),status:row.status,createdAt:new Date(row.created_at).toISOString(),readAt:row.read_at?new Date(row.read_at).toISOString():undefined}}
export async function listUserNotifications(userId:string,input:{status?:string;limit?:number}={},connection?:SqlConnection){const db=connection??await getDatabase();const result=await db.query<NotificationRow>(`SELECT un.* FROM user_notifications un LEFT JOIN user_notification_preferences p ON p.user_id=un.user_id WHERE un.user_id=$1 AND un.deliver_after<=NOW() AND un.relevance_score>=COALESCE(p.relevance_threshold,0) AND ($2::text IS NULL OR un.status=$2) ORDER BY CASE un.status WHEN 'unread' THEN 0 ELSE 1 END,un.relevance_score DESC,un.created_at DESC LIMIT $3`,[userId,input.status??null,input.limit??100]);return result.rows.map(toNotification)}
function minuteValue(value:string){const [hour,minute]=value.split(":").map(Number);return Number.isFinite(hour)&&Number.isFinite(minute)?hour*60+minute:0}
async function quietDeliveryTime(userId:string,now:Date,db:SqlConnection){const row=(await db.query<{quiet_hours_start:string;quiet_hours_end:string;timezone:string}>(`SELECT quiet_hours_start,quiet_hours_end,timezone FROM user_notification_preferences WHERE user_id=$1`,[userId])).rows[0];if(!row)return now;let parts:Intl.DateTimeFormatPart[];try{parts=new Intl.DateTimeFormat("en-US",{timeZone:row.timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now)}catch{return now}const hour=Number(parts.find(part=>part.type==="hour")?.value??0),minute=Number(parts.find(part=>part.type==="minute")?.value??0),current=hour*60+minute,start=minuteValue(row.quiet_hours_start),end=minuteValue(row.quiet_hours_end);const active=start===end?false:start<end?current>=start&&current<end:current>=start||current<end;if(!active)return now;const minutesUntilEnd=start<end?end-current:current<end?end-current:24*60-current+end;return new Date(now.getTime()+Math.max(1,minutesUntilEnd)*60_000)}
export async function upsertUserNotification(userId:string,input:{category:string;title:string;body:string;actionHref?:string;relevanceScore:number;dedupeKey:string;deliverAfter?:Date},connection?:SqlConnection){const db=connection??await getDatabase();const deliverAfter=input.deliverAfter??await quietDeliveryTime(userId,new Date(),db);await db.query(`INSERT INTO user_notifications(id,user_id,category,title,body,action_href,relevance_score,dedupe_key,deliver_after) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,dedupe_key) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,action_href=EXCLUDED.action_href,relevance_score=GREATEST(user_notifications.relevance_score,EXCLUDED.relevance_score),deliver_after=LEAST(user_notifications.deliver_after,EXCLUDED.deliver_after)`,[newId("notification"),userId,input.category,input.title,input.body,input.actionHref??null,input.relevanceScore,input.dedupeKey,deliverAfter])}
export async function updateNotificationStatus(userId:string,id:string,status:UserNotification["status"],connection?:SqlConnection){const db=connection??await getDatabase();const result=await db.query(`UPDATE user_notifications SET status=$3,read_at=CASE WHEN $3='read' THEN NOW() ELSE read_at END WHERE user_id=$1 AND id=$2 RETURNING id`,[userId,id,status]);return Boolean(result.rows[0])}

interface SummaryRow extends QueryResultRow{id:string;period_start:Date|string;period_end:Date|string;title:string;summary:string;items:unknown;relevance_score:number|string;generated_at:Date|string;read_at:Date|string|null}
function toSummary(row:SummaryRow):MarketChangeSummary{return{id:row.id,title:row.title,summary:row.summary,items:parseJson(row.items,[]),relevanceScore:Number(row.relevance_score),periodStart:new Date(row.period_start).toISOString(),periodEnd:new Date(row.period_end).toISOString(),generatedAt:new Date(row.generated_at).toISOString(),readAt:row.read_at?new Date(row.read_at).toISOString():undefined}}
export async function listMarketChangeSummaries(userId:string,limit=10,connection?:SqlConnection){const db=connection??await getDatabase();const result=await db.query<SummaryRow>(`SELECT * FROM market_change_summaries WHERE user_id=$1 ORDER BY generated_at DESC LIMIT $2`,[userId,limit]);return result.rows.map(toSummary)}
export async function upsertMarketChangeSummary(userId:string,input:{periodStart:Date;periodEnd:Date;title:string;summary:string;items:unknown[];relevanceScore:number;dedupeKey:string},connection?:SqlConnection){const db=connection??await getDatabase();await db.query(`INSERT INTO market_change_summaries(id,user_id,period_start,period_end,title,summary,items,relevance_score,dedupe_key) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) ON CONFLICT(user_id,dedupe_key) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,items=EXCLUDED.items,relevance_score=EXCLUDED.relevance_score,generated_at=NOW()`,[newId("summary"),userId,input.periodStart,input.periodEnd,input.title,input.summary,JSON.stringify(input.items),input.relevanceScore,input.dedupeKey]);return (await listMarketChangeSummaries(userId,1,db))[0]??null}

export async function getVisitState(userId:string,connection?:SqlConnection){const db=connection??await getDatabase();return (await db.query<{previous_seen_at:Date|string|null;last_seen_at:Date|string;last_home_seen_at:Date|string|null}>(`SELECT * FROM user_visit_state WHERE user_id=$1`,[userId])).rows[0]??null}
export async function touchVisit(userId:string,home=false,connection?:SqlConnection){const db=connection??await getDatabase();await db.query(`INSERT INTO user_visit_state(user_id,previous_seen_at,last_seen_at,last_home_seen_at) VALUES($1,NULL,NOW(),CASE WHEN $2 THEN NOW() ELSE NULL END) ON CONFLICT(user_id) DO UPDATE SET previous_seen_at=user_visit_state.last_seen_at,last_seen_at=NOW(),last_home_seen_at=CASE WHEN $2 THEN NOW() ELSE user_visit_state.last_home_seen_at END,updated_at=NOW()`,[userId,home])}

export async function getConsumerIntelligenceDashboard(connection?:SqlConnection){const db=connection??await getDatabase();const[summary,views,follows,recent]=await Promise.all([
  db.query<{personalized_users:string|number;saved_searches:string|number;comparisons:string|number;notifications:string|number;unread:string|number;avg_relevance:string|number;summaries:string|number;decision_events:string|number}>(`SELECT (SELECT COUNT(*) FROM user_market_preferences WHERE personalization_enabled=TRUE) personalized_users,(SELECT COUNT(*) FROM saved_searches WHERE active=TRUE) saved_searches,(SELECT COUNT(*) FROM comparison_sessions) comparisons,(SELECT COUNT(*) FROM user_notifications) notifications,(SELECT COUNT(*) FROM user_notifications WHERE status='unread') unread,(SELECT COALESCE(AVG(relevance_score),0) FROM user_notifications) avg_relevance,(SELECT COUNT(*) FROM market_change_summaries) summaries,(SELECT COUNT(*) FROM decision_events) decision_events`),
  db.query<{home_view:string;count:string|number}>(`SELECT home_view,COUNT(*) count FROM user_market_preferences GROUP BY home_view ORDER BY count DESC`),
  db.query<{entity_type:string;entity_slug:string;count:string|number}>(`SELECT entity_type,entity_slug,COUNT(*) count FROM entity_follows GROUP BY entity_type,entity_slug ORDER BY count DESC,entity_slug LIMIT 12`),
  db.query<{event_type:string;count:string|number}>(`SELECT event_type,COUNT(*) count FROM decision_events WHERE occurred_at>NOW()-INTERVAL '30 days' GROUP BY event_type ORDER BY count DESC`),
]);const row=summary.rows[0];return{personalizedUsers:Number(row?.personalized_users??0),savedSearches:Number(row?.saved_searches??0),comparisons:Number(row?.comparisons??0),notifications:Number(row?.notifications??0),unread:Number(row?.unread??0),averageRelevance:Number(row?.avg_relevance??0),summaries:Number(row?.summaries??0),decisionEvents:Number(row?.decision_events??0),homeViews:views.rows.map(item=>({view:item.home_view,count:Number(item.count)})),topFollows:follows.rows.map(item=>({entityType:item.entity_type,entitySlug:item.entity_slug,count:Number(item.count)})),recentEvents:recent.rows.map(item=>({eventType:item.event_type,count:Number(item.count)}))}}
