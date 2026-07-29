import type { Metadata } from "next";
import { BarChart3, BookOpenText, Layers3 } from "lucide-react";
import { ArtMolecule, VialBuddy, ArtDroplet } from "@/components/vial-art";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { SHELVES } from "@/lib/market-taxonomy";
import { CompoundsExperience } from "@/components/market/compounds-experience";

export const metadata: Metadata = { title: "Compound directory", description: "Browse canonical compound records, market coverage, and evidence context." };
export const dynamic = "force-dynamic";

// Map a legacy goal-tag key (?goal=) onto a shelf key so old links keep working.
function shelfKeyFor(goal: string | undefined, shelf: string | undefined): string | null {
  if (shelf && SHELVES.some((s) => s.key === shelf)) return shelf;
  if (!goal) return null;
  const match = SHELVES.find((s) => s.goalKeys.includes(goal));
  return match?.key ?? null;
}

export default async function CompoundsPage({ searchParams }: { searchParams: Promise<{ goal?: string; shelf?: string }> }) {
  const { goal, shelf } = await searchParams;
  const { compounds, products } = await getCatalogSnapshot();
  const totalCoa = compounds.reduce((s, c) => s + c.coaCount, 0);
  const initialShelf = shelfKeyFor(goal, shelf);

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
          <h1 className="mt-4 text-balance text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold leading-[.9] tracking-[-.05em]">Every peptide <span className="text-[#5a4be0]">we track.</span></h1>
          <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#111214]/70">One page per compound: every vendor selling it, the price range, and how much of the market actually has current lab tests. Read it like a market terminal &mdash; never a recommendation to use anything.</p>
        </div>
        <div className="mt-9 grid max-w-2xl grid-cols-3 gap-3">
          <Stat icon={Layers3} value={String(compounds.length)} label="Records" />
          <Stat icon={BarChart3} value={String(products.length)} label="Listings" />
          <Stat icon={BookOpenText} value={String(totalCoa)} label="Lab certificates" />
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-16">
      <CompoundsExperience initialShelf={initialShelf} />
    </div>
  </>;
}

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) { return <div className="ink hard rounded-[16px] bg-white p-4"><Icon className="size-4 text-[#6d5dfc]" /><p className="mt-3 text-2xl font-extrabold tracking-[-.05em]">{value}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{label}</p></div>; }
