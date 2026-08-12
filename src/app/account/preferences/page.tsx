import type { Metadata } from "next";
import { ConsumerPreferencesForm } from "@/components/consumer-preferences";
import { requirePrincipal } from "@/server/auth/principal";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { getConsumerPreferences } from "@/server/consumer-intelligence/repository";
export const metadata:Metadata={title:"Market preferences",description:"Control how VialGrade ranks market records and notifications."};
export default async function PreferencesPage(){const principal=await requirePrincipal({accountTypes:["customer","seller"]});const[catalog,preferences]=await Promise.all([getCatalogSnapshot(),getConsumerPreferences(principal.id)]);return <main className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Your account</p><h1 className="mt-3 text-5xl font-extrabold tracking-[-.06em]">What matters to you.</h1><p className="mt-4 max-w-2xl text-[var(--muted)]">Your settings affect ranking and alert relevance. They do not make medical recommendations or hide missing evidence.</p><div className="mt-10"><ConsumerPreferencesForm initial={preferences} compounds={catalog.compounds.map(item=>({slug:item.slug,name:item.name}))} vendors={catalog.vendors.map(item=>({slug:item.slug,name:item.name}))}/></div></main>}
