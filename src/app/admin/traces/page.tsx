import type { Metadata } from "next";
import { Bell, GitBranch, Lightbulb, Network, RadioTower } from "lucide-react";
import { requireStaff } from "@/server/auth/session";
import { getTraceRoots, type TraceEvent } from "@/server/intelligence/repository";

export const metadata: Metadata = { title: "Causal traces" };
export const dynamic = "force-dynamic";

function depths(events: TraceEvent[]) {
  const byId = new Map(events.map(event => [event.id, event]));
  const cache = new Map<string, number>();
  const depth = (event: TraceEvent): number => {
    if (cache.has(event.id)) return cache.get(event.id)!;
    const parent = event.parentEventId ? byId.get(event.parentEventId) : undefined;
    const value = parent ? Math.min(5, depth(parent) + 1) : 0;
    cache.set(event.id, value);
    return value;
  };
  return new Map(events.map(event => [event.id, depth(event)]));
}

export default async function TracesPage() {
  await requireStaff();
  const traces = await getTraceRoots(60);
  return <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Cascading lineage</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">See every downstream consequence.</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">A trace begins with a source mutation, scheduled sweep, manual action, or publication. Every child event inherits the same root, making it possible to audit exactly how a change produced metrics, alerts, vendor history, and opportunity signals.</p><div className="mt-8 space-y-5">{traces.map(trace=>{const d=depths(trace.events);return <article id={trace.id} key={trace.id} className="scroll-mt-24 rounded-[30px] border border-black/[.07] bg-white p-5 sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold uppercase text-white">Root</span><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-violet-800">{trace.eventType.replaceAll(".", " ")}</span></div><h2 className="mt-4 text-xl font-semibold tracking-[-.025em]">{trace.entityType} · {trace.entityId ?? "market"}</h2><p className="mt-2 font-mono text-[10px] text-black/40">{trace.id}</p><p className="mt-2 text-xs text-[var(--muted)]">{new Date(trace.occurredAt).toLocaleString()} · {trace.actor}</p></div><div className="grid grid-cols-3 gap-2"><Stat icon={Network} value={trace.events.length} label="events"/><Stat icon={Bell} value={trace.alertCount} label="alerts"/><Stat icon={Lightbulb} value={trace.opportunityCount} label="signals"/></div></div><div className="mt-6 space-y-2 border-t border-black/[.06] pt-6">{trace.events.map(event=><div key={event.id} style={{marginLeft:`${(d.get(event.id)??0)*18}px`}} className="relative rounded-2xl border border-black/[.06] bg-[var(--background)] p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white"><GitBranch className="size-3.5 text-black/45"/></span><div className="min-w-0"><p className="truncate text-xs font-semibold">{event.eventType}</p><p className="mt-1 truncate text-[10px] text-[var(--muted)]">{event.entityType} · {event.entityId ?? "—"} · {event.actor}</p></div></div><p className="shrink-0 text-[10px] text-[var(--muted)]">{new Date(event.occurredAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"})}</p></div></div>)}</div></article>})}</div>{traces.length===0&&<div className="mt-8 rounded-[28px] border border-dashed border-black/15 bg-white p-12 text-center"><RadioTower className="mx-auto size-6 text-black/30"/><h2 className="mt-4 text-xl font-semibold">No traces yet.</h2><p className="mt-2 text-sm text-[var(--muted)]">Advance a controlled fixture or run the intelligence sweep.</p></div>}</div>;
}
function Stat({icon:Icon,value,label}:{icon:React.ComponentType<{className?:string}>;value:number;label:string}){return <div className="min-w-[74px] rounded-2xl bg-[#111214] p-3 text-white"><Icon className="size-3.5 text-white/40"/><p className="mt-4 text-xl font-semibold tabular-nums">{value}</p><p className="text-[9px] uppercase tracking-[.12em] text-white/40">{label}</p></div>}
