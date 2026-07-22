import type { Metadata } from "next";
import { ArrowRight, FileCheck2, Factory, Store } from "lucide-react";
import Link from "next/link";
import { vendorStatusLabel } from "@/lib/format";
import { VendorMark } from "@/components/vendor-mark";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import type { Vendor } from "@/lib/types";

export const metadata: Metadata = { title: "Vendor directory", description: "Browse persistent vendor profiles and observed market histories." };
export const dynamic = "force-dynamic";

function VendorCard({ vendor }: { vendor: Vendor }) {
  return <Link href={`/vendors/${vendor.slug}`} className="group rounded-[30px] border border-black/[.07] bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(17,18,20,.09)]">
    <div className="flex items-start gap-4"><VendorMark initials={vendor.initials} accent={vendor.accent} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-[-.035em]">{vendor.name}</h2>{vendor.origin === "live" && <DataOriginBadge origin="live" />}{vendor.kind === "manufacturer" && <span title="Surfaced only from third-party lab records (a manufacturer/supplier that ordered a test) — not a storefront you can buy from directly." className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><Factory className="size-3" />Manufacturer</span>}</div><p className="mt-1 text-xs text-[var(--muted)]">{vendorStatusLabel(vendor.profileStatus)}{vendor.location ? ` · ${vendor.location}` : ""}</p></div><ArrowRight className="size-4 text-black/25 transition group-hover:translate-x-1 group-hover:text-black" /></div></div></div>
    <p className="mt-5 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{vendor.description}</p>
    <div className="mt-7 grid grid-cols-3 gap-2 border-t border-black/[.06] pt-5"><Mini value={String(vendor.coaCount)} label="Lab tests" /><Mini value={vendor.medianPurity != null ? `${vendor.medianPurity.toFixed(1)}%` : "—"} label="Median purity" /><Mini value={vendor.kind === "storefront" ? String(vendor.productCount) : String(vendor.passportCount)} label={vendor.kind === "storefront" ? "Listings" : "Batch passports"} /></div>
    <div className="mt-5 rounded-2xl bg-[var(--background)] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">Evidence on file</p><p className="mt-2 text-xs leading-5">{[vendor.coaCount > 0 ? `${vendor.coaCount} lab test${vendor.coaCount === 1 ? "" : "s"}` : null, vendor.passportCount > 0 ? `${vendor.passportCount} batch passport${vendor.passportCount === 1 ? "" : "s"}` : null, vendor.productCount > 0 ? `${vendor.productCount} listing${vendor.productCount === 1 ? "" : "s"}` : null, vendor.reviewCount > 0 ? "buyer reputation" : null].filter(Boolean).join(" · ") || "No evidence on record yet."}</p></div>
  </Link>;
}

export default async function VendorsPage() {
  const { vendors } = await getCatalogSnapshot();
  const storefronts = vendors.filter((v) => v.kind !== "manufacturer");
  const manufacturers = vendors.filter((v) => v.kind === "manufacturer");
  return <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
    <div className="max-w-4xl"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Vendor directory</p><h1 className="mt-4 text-5xl font-semibold tracking-[-.065em] sm:text-7xl">A vendor&rsquo;s real track record.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted)]">A shady seller can spin up a new website overnight. We keep the history &mdash; prices, tests, and changes &mdash; so a fresh coat of paint can&rsquo;t hide the record.</p></div>
    <div className="mt-10 grid gap-3 sm:grid-cols-3"><Metric icon={Store} value={String(storefronts.length)} label="Storefronts you can shop" /><Metric icon={Factory} value={String(manufacturers.length)} label="Upstream manufacturers" /><Metric icon={FileCheck2} value={String(vendors.reduce((s, v) => s + v.coaCount, 0))} label="Lab certificates on record" /></div>

    <div className="mt-14 flex items-center gap-2"><Store className="size-5 text-violet-700" /><h2 className="text-2xl font-semibold tracking-[-.04em]">Storefronts</h2><span className="text-sm text-[var(--muted)]">— vendors you can actually buy from</span></div>
    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{storefronts.map((vendor) => <VendorCard key={vendor.slug} vendor={vendor} />)}</div>

    {manufacturers.length > 0 && <>
      <div className="mt-16 flex items-center gap-2"><Factory className="size-5 text-amber-700" /><h2 className="text-2xl font-semibold tracking-[-.04em]">Upstream manufacturers</h2></div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">These aren&rsquo;t storefronts. They&rsquo;re manufacturers and suppliers we surfaced from third-party lab records — the party a certificate names as having ordered or made the tested material. You generally can&rsquo;t buy from them directly, but their independent-test history is useful market intelligence (and often sits upstream of the storefronts above).</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{manufacturers.map((vendor) => <VendorCard key={vendor.slug} vendor={vendor} />)}</div>
    </>}
  </div>;
}
function Metric({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) { return <div className="rounded-[22px] border border-black/[.07] bg-white p-5"><Icon className="size-4 text-black/30" /><p className="mt-5 text-3xl font-semibold tracking-[-.055em]">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{label}</p></div>; }
function Mini({ value, label }: { value: string; label: string }) { return <div><p className="text-sm font-semibold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{label}</p></div>; }
