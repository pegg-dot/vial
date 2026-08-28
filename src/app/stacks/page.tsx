import type { Metadata } from "next";
import { Layers3 } from "lucide-react";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { reportError } from "@/server/observability/alerts";
import { STACKS, resolveStack, type ResolvedStack } from "@/lib/stacks";
import { StackCard } from "@/components/market/stack-card";
import { DataUnavailable } from "@/components/home-data-unavailable";

export const metadata: Metadata = {
  title: "Stacks & blends",
  description: "Commonly discussed research combinations — each with every vendor and price for its components, side by side. Not protocols.",
  alternates: { canonical: "/stacks" },
};
export const dynamic = "force-dynamic";

export default async function StacksPage() {
  const catalog = await getCatalogSnapshot().catch((error) => {
    reportError({ kind: "stacks-unavailable", message: "The stacks index could not read the catalog.", context: { error: String(error) } });
    return null;
  });
  if (!catalog) return <DataUnavailable surface="the stacks index" />;
  const resolved = STACKS.map((s) => resolveStack(s, catalog.compounds)).filter((r): r is ResolvedStack => r !== null);

  return (
    <>
      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#eafff7]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-12">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#0e8f80]"><Layers3 className="size-3.5" /> Commonly discussed</p>
          <h1 className="mt-3 text-balance text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-[.92] tracking-[-.05em]">Stacks &amp; <span className="text-[#0e8f80]">blends.</span></h1>
          <p className="mt-4 max-w-2xl text-[15px] font-medium leading-7 text-[#111214]/70">
            Combinations the research community talks about. A blend is one pre-mixed vial; a recipe is compounds bought separately. Each page shows every vendor and price for every part, and the cheapest way to assemble it &mdash; never a protocol.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8">
        <p className="text-sm font-medium text-[var(--muted)]"><span className="font-extrabold text-[#111214] tabular-nums">{resolved.length}</span> stacks with at least one tracked component</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {resolved.map((r) => <StackCard key={r.stack.slug} resolved={r} fluid />)}
        </div>
      </section>
    </>
  );
}
