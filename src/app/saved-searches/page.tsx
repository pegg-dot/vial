import type { Metadata } from "next";
import { SavedSearchesClient } from "@/components/saved-searches-client";
import { requirePrincipal } from "@/server/auth/principal";
import { listSavedSearches } from "@/server/consumer-intelligence/repository";
export const metadata:Metadata={title:"Saved searches",description:"Preserve repeated market questions and monitor their reviewed changes."};
export const dynamic="force-dynamic";
export default async function SavedSearchesPage(){const principal=await requirePrincipal({accountTypes:["customer","seller"]});return <section className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8 sm:py-20"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Decision continuity</p><h1 className="mt-3 text-5xl font-semibold tracking-[-.06em] sm:text-6xl">Never repeat the same market research.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">Save a normalized query, rerun it against the current index, and choose how much change deserves your attention.</p><div className="mt-10"><SavedSearchesClient initial={await listSavedSearches(principal.id)}/></div></section>}
