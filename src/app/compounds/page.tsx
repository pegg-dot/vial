import type { Metadata } from "next";
import { ArrowUpRight, BarChart3, BookOpenText, Layers3, X } from "lucide-react";
import Link from "next/link";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { GoalTags } from "@/components/goal-tags";
import { formatCurrency } from "@/lib/format";
import { educationFor, GOAL_TAGS } from "@/lib/compound-education";
import { ArtMolecule, VialBuddy, ArtDroplet } from "@/components/vial-art";
import { getCatalogSnapshot } from "@/server/catalog/repository";

export const metadata: Metadata = { title: "Compound directory", description: "Browse canonical compound records, market coverage, and evidence context." };
export const dynamic = "force-dynamic";

export default async function CompoundsPage({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const { goal } = await searchParams;
  const { compounds, products } = await getCatalogSnapshot();
  const activeGoal = goal && GOAL_TAGS[goal] ? goal : null;
  const shown = activeGoal ? compounds.filter((c) => educationFor(c.slug)?.goals?.includes(activeGoal)) : compounds;
  const totalCoa = compounds.reduce((s, c) => s + c.coaCount, 0);

  return <>
    <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#f0edff]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <ArtMolecule className="gum-float absolute right-[5%] top-[16%] hidden w-24 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-32" a="#6d5dfc" b="#8fffd6" c="#fff" />
        <VialBuddy className="gum-float-slow absolute right-[15%] bottom-[10%] hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" liquid="#6d5dfc" />
        <ArtDroplet className="gum-float-rev absolute right-[24%] top-[24%] hidden w-11 drop-shadow-[3px_3px_0_#111214] lg:block" fill="#6d5dfc" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#4c3fd6]">Compound directory</p>
          <h1 className="mt-4 text-balance text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold leading-[.9] tracking-[-.05em]">{activeGoal ? GOAL_TAGS[activeGoal].label : <>Every peptide <span className="text-[#5a4be0]">we track.</span></>}</h1>
          <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#111214]/70">{activeGoal ? GOAL_TAGS[activeGoal].blurb : "One page per compound: every vendor selling it, the price range, and how much of the market actually has current lab tests. Never a recommendation to use anything."}</p>
          {activeGoal && <Link href="/compounds" className="ink-1 hard-sm mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold transition hover:-translate-y-0.5"><X className="size-3" /> Clear filter &mdash; show all {compounds.length}</Link>}
        </div>
        <div className="mt-9 grid max-w-2xl grid-cols-3 gap-3">
          <Stat icon={Layers3} value={String(shown.length)} label={activeGoal ? "Matches" : "Records"} />
          <Stat icon={BarChart3} value={String(products.length)} label="Listings" />
          <Stat icon={BookOpenText} value={String(totalCoa)} label="Lab certificates" />
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
      {shown.length === 0
        ? <div className="ink rounded-[22px] bg-white px-6 py-20 text-center"><p className="text-xl font-extrabold tracking-[-.03em]">No compounds tagged for this goal yet</p><Link href="/compounds" className="ink hard press mt-6 inline-flex rounded-full bg-[#2b31d8] px-5 py-3 text-sm font-bold text-white">Show all compounds</Link></div>
        : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map((compound) => { const edu = educationFor(compound.slug); return (
          <Link key={compound.slug} href={`/compounds/${compound.slug}`} className="ink-1 hard press group flex flex-col overflow-hidden rounded-[20px] bg-white">
            <div className="h-2.5" style={{ background: `linear-gradient(90deg,${compound.accent.join(",")})` }} />
            <div className="p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{compound.category}</p>
                  <h2 className="mt-1.5 flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-[-.04em]">{compound.name}{compound.origin === "live" && <DataOriginBadge origin="live" />}</h2>
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{compound.shorthand}</p>
                </div>
                <ArrowUpRight className="size-5 shrink-0 text-[#111214] transition group-hover:translate-x-0.5" />
              </div>
              {edu?.goals?.length ? <div className="mt-4"><GoalTags goals={edu.goals} limit={3} /></div> : null}
              <p className="mt-4 line-clamp-2 text-sm font-medium leading-6 text-[var(--muted)]">{compound.description}</p>
              <div className="ink-1 mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--background)] p-3 text-center">
                <Mini value={String(compound.listings)} label="Listings" />
                <Mini value={formatCurrency(compound.medianPrice)} label="Median" />
                <Mini value={String(compound.coaCount)} label="Lab tests" />
              </div>
            </div>
          </Link>
        ); })}</div>}
    </div>
  </>;
}

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) { return <div className="ink hard rounded-[16px] bg-white p-4"><Icon className="size-4 text-[#6d5dfc]" /><p className="mt-3 text-2xl font-extrabold tracking-[-.05em]">{value}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{label}</p></div>; }
function Mini({ value, label }: { value: string; label: string }) { return <div><p className="text-lg font-extrabold tabular-nums tracking-[-.03em]">{value}</p><p className="mt-0.5 text-[10px] font-semibold text-[var(--muted)]">{label}</p></div>; }
