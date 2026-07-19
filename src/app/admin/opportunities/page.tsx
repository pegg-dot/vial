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
    <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Derived market intelligence</p>
    <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Compounding signals.</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">One observed change can reveal several second-order opportunities: evidence gaps, fragmented pricing, thin supply, source fragility, vendor onboarding, or a new batch without corroboration. Signals expose those consequences without converting them into product recommendations.</p></div><form action={runIntelligenceSweepAction}><button className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111214] px-5 text-sm font-semibold text-white"><RefreshCcw className="size-4" />Recompute market</button></form></div>
    {params.error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{decodeURIComponent(params.error)}</div>}
    {params.sweep && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Evaluated {params.evaluated} market conditions and emitted {params.sweep} active signals.</div>}
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Open" value={metrics.open} icon={Lightbulb}/><Metric label="Watching" value={metrics.watching} icon={CircleDot}/><Metric label="Causal traces" value={metrics.traces} icon={Radar}/><Metric label="Alerts" value={metrics.alerts} icon={ShieldAlert}/><Metric label="Metric points" value={metrics.metrics} icon={RefreshCcw}/></div>
    <div className="mt-8 flex flex-wrap gap-2">{statuses.map(status => <Link key={status} href={`/admin/opportunities?status=${status}`} className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${active === status ? "bg-black text-white" : "border border-black/[.08] bg-white"}`}>{status}</Link>)}</div>
    <div className="mt-6 grid gap-4 xl:grid-cols-2">{signals.map(signal => {const href=target(signal);return <article key={signal.id} className="rounded-[28px] border border-black/[.07] bg-white p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-violet-800">{signal.signalType.replaceAll("-", " ")}</span><span className="rounded-full bg-black/[.04] px-2.5 py-1 text-[10px] font-semibold uppercase text-black/50">{signal.status}</span></div><h2 className="mt-4 text-xl font-semibold tracking-[-.03em]">{signal.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{signal.summary}</p></div><div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#111214] text-white"><span className="text-lg font-semibold tabular-nums">{Math.round(signal.score)}</span></div></div><div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/[.06] pt-4 text-xs text-[var(--muted)]"><span>{signal.entityLabel}</span><span>{Math.round(signal.confidence*100)}% confidence</span><Link href={`/admin/traces#${signal.rootEventId}`} className="font-semibold text-black">Trace →</Link>{href && <Link href={href} className="inline-flex items-center gap-1 font-semibold text-black">Public record <ArrowUpRight className="size-3" /></Link>}</div><div className="mt-4 flex flex-wrap gap-2">{signal.status !== "watching" && <StatusButton id={signal.id} status="watching" label="Watch"/>}{signal.status !== "open" && <StatusButton id={signal.id} status="open" label="Reopen"/>}{signal.status !== "resolved" && <StatusButton id={signal.id} status="resolved" label="Resolve"/>}{signal.status !== "dismissed" && <StatusButton id={signal.id} status="dismissed" label="Dismiss"/>}</div></article>})}</div>
    {signals.length===0&&<div className="mt-8 rounded-[28px] border border-dashed border-black/15 bg-white p-12 text-center"><Lightbulb className="mx-auto size-6 text-black/30"/><h2 className="mt-4 text-xl font-semibold">No signals in this state.</h2><p className="mt-2 text-sm text-[var(--muted)]">Run a market sweep or change the status filter.</p></div>}
  </div>;
}
function Metric({label,value,icon:Icon}:{label:string;value:number;icon:React.ComponentType<{className?:string}>}){return <div className="rounded-[22px] border border-black/[.07] bg-white p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--muted)]">{label}</p><Icon className="size-4 text-black/35"/></div><p className="mt-5 text-4xl font-semibold tracking-[-.055em] tabular-nums">{value}</p></div>}
function StatusButton({id,status,label}:{id:string;status:"open"|"watching"|"resolved"|"dismissed";label:string}){return <form action={updateOpportunityStatusAction}><input type="hidden" name="id" value={id}/><input type="hidden" name="status" value={status}/><button className="rounded-full border border-black/[.08] bg-[var(--background)] px-3.5 py-2 text-[11px] font-semibold">{label}</button></form>}
