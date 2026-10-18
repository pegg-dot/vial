import type { Metadata } from "next";
import Link from "next/link";
import { SavedSearchesClient } from "@/components/saved-searches-client";
import { requirePrincipal } from "@/server/auth/principal";
import { listSavedSearches } from "@/server/consumer-intelligence/repository";
import { evidenceOnlyPublicRelease } from "@/lib/public-research-release";

export const metadata: Metadata = evidenceOnlyPublicRelease() ? {
  title: "Historical saved searches",
  description: "Read-only access to your previously saved research questions.",
  robots: { index: false, follow: false },
} : {
  title: "Saved searches",
  description: "Preserve repeated market questions and monitor their reviewed changes.",
};
export const dynamic = "force-dynamic";

async function ReadOnlySavedSearches({ principalId }: { principalId: string }) {
  // Historical account access only, not a market-search or notification
  // service. Do not mount the legacy SavedSearchesClient: its create, run,
  // delete, alert and seller-search actions are paused in research mode.
  const searches = await listSavedSearches(principalId).catch(() => null);
  return (
    <section className="mx-auto max-w-[900px] px-5 py-16 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[.15em] text-[#2b31d8]">Existing account records</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-.05em]">Previously saved searches</h1>
      <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
        These are the research questions previously stored in your account.
        Creating or running searches, changing alerts and new personalized
        research tracking are paused during the privacy review.
      </p>
      {searches === null ? (
        <p role="status" className="mt-7 rounded-xl border border-[#111214]/20 bg-white p-5 text-sm">
          We could not retrieve your saved searches right now. This is not evidence
          that no historical data exist. The privacy notice explains data-request options.
        </p>
      ) : searches.length ? (
        <ul className="mt-8 space-y-3" aria-label="Historical saved searches">
          {searches.map(item => (
            <li key={item.id} className="rounded-xl border border-[#111214]/20 bg-white p-5">
              <h2 className="font-extrabold">{item.name}</h2>
              <p className="mt-2 break-words font-mono text-sm text-[var(--muted)]">{item.query}</p>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Previously selected alert mode: {item.alertMode}. Alerts are currently paused.
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-xl border border-[#111214]/20 bg-white p-5 text-sm">
          No saved searches are currently returned for this account.
          Historical logs or backups are covered by the separate privacy review.
        </p>
      )}
      <nav aria-label="Account and privacy options" className="mt-7 flex flex-wrap gap-4 text-sm font-bold text-[#2b31d8]">
        <Link href="/watchlist" className="underline">Past saved identifiers</Link>
        <Link href="/account/security" className="underline">Account security</Link>
        <Link href="/legal/privacy" className="underline">Privacy and data requests</Link>
      </nav>
    </section>
  );
}

export default async function SavedSearchesPage() {
  const principal = await requirePrincipal({ accountTypes: ["customer", "seller"] });
  if (evidenceOnlyPublicRelease()) {
    return <ReadOnlySavedSearches principalId={principal.id} />;
  }

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#6d5dfc]">Saved</p>
      <h1 className="mt-3 text-5xl font-extrabold tracking-[-.06em] sm:text-6xl">Your saved searches.</h1>
      <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
        Save a search, rerun it any time, and choose when a change should ping you.
      </p>
      <nav aria-label="Saved sections" className="mt-6 flex gap-2">
        <Link href="/watchlist" className="ink-1 hard-sm press rounded-full bg-white px-4 py-2 text-sm font-bold">Listings</Link>
        <span className="ink hard-sm rounded-full bg-[#111214] px-4 py-2 text-sm font-bold text-white">Searches</span>
      </nav>
      <div className="mt-10">
        <SavedSearchesClient initial={await listSavedSearches(principal.id)} />
      </div>
    </section>
  );
}
