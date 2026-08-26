import type { Metadata } from "next";
import { ArrowUpRight, ChartNoAxesCombined, CircleGauge, Radar, Sparkles } from "lucide-react";
import Link from "next/link";
import { countPublicSignals, getPublicSignals } from "@/server/intelligence/repository";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { reportError } from "@/server/observability/alerts";

export const metadata: Metadata = {
  alternates: { canonical: "/signals" },
  title: "Market signals",
  description: "What is moving in the peptide market right now: price swings, thin stock, and listings that lost their lab reports.",
};
export const dynamic = "force-dynamic";

// The stored signal_type is a machine key. Rendered raw it reads "compound evidence gap" —
// three nouns in a trench coat. This says the same thing the way a person would.
const SIGNAL_KIND: Record<string, string> = {
  "price-dispersion": "Prices are all over the map",
  "thin-availability": "Hard to find right now",
  "compound-evidence-gap": "Lab reports are patchy",
  "vendor-evidence-gap": "Missing lab reports",
  "source-coverage-gap": "Not watched automatically yet",
  "batch-document-gap": "Batch with no lab report",
  "vendor-onboarding": "Nobody has claimed this page",
  "listing-evidence-refresh": "Needs a fresh look",
  "issuer-concentration": "All the tests come from one lab",
  "supply-concentration": "Only a few sellers",
  "source-health": "Our check on this source is failing",
  "new-batch-evidence": "New batch, nothing to back it yet",
  "listing-price-outlier": "Priced far from the rest",
};

function href(entityType: string, slug?: string) {
  if (!slug) return null;
  if (entityType === "listing") return `/products/${slug}`;
  if (entityType === "vendor") return `/vendors/${slug}`;
  if (entityType === "compound") return `/compounds/${slug}`;
  return null;
}

export default async function SignalsPage() {
  // The count is asked for separately because `signals.length` is the PAGE SIZE. Rendering it as
  // "active public signals" told a reader holding 400 open signals that there were 18.
  const total = await countPublicSignals().catch(() => null);
  const signals = await getPublicSignals(18).catch((error) => {
    reportError({ kind: "signals-unavailable", message: "The signals feed could not be read.", context: { error: String(error) } });
    return null;
  });
  if (!signals) return <DataUnavailable surface="the signals feed" />;
  return <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
    <div className="grid gap-8 lg:grid-cols-[1fr_.62fr] lg:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#0e8f80]">What&rsquo;s moving</p><h1 className="mt-3 max-w-4xl text-5xl font-extrabold leading-[.94] tracking-[-.068em] sm:text-7xl">What&rsquo;s moving right now.</h1><p className="mt-6 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">Price drops, vendors going quiet, batches losing their test coverage &mdash; the stuff worth knowing before you buy. These are market observations, never medical or purchasing recommendations.</p></div><div className="ink hard-mint rounded-[20px] bg-[#111214] p-6 text-white"><Radar className="size-5 text-[#8fffd6]"/><p className="mt-12 text-4xl font-extrabold tracking-[-.055em] tabular-nums">{total ?? signals.length}</p><p className="mt-2 text-sm font-bold">active public signals</p>{total !== null && total > signals.length && <p className="mt-2 text-xs font-semibold text-[#8fffd6]">Showing the {signals.length} highest-scoring.</p>}<p className="mt-4 text-xs leading-5 text-white/45">Every one of these links back to the record that produced it. None of them is a claim about whether something is safe, whether it works, or whether it is legal where you live.</p></div></div>
    <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{signals.map(signal=>{const target=href(signal.entityType,signal.entitySlug);return <article key={signal.id} className="group ink-1 hard press rounded-[18px] bg-white p-6"><div className="flex items-start justify-between gap-4"><span className="ink-1 grid size-11 place-items-center rounded-2xl bg-[#e6fbf4]"><Sparkles className="size-4 text-[#0e8f80]"/></span><div className="text-right"><p className="text-3xl font-extrabold tracking-[-.055em] tabular-nums">{Math.round(signal.score)}</p><p className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)]">how big it is</p></div></div><p className="mt-7 text-[10px] font-bold uppercase tracking-[.15em] text-[#0e8f80]">{SIGNAL_KIND[signal.signalType] ?? signal.signalType.replaceAll("-"," ")}</p><h2 className="mt-3 text-xl font-extrabold tracking-[-.03em]">{signal.title}</h2><p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">{signal.summary}</p><div className="mt-6 flex items-center justify-between border-t border-[#111214]/12 pt-4"><div><p className="text-xs font-bold">{signal.entityLabel}</p><p className="mt-1 text-[10px] font-medium text-[var(--muted)]">we&rsquo;re {Math.round(signal.confidence*100)}% sure of the data</p></div>{target&&<Link href={target} className="ink-1 grid size-9 place-items-center rounded-full transition group-hover:bg-[#111214] group-hover:text-white" aria-label={`Open ${signal.entityLabel}`}><ArrowUpRight className="size-3.5"/></Link>}</div></article>})}</div>
    {signals.length===0&&<div className="mt-12 rounded-[20px] border-2 border-dashed border-[#111214]/30 bg-white p-14 text-center"><ChartNoAxesCombined className="mx-auto size-7 text-[var(--muted)]"/><h2 className="mt-5 text-2xl font-extrabold">Nothing is moving right now.</h2><p className="mt-3 text-sm font-medium text-[var(--muted)]">When prices drop, availability thins, or test coverage slips, it shows up here.</p></div>}
    <div className="ink-1 hard mt-10 rounded-[18px] bg-[#e6fbf4] p-6"><div className="flex items-start gap-3"><CircleGauge className="mt-0.5 size-5 shrink-0 text-[#0e8f80]"/><div><h2 className="font-extrabold">How to read these</h2><p className="mt-2 text-sm font-medium leading-6 text-[#0e8f80]">The big number is how large the change is. The small one is how solid the data behind it is. Neither says anything about whether a product is any good, or whether you should buy it.</p></div></div></div>
  </section>;
}
