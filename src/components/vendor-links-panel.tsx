import Link from "next/link";
import { Network, GitMerge, ArrowUpRight } from "lucide-react";
import type { VendorLink } from "@/server/verify/vendor-linkage";

const vendorName = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// The operator-network view: which "independent" storefronts are actually one operator (shared
// analytics/pixel or the same tested batch) or one source (same upstream maker). This is the
// thing a buyer can't see on a single site — so it's shown loudest when it's strongest.
export function VendorLinksPanel({ links, vendorName: name }: { links: VendorLink[]; vendorName: string }) {
  const strong = links.filter((l) => l.strength === "strong");
  const info = links.filter((l) => l.strength === "info");

  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8 sm:pt-20">
      <div className="mb-6 flex items-center gap-2.5">
        <Network className="size-5 text-black/40" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Operator network</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-[-.045em]">Who&rsquo;s really behind this storefront</h2>
        </div>
      </div>

      {strong.length > 0 ? (
        <div className="rounded-[26px] border border-amber-300 bg-amber-50 p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800"><GitMerge className="size-3.5" /> Linked to {strong.length} other storefront{strong.length === 1 ? "" : "s"}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-amber-950/80">{name} shares hard identifiers with other &ldquo;independent&rdquo; storefronts — the kind of thing one operator doesn&rsquo;t share by accident. If one of these is a known scam, treat the whole cluster with caution.</p>
          <ul className="mt-4 space-y-3">
            {strong.map((l) => (
              <li key={`${l.basis}-${l.linkedSlug}`} className="flex items-start gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                <div className="min-w-0 flex-1">
                  <Link href={`/vendors/${l.linkedSlug}`} className="inline-flex items-center gap-1 text-sm font-semibold hover:underline">{vendorName(l.linkedSlug)} <ArrowUpRight className="size-3.5 text-black/35" /></Link>
                  <p className="mt-0.5 text-xs leading-5 text-black/60">{l.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-semibold text-emerald-900">Distinct operator</p>
          <p className="mt-2 text-sm leading-6 text-emerald-950/70">We checked {name} against every storefront we track for a shared analytics/pixel ID, a reused product photo, the same tested batch, and the same upstream source — and found none. That doesn&rsquo;t prove it&rsquo;s trustworthy, but it isn&rsquo;t part of a detected sock-puppet network.</p>
        </div>
      )}

      {info.length > 0 ? (
        <div className="mt-4 rounded-[26px] border border-blue-200 bg-blue-50/60 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-blue-700">Same upstream source</p>
          <p className="mt-2 text-sm leading-6 text-blue-950/70">Other vendors whose certificates name the same upstream manufacturer as {name}. The underlying product is likely the same — so compare them on price.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {info.map((l) => (
              <Link key={`src-${l.linkedSlug}`} href={`/vendors/${l.linkedSlug}`} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-blue-900 hover:border-blue-400">{vendorName(l.linkedSlug)} <ArrowUpRight className="size-3.5" /></Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
