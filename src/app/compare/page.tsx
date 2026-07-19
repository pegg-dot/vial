import type { Metadata } from "next";
import { CompareClient } from "@/components/compare-client";
import { ComparisonWorkspaceTools } from "@/components/comparison-workspace-tools";

export const metadata: Metadata = {
  title: "Compare listings",
  description: "Compare peptide research listings across pricing, evidence, batch linkage, and seller context.",
};

export default function ComparePage() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
      <div className="mb-10 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Side-by-side</p>
        <h1 className="mt-3 text-5xl font-semibold leading-[.95] tracking-[-.065em] sm:text-6xl">Compare the claims, not just the price.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
          VIAL keeps evidence dimensions separate so a low price or a polished document cannot hide missing batch, quantity, or sampling context.
        </p>
      </div>
      <CompareClient />
      <ComparisonWorkspaceTools />
    </section>
  );
}
