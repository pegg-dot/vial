import type { Metadata } from "next";
import Link from "next/link";
import { SavedSearchesClient } from "@/components/saved-searches-client";
import { requirePrincipal } from "@/server/auth/principal";
import { listSavedSearches } from "@/server/consumer-intelligence/repository";
export const metadata:Metadata={title:"Saved searches",description:"Preserve repeated market questions and monitor their reviewed changes."};
export const dynamic="force-dynamic";
export default async function SavedSearchesPage(){const principal=await requirePrincipal({accountTypes:["customer","seller"]});return <section className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8 sm:py-20"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Saved</p><h1 className="mt-3 text-5xl font-semibold tracking-[-.06em] sm:text-6xl">Your saved searches.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">Save a search, rerun it any time, and choose when a change should ping you.</p><nav aria-label="Saved sections" className="mt-6 flex gap-2"><Link href="/watchlist" className="rounded-full border border-black/[.09] bg-white px-4 py-2 text-sm font-semibold transition hover:border-black/[.2]">Listings</Link><span className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Searches</span></nav><div className="mt-10"><SavedSearchesClient initial={await listSavedSearches(principal.id)}/></div></section>}
