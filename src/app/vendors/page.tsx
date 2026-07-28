import type { Metadata } from "next";
import { ArrowUpRight, FileCheck2, Factory, Store } from "lucide-react";
import Link from "next/link";
import { vendorStatusLabel } from "@/lib/format";
import { VendorMark } from "@/components/vendor-mark";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { VialBuddy, ArtShieldCheck, ArtCoa } from "@/components/vial-art";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import type { Vendor } from "@/lib/types";

export const metadata: Metadata = { title: "Vendor directory", description: "Browse persistent vendor profiles and observed market histories." };
export const dynamic = "force-dynamic";

// Vendors signature = cool steel/slate — the "records vault." Hardened cards, shield/record stickers.
const STEEL = "#39414e";

function VendorCard({ vendor }: { vendor: Vendor }) {
  const evidence = [vendor.coaCount > 0 ? `${vendor.coaCount} lab test${vendor.coaCount === 1 ? "" : "s"}` : null, vendor.passportCount > 0 ? `${vendor.passportCount} batch passport${vendor.passportCount === 1 ? "" : "s"}` : null, vendor.productCount > 0 ? `${vendor.productCount} listing${vendor.productCount === 1 ? "" : "s"}` : null, vendor.reviewCount > 0 ? "buyer reputation" : null].filter(Boolean).join(" · ") || "No evidence on record yet.";
  return <Link href={`/vendors/${vendor.slug}`} className="ink-1 hard press group flex flex-col rounded-[20px] bg-white p-6">
    <div className="flex items-start gap-4">
      <VendorMark initials={vendor.initials} accent={vendor.accent} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-[-.03em]">{vendor.name}</h2>
              {vendor.origin === "live" && <DataOriginBadge origin="live" />}
              {vendor.kind === "manufacturer" && <span title="Surfaced only from third-party lab records — a manufacturer/supplier that ordered a test, not a storefront you can buy from directly." className="inline-flex items-center gap-1 rounded-full bg-[#39414e] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.06em] text-white"><Factory className="size-3" />Manufacturer</span>}
            </div>
            <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{vendorStatusLabel(vendor.profileStatus)}{vendor.location ? ` · ${vendor.location}` : ""}</p>
          </div>
          <ArrowUpRight className="size-5 shrink-0 text-[#111214] transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
    <p className="mt-5 line-clamp-2 text-sm font-medium leading-6 text-[var(--muted)]">{vendor.description}</p>
    <div className="ink-1 mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--background)] p-3 text-center">
      <Mini value={String(vendor.coaCount)} label="Lab tests" />
      <Mini value={vendor.medianPurity != null ? `${vendor.medianPurity.toFixed(1)}%` : "—"} label="Purity" />
      <Mini value={vendor.kind === "storefront" ? String(vendor.productCount) : String(vendor.passportCount)} label={vendor.kind === "storefront" ? "Listings" : "Passports"} />
    </div>
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Evidence on file</p>
      <p className="mt-1.5 text-xs font-semibold leading-5">{evidence}</p>
    </div>
  </Link>;
}

export default async function VendorsPage() {
  const { vendors } = await getCatalogSnapshot();
  const storefronts = vendors.filter((v) => v.kind !== "manufacturer");
  const manufacturers = vendors.filter((v) => v.kind === "manufacturer");
  const totalCoa = vendors.reduce((s, v) => s + v.coaCount, 0);
  return <>
    <section className="relative isolate overflow-hidden border-b-2 border-[#111214] text-white" style={{ background: STEEL }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <ArtCoa className="gum-float-slow absolute right-[5%] top-[12%] hidden w-20 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-24" />
        <ArtShieldCheck className="gum-float absolute right-[15%] top-[40%] hidden w-[72px] drop-shadow-[5px_5px_0_#111214] lg:block" />
        <VialBuddy className="gum-float-rev absolute right-[6%] top-[46%] hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" liquid="#8fffd6" cap="#111214" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#9fe8d8]">Vendor directory</p>
          <h1 className="mt-4 text-balance text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold leading-[.9] tracking-[-.05em]">A vendor&rsquo;s <span className="text-[#8fffd6]">real track record.</span></h1>
          <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-white/75">A shady seller can spin up a new website overnight. We keep the history &mdash; prices, tests, and changes &mdash; so a fresh coat of paint can&rsquo;t hide the record.</p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <HeroStat icon={Store} value={String(storefronts.length)} label="Storefronts you can shop" />
          <HeroStat icon={Factory} value={String(manufacturers.length)} label="Upstream manufacturers" />
          <HeroStat icon={FileCheck2} value={String(totalCoa)} label="Lab certificates on record" />
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
      <div className="flex items-center gap-2.5"><span className="ink-1 grid size-9 place-items-center rounded-xl bg-[#2b31d8] text-white"><Store className="size-5" /></span><h2 className="text-2xl font-extrabold tracking-[-.035em]">Storefronts</h2><span className="text-sm font-semibold text-[var(--muted)]">&mdash; vendors you can actually buy from</span></div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{storefronts.map((vendor) => <VendorCard key={vendor.slug} vendor={vendor} />)}</div>

      {manufacturers.length > 0 && <>
        <div className="mt-16 flex items-center gap-2.5"><span className="ink-1 grid size-9 place-items-center rounded-xl bg-[#39414e] text-white"><Factory className="size-5" /></span><h2 className="text-2xl font-extrabold tracking-[-.035em]">Upstream manufacturers</h2></div>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">These aren&rsquo;t storefronts. They&rsquo;re manufacturers and suppliers we surfaced from third-party lab records &mdash; the party a certificate names as having ordered or made the tested material. You generally can&rsquo;t buy from them directly, but their independent-test history is useful market intelligence.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{manufacturers.map((vendor) => <VendorCard key={vendor.slug} vendor={vendor} />)}</div>
      </>}
    </div>
  </>;
}

function HeroStat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return <div className="ink hard rounded-[18px] bg-white p-5 text-[#111214]"><Icon className="size-4 text-[#39414e]" /><p className="mt-4 text-3xl font-extrabold tracking-[-.05em]">{value}</p><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{label}</p></div>;
}
function Mini({ value, label }: { value: string; label: string }) { return <div><p className="text-xl font-extrabold tabular-nums tracking-[-.03em]">{value}</p><p className="mt-0.5 text-[10px] font-semibold text-[var(--muted)]">{label}</p></div>; }
