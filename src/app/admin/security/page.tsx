import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { getSecurityDashboard } from "@/server/observability/metrics";

export const metadata: Metadata = { title: "Security audit" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requirePermission("security:read");
  const data = await getSecurityDashboard();
  return <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Security operations</p><h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Audit and session ledger</h1><p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Authentication activity, signed-session state, and sensitive actions are recorded independently from application logs.</p>
    <div className="mt-7 grid gap-4 md:grid-cols-3"><Metric label="Audit events" value={data.events.length}/><Metric label="Login attempts" value={data.attempts.length}/><Metric label="Recent sessions" value={data.sessions.length}/></div>
    <Table title="Security events" rows={data.events} columns={["event_type","outcome","actor_type","target_type","request_id","created_at"]}/>
    <Table title="Login attempts" rows={data.attempts} columns={["normalized_email","outcome","request_id","ip_hash","created_at"]}/>
    <Table title="Session state" rows={data.sessions} columns={["email","account_type","last_seen_at","expires_at","revoked_at","revocation_reason"]}/>
  </div>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="ink rounded-[18px] bg-[#111214] p-5 text-white"><p className="text-xs font-bold text-[#8fa2ff]">{label}</p><p className="mt-3 text-3xl font-extrabold tabular-nums">{value}</p></div>}
function Table({title,rows,columns}:{title:string;rows:Array<Record<string,unknown>>;columns:string[]}){return <section className="ink hard mt-7 overflow-x-auto rounded-[20px] bg-white p-6"><h2 className="text-xl font-extrabold tracking-[-.03em]">{title}</h2><table className="mt-5 w-full min-w-[900px] text-left text-xs"><thead className="font-extrabold uppercase tracking-[.06em] text-[var(--muted)]"><tr>{columns.map(c=><th key={c} className="pb-3 pr-4 capitalize">{c.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={String(row.id??index)} className="border-t border-[#111214]/10">{columns.map(c=><td key={c} className="max-w-[220px] truncate py-3 pr-4 font-mono">{row[c]==null?"—":typeof row[c]==="object"?JSON.stringify(row[c]):String(row[c])}</td>)}</tr>)}</tbody></table>{!rows.length&&<p className="py-8 text-center text-sm font-medium text-[var(--muted)]">No records.</p>}</section>}
