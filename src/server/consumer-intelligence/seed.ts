import type { SqlConnection } from "@/server/db/client";
import { recordDecisionEvent, upsertMarketChangeSummary, upsertUserNotification } from "./repository";

export async function seedConsumerIntelligence(db:SqlConnection){
  const userId="user:customer:nora";
  const exists=await db.query(`SELECT 1 FROM auth_users WHERE id=$1`,[userId]);
  if(!exists.rows[0])return;
  await db.query(`INSERT INTO user_market_preferences(user_id,price_floor,price_ceiling,max_shipping_days,evidence_priorities,preferred_vendor_slugs,preferred_compound_slugs,home_view) VALUES($1,25,95,5,$2::jsonb,$3::jsonb,$4::jsonb,'evidence-first') ON CONFLICT(user_id) DO NOTHING`,[userId,JSON.stringify(["batch_linkage","report_confirmation","freshness","sampling"]),JSON.stringify(["northstar-research","helix-science"]),JSON.stringify(["bpc-157","ghk-cu"])]);
  await db.query(`INSERT INTO entity_follows(user_id,entity_type,entity_slug) VALUES($1,'compound','bpc-157'),($1,'vendor','northstar-research') ON CONFLICT DO NOTHING`,[userId]);
  await db.query(`INSERT INTO saved_searches(id,user_id,name,query,filters,alert_mode,last_result_count,last_run_at) VALUES('saved-search:nora:bpc-current',$1,'BPC-157 with current evidence','bpc157',$2::jsonb,'important',3,NOW()-INTERVAL '1 day'),('saved-search:nora:copper',$1,'Copper peptide listings','copper tripeptide',$3::jsonb,'all',2,NOW()-INTERVAL '2 days') ON CONFLICT(id) DO NOTHING`,[userId,JSON.stringify({types:["listing"]}),JSON.stringify({types:["compound","listing"]})]);
  await db.query(`INSERT INTO comparison_sessions(id,user_id,name,listing_slugs,is_default,last_viewed_at) VALUES('comparison:nora:default',$1,'Current comparison',$2::jsonb,TRUE,NOW()-INTERVAL '3 hours') ON CONFLICT(id) DO NOTHING`,[userId,JSON.stringify(["northstar-bpc-157-10mg","helix-bpc-157-10mg","meridian-bpc-157-5mg"])]);
  const decisions=await db.query<{count:string|number}>(`SELECT COUNT(*) count FROM decision_events WHERE user_id=$1`,[userId]);
  if(Number(decisions.rows[0]?.count??0)===0){
    await recordDecisionEvent(userId,{eventType:"comparison_created",subjectType:"compound",subjectId:"bpc-157",metadata:{listingCount:3}},db);
    await recordDecisionEvent(userId,{eventType:"listing_saved",subjectType:"listing",subjectId:"northstar-bpc-157-10mg",metadata:{reason:"Strong batch linkage"}},db);
    await recordDecisionEvent(userId,{eventType:"evidence_opened",subjectType:"listing",subjectId:"helix-bpc-157-10mg",metadata:{dimension:"report_confirmation"}},db);
  }
  // Seeded demo notifications represent already-delivered history, so pin deliver_after in the past.
  // Otherwise quietDeliveryTime would defer them whenever the seed runs during the default 22:00 quiet
  // window, making the fixture (and any test that reads it) non-deterministic by wall-clock time.
  await upsertUserNotification(userId,{category:"evidence_update",title:"Northstar report confirmation remains current",body:"The latest reviewed record still shows issuer confirmation and batch linkage.",actionHref:"/products/northstar-bpc-157-10mg",relevanceScore:0.92,dedupeKey:"seed:northstar-evidence",deliverAfter:new Date(0)},db);
  await upsertUserNotification(userId,{category:"price_change",title:"Helix BPC-157 moved inside your price range",body:"The fictional observed price is now within your configured $25–$95 range.",actionHref:"/products/helix-bpc-157-10mg",relevanceScore:0.78,dedupeKey:"seed:helix-price",deliverAfter:new Date(0)},db);
  await upsertMarketChangeSummary(userId,{periodStart:new Date(Date.now()-7*24*60*60*1000),periodEnd:new Date(),title:"2 high-relevance changes in your market",summary:"One evidence record remained current and one watched listing moved inside your preferred price range.",items:[{kind:"evidence_update",title:"Northstar evidence record remained current",detail:"Issuer confirmation and batch linkage remain visible.",href:"/products/northstar-bpc-157-10mg",relevance:0.92,occurredAt:new Date(Date.now()-5*60*60*1000).toISOString()},{kind:"price_change",title:"Helix entered your preferred range",detail:"The observed fictional price is within your configured range.",href:"/products/helix-bpc-157-10mg",relevance:0.78,occurredAt:new Date(Date.now()-20*60*60*1000).toISOString()}],relevanceScore:0.85,dedupeKey:"seed:nora:week"},db);
}
