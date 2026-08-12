import type { Metadata } from "next";
import { ArrowUpRight, ChartNoAxesCombined, CircleGauge, Radar, Sparkles } from "lucide-react";
import Link from "next/link";
import { getPublicSignals } from "@/server/intelligence/repository";

export const metadata: Metadata = {
  title: "Market signals",
  description: "Derived market-structure signals from VialGrade's peptide catalog and provenance graph.",
};
export const dynamic = "force-dynamic";

function href(entityType: string, slug?: string) {
  if (!slug) return null;
  if (entityType === "listing") return `/products/${slug}`;
  if (entityType === "vendor") return `/vendors/${slug}`;
  if (entityType === "compound") return `/compounds/${slug}`;
  return null;
}

export default async function SignalsPage() {
  const signals = await getPublicSignals(18);
  return <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
    <div className="grid gap-8 lg:grid-cols-[1fr_.62fr] lg:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#0e8f80]">What&rsquo;s moving</p><h1 className="mt-3 max-w-4xl text-5xl font-extrabold leading-[.94] tracking-[-.068em] sm:text-7xl">What&rsquo;s moving right now.</h1><p className="mt-6 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">Price drops, vendors going quiet, batches losing their test coverage &mdash; the stuff worth knowing before you buy. These are market observations, never medical or purchasing recommendations.</p></div><div className="ink hard-mint rounded-[20px] bg-[#111214] p-6 text-white"><Radar className="size-5 text-[#8fffd6]"/><p className="mt-12 text-4xl font-extrabold tracking-[-.055em] tabular-nums">{signals.length}</p><p className="mt-2 text-sm font-bold">active public signals</p><p className="mt-4 text-xs leading-5 text-white/45">Every signal links back to a traceable event and remains separate from claims about safety, efficacy, or legal status.</p></div></div>
    <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{signals.map(signal=>{const target=href(signal.entityType,signal.entitySlug);return <article key={signal.id} className="group ink-1 hard press rounded-[18px] bg-white p-6"><div className="flex items-start justify-between gap-4"><span className="ink-1 grid size-11 place-items-center rounded-2xl bg-[#e6fbf4]"><Sparkles className="size-4 text-[#0e8f80]"/></span><div className="text-right"><p className="text-3xl font-extrabold tracking-[-.055em] tabular-nums">{Math.round(signal.score)}</p><p className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)]">signal strength</p></div></div><p className="mt-7 text-[10px] font-bold uppercase tracking-[.15em] text-[#0e8f80]">{signal.signalType.replaceAll("-"," ")}</p><h2 className="mt-3 text-xl font-extrabold tracking-[-.03em]">{signal.title}</h2><p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">{signal.summary}</p><div className="mt-6 flex items-center justify-between border-t border-[#111214]/12 pt-4"><div><p className="text-xs font-bold">{signal.entityLabel}</p><p className="mt-1 text-[10px] font-medium text-[var(--muted)]">{Math.round(signal.confidence*100)}% confidence</p></div>{target&&<Link href={target} className="ink-1 grid size-9 place-items-center rounded-full transition group-hover:bg-[#111214] group-hover:text-white" aria-label={`Open ${signal.entityLabel}`}><ArrowUpRight className="size-3.5"/></Link>}</div></article>})}</div>
    {signals.length===0&&<div className="mt-12 rounded-[20px] border-2 border-dashed border-[#111214]/30 bg-white p-14 text-center"><ChartNoAxesCombined className="mx-auto size-7 text-[var(--muted)]"/><h2 className="mt-5 text-2xl font-extrabold">Nothing is moving right now.</h2><p className="mt-3 text-sm font-medium text-[var(--muted)]">When prices drop, availability thins, or test coverage slips, it shows up here.</p></div>}
    <div className="ink-1 hard mt-10 rounded-[18px] bg-[#e6fbf4] p-6"><div className="flex items-start gap-3"><CircleGauge className="mt-0.5 size-5 shrink-0 text-[#0e8f80]"/><div><h2 className="font-extrabold">How to read these</h2><p className="mt-2 text-sm font-medium leading-6 text-[#0e8f80]">Strength is how big the move is; confidence is how solid the data behind it is. Neither says anything about product quality or whether you should buy.</p></div></div></div>
  </section>;
}
