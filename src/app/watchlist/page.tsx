import type { Metadata } from "next";
import Link from "next/link";
import { WatchlistClient } from "@/components/watchlist-client";

export const metadata: Metadata = {
  title: "Saved listings",
  description: "Save peptide listings and monitor price, lab test, and availability changes.",
};

export default function WatchlistPage() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
      <div className="mb-10 max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Saved</p>
        <h1 className="mt-3 text-5xl font-extrabold leading-[.95] tracking-[-.065em] sm:text-6xl">Your saved listings.</h1>
        <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
          Save a listing and we track it for you — price, lab tests, and stock, synced across your devices.
        </p>
        <nav aria-label="Saved sections" className="mt-6 flex gap-2">
          <span className="ink-1 rounded-full bg-[#111214] px-4 py-2 text-sm font-bold text-white">Listings</span>
          <Link href="/saved-searches" className="ink-1 press rounded-full bg-white px-4 py-2 text-sm font-bold text-[#111214] transition hover:bg-black/[.03]">Searches</Link>
        </nav>
      </div>
      <WatchlistClient />
    </section>
  );
}
