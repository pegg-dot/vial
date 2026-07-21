import type { Metadata } from "next";
import { ArrowRight, BarChart3, BookOpenText, Layers3 } from "lucide-react";
import Link from "next/link";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { formatCurrency } from "@/lib/format";
import { getCatalogSnapshot } from "@/server/catalog/repository";

export const metadata: Metadata = { title: "Compound directory", description: "Browse canonical compound records, market coverage, and evidence context." };
export const dynamic = "force-dynamic";

export default async function CompoundsPage() {
  const { compounds, products } = await getCatalogSnapshot();
  return <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
    <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Compound directory</p><h1 className="mt-4 text-5xl font-semibold tracking-[-.065em] sm:text-7xl">Every peptide we track.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted)]">One page per compound: every vendor selling it, the price range, and how much of the market actually has current lab tests. Never a recommendation to use anything.</p></div>
      <div className="grid grid-cols-3 gap-3"><Stat icon={Layers3} value={String(compounds.length)} label="Records"/><Stat icon={BarChart3} value={String(products.length)} label="Listings"/><Stat icon={BookOpenText} value={`${Math.round(compounds.reduce((s,c)=>s+c.documentationCoverage,0)/Math.max(compounds.length,1))}%`} label="Avg. tested"/></div>
    </div>
    <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{compounds.map(compound=><Link key={compound.slug} href={`/compounds/${compound.slug}`} className="group overflow-hidden rounded-[30px] border border-black/[.07] bg-white transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(17,18,20,.09)]"><div className="h-2" style={{background:`linear-gradient(90deg,${compound.accent.join(',')})`}}/><div className="p-6"><div className="flex items-start justify-between gap-5"><div><p className="text-xs font-semibold text-[var(--muted)]">{compound.category}</p><h2 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-[-.04em]">{compound.name}{compound.origin==="live" && <DataOriginBadge origin="live"/>}</h2><p className="mt-1 text-xs text-[var(--muted)]">{compound.shorthand}</p></div><ArrowRight className="size-5 text-black/25 transition group-hover:translate-x-1 group-hover:text-black"/></div><p className="mt-5 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{compound.description}</p><div className="mt-7 grid grid-cols-3 gap-2 border-t border-black/[.06] pt-5"><Mini value={String(compound.listings)} label="Listings"/><Mini value={formatCurrency(compound.medianPrice)} label="Median"/><Mini value={`${compound.documentationCoverage}%`} label="Docs"/></div><div className="mt-5 flex flex-wrap gap-2">{compound.aliases.slice(0,3).map(alias=><span key={alias} className="rounded-full bg-black/[.04] px-2.5 py-1 text-[10px] font-semibold text-black/55">{alias}</span>)}</div></div></Link>)}</div>
  </div>;
}
function Stat({icon:Icon,value,label}:{icon:React.ComponentType<{className?:string}>;value:string;label:string}){return <div className="rounded-[22px] border border-black/[.07] bg-white p-4"><Icon className="size-4 text-black/30"/><p className="mt-5 text-2xl font-semibold tracking-[-.05em]">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">{label}</p></div>}
function Mini({value,label}:{value:string;label:string}){return <div><p className="text-sm font-semibold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{label}</p></div>}
