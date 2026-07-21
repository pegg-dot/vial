import type { Metadata } from "next";
import { MarketClient } from "@/components/market-client";

export const metadata: Metadata = {
  title: "Market",
  description: "Browse and compare normalized fictional peptide research listings with evidence and source context.",
};

export default function MarketPage() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
      <div className="mb-10 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">The market</p>
        <h1 className="mt-3 text-5xl font-semibold leading-[.95] tracking-[-.065em] sm:text-6xl">The market, on one screen.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Every listing from every vendor, side by side &mdash; price, lab test, batch, and availability. All listings in this prototype are fictional.
        </p>
      </div>
      <MarketClient />
    </section>
  );
}
