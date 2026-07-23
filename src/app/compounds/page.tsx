import type { Metadata } from "next";
import { ArrowRight, BarChart3, BookOpenText, Layers3, X } from "lucide-react";
import Link from "next/link";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { GoalTags } from "@/components/goal-tags";
import { formatCurrency } from "@/lib/format";
import { educationFor, GOAL_TAGS } from "@/lib/compound-education";
import { getCatalogSnapshot } from "@/server/catalog/repository";

export const metadata: Metadata = { title: "Compound directory", description: "Browse canonical compound records, market coverage, and evidence context." };
export const dynamic = "force-dynamic";

export default async function CompoundsPage({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const { goal } = await searchParams;
  const { compounds, products } = await getCatalogSnapshot();
  // Optional research-goal filter (the homepage "browse by goal" pills link here).
  const activeGoal = goal && GOAL_TAGS[goal] ? goal : null;
  const shown = activeGoal ? compounds.filter((c) => educationFor(c.slug)?.goals?.includes(activeGoal)) : compounds;
  return <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
    <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Compound directory</p><h1 className="mt-4 text-5xl font-semibold tracking-[-.065em] sm:text-7xl">{activeGoal ? GOAL_TAGS[activeGoal].label : "Every peptide we track."}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted)]">{activeGoal ? GOAL_TAGS[activeGoal].blurb : "One page per compound: every vendor selling it, the price range, and how much of the market actually has current lab tests. Never a recommendation to use anything."}</p>{activeGoal && <Link href="/compounds" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-black/[.1] bg-white px-3 py-1.5 text-xs font-semibold transition hover:border-black/25"><X className="size-3" /> Clear filter &mdash; show all {compounds.length}</Link>}</div>
      <div className="grid grid-cols-3 gap-3"><Stat icon={Layers3} value={String(shown.length)} label={activeGoal ? "Matches" : "Records"}/><Stat icon={BarChart3} value={String(products.length)} label="Listings"/><Stat icon={BookOpenText} value={String(compounds.reduce((s,c)=>s+c.coaCount,0))} label="Lab certificates"/></div>
    </div>
    {shown.length === 0
      ? <div className="mt-12 rounded-[28px] border border-dashed border-black/15 bg-white/50 px-6 py-20 text-center"><p className="text-xl font-semibold tracking-[-.03em]">No compounds tagged for this goal yet</p><Link href="/compounds" className="mt-6 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Show all compounds</Link></div>
      : <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map(compound=>{const edu=educationFor(compound.slug);return <Link key={compound.slug} href={`/compounds/${compound.slug}`} className="group overflow-hidden rounded-[30px] border border-black/[.07] bg-white transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(17,18,20,.09)]"><div className="h-2" style={{background:`linear-gradient(90deg,${compound.accent.join(',')})`}}/><div className="p-6"><div className="flex items-start justify-between gap-5"><div><p className="text-xs font-semibold text-[var(--muted)]">{compound.category}</p><h2 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-[-.04em]">{compound.name}{compound.origin==="live" && <DataOriginBadge origin="live"/>}</h2><p className="mt-1 text-xs text-[var(--muted)]">{compound.shorthand}</p></div><ArrowRight className="size-5 text-black/25 transition group-hover:translate-x-1 group-hover:text-black"/></div>{edu?.goals?.length ? <div className="mt-4"><GoalTags goals={edu.goals} limit={3}/></div> : null}<p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{compound.description}</p><div className="mt-7 grid grid-cols-3 gap-2 border-t border-black/[.06] pt-5"><Mini value={String(compound.listings)} label="Listings"/><Mini value={formatCurrency(compound.medianPrice)} label="Median"/><Mini value={String(compound.coaCount)} label="Lab tests"/></div></div></Link>;})}</div>}
  </div>;
}
function Stat({icon:Icon,value,label}:{icon:React.ComponentType<{className?:string}>;value:string;label:string}){return <div className="rounded-[22px] border border-black/[.07] bg-white p-4"><Icon className="size-4 text-black/30"/><p className="mt-5 text-2xl font-semibold tracking-[-.05em]">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">{label}</p></div>}
function Mini({value,label}:{value:string;label:string}){return <div><p className="text-sm font-semibold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{label}</p></div>}
