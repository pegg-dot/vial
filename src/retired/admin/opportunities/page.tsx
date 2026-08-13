import type { Metadata } from "next";
import { ArrowUpRight, CircleDot, Lightbulb, Radar, RefreshCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { runIntelligenceSweepAction, updateOpportunityStatusAction } from "../operations-actions";
import { requireStaff } from "@/server/auth/session";
import { getIntelligenceMetrics, getOpportunitySignals } from "@/server/intelligence/repository";

export const metadata: Metadata = { title: "Opportunity signals" };
export const dynamic = "force-dynamic";
const statuses = ["open", "watching", "resolved", "dismissed", "all"];

function target(signal: Awaited<ReturnType<typeof getOpportunitySignals>>[number]) {
  if (!signal.entitySlug) return null;
  if (signal.entityType === "listing") return `/products/${signal.entitySlug}`;
  if (signal.entityType === "vendor") return `/vendors/${signal.entitySlug}`;
  if (signal.entityType === "compound") return `/compounds/${signal.entitySlug}`;
  return null;
}

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const params = await searchParams;
  const active = statuses.includes(params.status ?? "") ? params.status! : "open";
  const [signals, metrics] = await Promise.all([getOpportunitySignals({ status: active, limit: 150 }), getIntelligenceMetrics()]);
  return <div>
    <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Derived market intelligence</p>
    <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-4xl font-extrabold tracking-[-.055em] sm:text-5xl">Compounding signals.</h1><p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">One observed change can reveal several second-order opportunities: evidence gaps, fragmented pricing, thin supply, source fragility, vendor onboarding, or a new batch without corroboration. Signals expose those consequences without converting them into product recommendations.</p></div><form action={runIntelligenceSweepAction}><button className="ink hard-sm press inline-flex h-11 items-center gap-2 rounded-full bg-[#111214] px-5 text-sm font-bold text-white"><RefreshCcw className="size-4" />Recompute market</button></form></div>
    {params.error && <div className="ink-1 mt-6 rounded-[14px] bg-[#fff1f0] px-4 py-3 text-sm font-medium text-[#d3372c]">{decodeURIComponent(params.error)}</div>}
    {params.sweep && <div className="ink-1 mt-6 rounded-[14px] bg-[#e6fbf4] px-4 py-3 text-sm font-medium text-[#0e8f80]">Evaluated {params.evaluated} market conditions and emitted {params.sweep} active signals.</div>}
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Open" value={metrics.open} icon={Lightbulb}/><Metric label="Watching" value={metrics.watching} icon={CircleDot}/><Metric label="Causal traces" value={metrics.traces} icon={Radar}/><Metric label="Alerts" value={metrics.alerts} icon={ShieldAlert}/><Metric label="Metric points" value={metrics.metrics} icon={RefreshCcw}/></div>
    <div className="mt-8 flex flex-wrap gap-2">{statuses.map(status => <Link key={status} href={`/admin/opportunities?status=${status}`} className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${active === status ? "ink hard-sm bg-[#2b31d8] text-white" : "ink-1 press bg-white"}`}>{status}</Link>)}</div>
    <div className="mt-6 grid gap-4 xl:grid-cols-2">{signals.map(signal => {const href=target(signal);return <article key={signal.id} className="ink hard rounded-[20px] bg-white p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="ink-1 rounded-full bg-[#e9eaff] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#2b31d8]">{signal.signalType.replaceAll("-", " ")}</span><span className="ink-1 rounded-full bg-[#f7f7f4] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[var(--muted)]">{signal.status}</span></div><h2 className="mt-4 text-xl font-extrabold tracking-[-.03em]">{signal.title}</h2><p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{signal.summary}</p></div><div className="ink grid size-14 shrink-0 place-items-center rounded-[14px] bg-[#111214] text-white"><span className="text-lg font-extrabold tabular-nums">{Math.round(signal.score)}</span></div></div><div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-[#111214] pt-4 text-xs font-medium text-[var(--muted)]"><span>{signal.entityLabel}</span><span>{Math.round(signal.confidence*100)}% confidence</span><Link href={`/admin/traces#${signal.rootEventId}`} className="font-bold text-[#2b31d8]">Trace →</Link>{href && <Link href={href} className="inline-flex items-center gap-1 font-bold text-[#2b31d8]">Public record <ArrowUpRight className="size-3" /></Link>}</div><div className="mt-4 flex flex-wrap gap-2">{signal.status !== "watching" && <StatusButton id={signal.id} status="watching" label="Watch"/>}{signal.status !== "open" && <StatusButton id={signal.id} status="open" label="Reopen"/>}{signal.status !== "resolved" && <StatusButton id={signal.id} status="resolved" label="Resolve"/>}{signal.status !== "dismissed" && <StatusButton id={signal.id} status="dismissed" label="Dismiss"/>}</div></article>})}</div>
    {signals.length===0&&<div className="ink hard mt-8 rounded-[20px] bg-white p-12 text-center"><Lightbulb className="mx-auto size-6 text-[#2b31d8]"/><h2 className="mt-4 text-xl font-extrabold">No signals in this state.</h2><p className="mt-2 text-sm font-medium text-[var(--muted)]">Run a market sweep or change the status filter.</p></div>}
  </div>;
}
function Metric({label,value,icon:Icon}:{label:string;value:number;icon:React.ComponentType<{className?:string}>}){return <div className="ink hard rounded-[18px] bg-white p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--muted)]">{label}</p><Icon className="size-4 text-[#2b31d8]"/></div><p className="mt-5 text-4xl font-extrabold tracking-[-.055em] tabular-nums">{value}</p></div>}
function StatusButton({id,status,label}:{id:string;status:"open"|"watching"|"resolved"|"dismissed";label:string}){return <form action={updateOpportunityStatusAction}><input type="hidden" name="id" value={id}/><input type="hidden" name="status" value={status}/><button className="ink-1 hard-sm press rounded-full bg-white px-3.5 py-2 text-[11px] font-bold">{label}</button></form>}
