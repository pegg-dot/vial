import type { Metadata } from "next";
import Link from "next/link";
import { WatchlistClient } from "@/components/watchlist-client";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { reportError } from "@/server/observability/alerts";
import { STACKS, resolveStack, type ResolvedStack } from "@/lib/stacks";
import { evidenceOnlyPublicRelease } from "@/lib/public-research-release";
import { requirePrincipal } from "@/server/auth/principal";
import { getSavedStackSlugs, getWatchlistSlugs } from "@/server/account/repository";

export const metadata: Metadata = evidenceOnlyPublicRelease() ? {
  title: "Historical saved identifiers",
  description: "Read-only access to your previously saved research record identifiers.",
  robots: { index: false, follow: false },
} : {
  title: "Saved listings & stacks",
  description: "Save peptide listings and stacks, and monitor price, lab test, and availability changes.",
};

export const dynamic = "force-dynamic";

// The saved grid renders full market cards, so this page loads the whole catalog itself rather
// than inheriting it from the root layout — which used to put it on every page on the site. A
// guest's watchlist lives in localStorage, so the server genuinely cannot narrow the set here.
async function HistoricalSavedRecords() {
  const principal = await requirePrincipal({ accountTypes: ["customer", "seller"] });
  // Existing account rights, not personalized discovery. Fetch only this user's
  // old identifiers. Do not hydrate seller records, prices, recommendations,
  // a marketplace context, or any background tracking/notification clients.
  const history = await Promise.all([
    getWatchlistSlugs(principal.id),
    getSavedStackSlugs(principal.id),
  ]).catch(() => null);
  const listings = history?.[0] ?? [];
  const stacks = history?.[1] ?? [];
  return (
    <section className="mx-auto max-w-[900px] px-5 py-16 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[.15em] text-[#2b31d8]">Existing account records</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-.05em]">Previously saved identifiers</h1>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--muted)]">
        Your historical saved-listing and stack identifiers are read-only while VialGrade reviews
        research-interest privacy and source rights. Seller listings, prices, shopping links,
        suggestions and alerts are not available here.
      </p>
      {history === null ? (
        <p role="status" className="mt-7 rounded-xl border border-[#111214]/20 bg-white p-5 text-sm">
          We could not retrieve your saved identifiers right now. This is a data-access issue,
          not confirmation that no records exist. Use the privacy notice for your rights-request options.
        </p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <section className="rounded-xl border border-[#111214]/20 bg-white p-5">
            <h2 className="font-extrabold">Saved listing identifiers ({listings.length})</h2>
            {listings.length ? (
              <ul className="mt-4 space-y-2 text-sm" aria-label="Historical saved listings">
                {listings.map(slug => <li key={slug} className="break-all rounded-md bg-[#f7f7f4] px-3 py-2 font-mono">{slug}</li>)}
              </ul>
            ) : <p className="mt-3 text-sm text-[var(--muted)]">No listing identifiers are currently returned for this account.</p>}
          </section>
          <section className="rounded-xl border border-[#111214]/20 bg-white p-5">
            <h2 className="font-extrabold">Saved stack identifiers ({stacks.length})</h2>
            {stacks.length ? (
              <ul className="mt-4 space-y-2 text-sm" aria-label="Historical saved stacks">
                {stacks.map(slug => <li key={slug} className="break-all rounded-md bg-[#f7f7f4] px-3 py-2 font-mono">{slug}</li>)}
              </ul>
            ) : <p className="mt-3 text-sm text-[var(--muted)]">No stack identifiers are currently returned for this account.</p>}
          </section>
        </div>
      )}
      <p className="mt-5 text-xs leading-6 text-[var(--muted)]">
        This page reads only your current account records. It does not establish what older backups or logs retain.
      </p>
      <nav aria-label="Account and privacy options" className="mt-7 flex flex-wrap gap-4 text-sm font-bold text-[#2b31d8]">
        <Link href="/account/security" className="underline">Account security</Link>
        <Link href="/saved-searches" className="underline">Past saved searches</Link>
        <Link href="/legal/privacy" className="underline">Privacy and data requests</Link>
      </nav>
    </section>
  );
}

export default async function WatchlistPage() {
  if (evidenceOnlyPublicRelease()) return <HistoricalSavedRecords />;
  const catalog = await getCatalogSnapshot().catch((error) => {
    reportError({ kind: "watchlist-unavailable", message: "The saved-listings page could not read the catalog.", context: { error: String(error) } });
    return null;
  });
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
      <div className="mb-10 max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Saved</p>
        <h1 className="mt-3 text-5xl font-extrabold leading-[.95] tracking-[-.065em] sm:text-6xl">Your saved listings &amp; stacks.</h1>
        <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
          Save a listing and we track it for you — price, lab tests, and stock, synced across your devices. Save a stack to keep its cheapest-way-to-buy one tap away.
        </p>
        <nav aria-label="Saved sections" className="mt-6 flex gap-2">
          <span className="ink-1 rounded-full bg-[#111214] px-4 py-2 text-sm font-bold text-white">Listings</span>
          <Link href="/saved-searches" className="ink-1 press rounded-full bg-white px-4 py-2 text-sm font-bold text-[#111214] transition hover:bg-black/[.03]">Searches</Link>
        </nav>
      </div>
      {catalog ? <WatchlistClient products={catalog.products} stacks={STACKS.map((s) => resolveStack(s, catalog.compounds)).filter((r): r is ResolvedStack => r !== null)} /> : <DataUnavailable surface="your saved listings" />}
    </section>
  );
}
