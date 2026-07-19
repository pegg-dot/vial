import type { Metadata } from "next";
import { WatchlistClient } from "@/components/watchlist-client";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Save fictional peptide listings and monitor price, documentation, and availability changes.",
};

export default function WatchlistPage() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
      <div className="mb-10 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Personal market</p>
        <h1 className="mt-3 text-5xl font-semibold leading-[.95] tracking-[-.065em] sm:text-6xl">Watch what changes.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Saved records sync to your VIAL account across devices. Reviewed price, evidence, batch, and availability changes stay connected to the same record.
        </p>
      </div>
      <WatchlistClient />
    </section>
  );
}
