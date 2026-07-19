import type { QueryResultRow } from "pg";
import { getDatabase } from "@/server/db/client";

export interface ParserQualityRow { profile:string; sources:number; attempts:number; successes:number; successRate:number; changedSnapshots:number; claims:number; pending:number; }
export interface QueueAge { total:number; underHour:number; oneToFour:number; fourToTwentyFour:number; overDay:number; oldestHours:number; }
export async function getQualityDashboard(){const db=await getDatabase();const [profiles,queue]=await Promise.all([
 db.query<QueryResultRow & {parser_profile:string;sources:string|number;attempts:string|number;successes:string|number;changed_snapshots:string|number;claims:string|number;pending:string|number}>(`SELECT p.parser_profile,
 COUNT(DISTINCT p.id) AS sources,
 COUNT(DISTINCT a.id) AS attempts,
 COUNT(DISTINCT a.id) FILTER (WHERE a.status='succeeded') AS successes,
 COUNT(DISTINCT d.id) FILTER (WHERE d.changed=TRUE) AS changed_snapshots,
 COUNT(DISTINCT ec.id) AS claims,
 COUNT(DISTINCT ec.id) FILTER (WHERE ec.review_status='pending') AS pending
 FROM source_refresh_policies p
 LEFT JOIN refresh_jobs j ON j.policy_id=p.id
 LEFT JOIN refresh_attempts a ON a.job_id=j.id
 LEFT JOIN sources s ON s.id=p.source_id
 LEFT JOIN source_snapshot_diffs d ON d.source_id=s.id
 LEFT JOIN source_snapshots ss ON ss.source_id=s.id
 LEFT JOIN evidence_claims ec ON ec.source_snapshot_id=ss.id
 GROUP BY p.parser_profile ORDER BY p.parser_profile`),
 db.query<QueryResultRow & {total:string|number;under_hour:string|number;one_to_four:string|number;four_to_twenty_four:string|number;over_day:string|number;oldest_hours:string|number|null}>(`SELECT COUNT(*) AS total,
 COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '1 hour') AS under_hour,
 COUNT(*) FILTER (WHERE created_at < NOW()-INTERVAL '1 hour' AND created_at >= NOW()-INTERVAL '4 hours') AS one_to_four,
 COUNT(*) FILTER (WHERE created_at < NOW()-INTERVAL '4 hours' AND created_at >= NOW()-INTERVAL '24 hours') AS four_to_twenty_four,
 COUNT(*) FILTER (WHERE created_at < NOW()-INTERVAL '24 hours') AS over_day,
 COALESCE(MAX(EXTRACT(EPOCH FROM (NOW()-created_at))/3600),0) AS oldest_hours
 FROM evidence_claims WHERE review_status='pending'`)
]);
 const parsers:ParserQualityRow[]=profiles.rows.map(r=>{const attempts=Number(r.attempts);const successes=Number(r.successes);return {profile:r.parser_profile,sources:Number(r.sources),attempts,successes,successRate:attempts?Math.round(successes/attempts*100):100,changedSnapshots:Number(r.changed_snapshots),claims:Number(r.claims),pending:Number(r.pending)}});
 const q=queue.rows[0];const queueAge:QueueAge={total:Number(q?.total??0),underHour:Number(q?.under_hour??0),oneToFour:Number(q?.one_to_four??0),fourToTwentyFour:Number(q?.four_to_twenty_four??0),overDay:Number(q?.over_day??0),oldestHours:Number(q?.oldest_hours??0)};
 return {parsers,queueAge};}
