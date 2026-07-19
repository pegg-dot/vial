import type { QueryResultRow } from "pg";
import { getDatabase } from "@/server/db/client";
import { newId } from "@/server/db/ids";

export type OperationalSeverity = "info" | "warning" | "critical";
export interface OperationalMetric { key:string; label:string; value:number; unit:"count"|"milliseconds"|"percent"|"currency"; severity:OperationalSeverity; detail:string }
export interface OperationalAlert extends QueryResultRow { id:string; alert_key:string; severity:OperationalSeverity; title:string; summary:string; status:"open"|"resolved"; details:Record<string,unknown>|string; opened_at:string|Date; updated_at:string|Date }
function severity(value:number,warning:number,critical:number):OperationalSeverity{return value>=critical?"critical":value>=warning?"warning":"info"}
function numeric(value:unknown){const parsed=Number(value??0);return Number.isFinite(parsed)?parsed:0}
async function scalar(query:string,params:unknown[]=[]){const db=await getDatabase();const row=(await db.query<QueryResultRow&{value:unknown}>(query,params)).rows[0];return numeric(row?.value)}

export async function collectOperationalMetrics(){
  const started=Date.now();
  const [pendingReview,agingReview,failedLogins,stalledRefreshes,queuedRefreshes,reconciliationVariance,openFraud,openSupport,openAlerts]=await Promise.all([
    scalar(`SELECT COUNT(*) AS value FROM evidence_claims WHERE review_status='pending'`),
    scalar(`SELECT COUNT(*) AS value FROM evidence_claims WHERE review_status='pending' AND created_at<NOW()-INTERVAL '24 hours'`),
    scalar(`SELECT COUNT(*) AS value FROM auth_login_attempts WHERE outcome IN ('failure','locked') AND created_at>NOW()-INTERVAL '15 minutes'`),
    scalar(`SELECT COUNT(*) AS value FROM refresh_jobs WHERE status IN ('claimed','running') AND COALESCE(started_at,created_at)<NOW()-INTERVAL '30 minutes'`),
    scalar(`SELECT COUNT(*) AS value FROM refresh_jobs WHERE status='queued'`),
    scalar(`SELECT COALESCE(SUM(ABS(variance)),0) AS value FROM commerce_reconciliation_runs WHERE started_at>NOW()-INTERVAL '24 hours'`),
    scalar(`SELECT COUNT(*) AS value FROM fraud_cases WHERE status IN ('open','investigating')`),
    scalar(`SELECT COUNT(*) AS value FROM support_cases WHERE status NOT IN ('resolved','closed')`),
    scalar(`SELECT COUNT(*) AS value FROM operational_alerts WHERE status='open'`),
  ]);
  const metrics:OperationalMetric[]=[
    {key:"review.pending",label:"Pending review",value:pendingReview,unit:"count",severity:severity(pendingReview,20,50),detail:"Claims awaiting a human decision."},
    {key:"review.aging",label:"Aging review",value:agingReview,unit:"count",severity:severity(agingReview,5,15),detail:"Pending claims older than 24 hours."},
    {key:"security.failed_logins",label:"Failed logins",value:failedLogins,unit:"count",severity:severity(failedLogins,10,25),detail:"Failed or blocked login attempts in the past 15 minutes."},
    {key:"refresh.stalled",label:"Stalled refreshes",value:stalledRefreshes,unit:"count",severity:severity(stalledRefreshes,1,3),detail:"Refresh jobs active for more than 30 minutes."},
    {key:"refresh.queued",label:"Refresh queue",value:queuedRefreshes,unit:"count",severity:severity(queuedRefreshes,25,75),detail:"Refresh jobs waiting to run."},
    {key:"finance.reconciliation_variance",label:"Reconciliation variance",value:reconciliationVariance,unit:"currency",severity:severity(reconciliationVariance,.01,10),detail:"Absolute reconciliation variance recorded in the past day."},
    {key:"fraud.open_cases",label:"Open fraud cases",value:openFraud,unit:"count",severity:severity(openFraud,10,25),detail:"Fraud cases requiring investigation."},
    {key:"support.open_cases",label:"Open support cases",value:openSupport,unit:"count",severity:severity(openSupport,20,60),detail:"Unresolved customer and seller support cases."},
    {key:"health.readiness_latency",label:"Readiness query",value:Date.now()-started,unit:"milliseconds",severity:"info",detail:"Time to collect the operational health snapshot."},
    {key:"alerts.open",label:"Open alerts",value:openAlerts,unit:"count",severity:severity(openAlerts,5,15),detail:"Durable operational alerts currently open."},
  ];
  await persistMetricSnapshots(metrics);await reconcileAlerts(metrics);return metrics;
}
async function persistMetricSnapshots(metrics:OperationalMetric[]){const db=await getDatabase();for(const m of metrics)await db.query(`INSERT INTO operational_metric_snapshots(id,metric_key,value,dimensions) VALUES($1,$2,$3,$4::jsonb)`,[newId("metric"),m.key,m.value,JSON.stringify({unit:m.unit,severity:m.severity})]);await db.query(`DELETE FROM operational_metric_snapshots WHERE observed_at<NOW()-INTERVAL '30 days'`)}
async function reconcileAlerts(metrics:OperationalMetric[]){const db=await getDatabase();for(const m of metrics){const key=`threshold:${m.key}`;if(m.severity==="info"){await db.query(`UPDATE operational_alerts SET status='resolved',resolved_at=NOW(),updated_at=NOW() WHERE alert_key=$1 AND status='open'`,[key]);continue}await db.query(`INSERT INTO operational_alerts(id,alert_key,severity,title,summary,status,details) VALUES($1,$2,$3,$4,$5,'open',$6::jsonb) ON CONFLICT(alert_key) DO UPDATE SET severity=EXCLUDED.severity,title=EXCLUDED.title,summary=EXCLUDED.summary,status='open',details=EXCLUDED.details,updated_at=NOW(),resolved_at=NULL`,[newId("alert"),key,m.severity,m.label,m.detail,JSON.stringify({value:m.value,unit:m.unit})])}}
export async function getOperationalDashboard(){const metrics=await collectOperationalMetrics();const db=await getDatabase();const alerts=(await db.query<OperationalAlert>(`SELECT * FROM operational_alerts ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,updated_at DESC LIMIT 50`)).rows;const history=(await db.query<QueryResultRow&{metric_key:string;value:string|number;observed_at:string|Date}>(`SELECT metric_key,value,observed_at FROM operational_metric_snapshots ORDER BY observed_at DESC LIMIT 100`)).rows;return{metrics,alerts,history}}
export async function resolveOperationalAlert(id:string){const db=await getDatabase();await db.query(`UPDATE operational_alerts SET status='resolved',resolved_at=NOW(),updated_at=NOW() WHERE id=$1`,[id])}
export async function getSecurityDashboard(){const db=await getDatabase();const[events,attempts,sessions]=await Promise.all([db.query(`SELECT id,event_type,outcome,actor_type,actor_id,target_type,target_id,request_id,metadata,created_at FROM security_audit_events ORDER BY created_at DESC LIMIT 100`),db.query(`SELECT id,normalized_email,outcome,request_id,ip_hash,created_at FROM auth_login_attempts ORDER BY created_at DESC LIMIT 100`),db.query(`SELECT s.id,u.email,u.account_type,s.created_at,s.last_seen_at,s.expires_at,s.revoked_at,s.revocation_reason FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 100`)]);return{events:events.rows as Array<Record<string,unknown>>,attempts:attempts.rows as Array<Record<string,unknown>>,sessions:sessions.rows as Array<Record<string,unknown>>}}
