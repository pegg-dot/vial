import Link from "next/link";
import { GitMerge, ArrowUpRight } from "lucide-react";
import type { VendorLink } from "@/server/verify/vendor-linkage";

const vendorName = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// The operator-network view: which "independent" storefronts are actually one operator (shared
// analytics/pixel or the same tested batch) or one source (same upstream maker). This is the
// thing a buyer can't see on a single site — so it's shown loudest when it's strongest.
export function VendorLinksPanel({ links, vendorName: name }: { links: VendorLink[]; vendorName: string }) {
  const strong = links.filter((l) => l.strength === "strong");
  const info = links.filter((l) => l.strength === "info");

  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-12 sm:px-8 sm:pt-14">
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Who owns it</p>
        <h2 className="mt-2 text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold leading-[1.02] tracking-[-.035em]">Who&rsquo;s really behind {name}?</h2>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">
          {strong.length > 0
            ? `${name} shares hard identifiers with ${strong.length} other storefront${strong.length === 1 ? "" : "s"} we track — very likely the same operator behind more than one "independent" shop.`
            : `We found no hard identifier tying ${name} to any other storefront we track.`}
        </p>
      </div>

      {strong.length > 0 ? (
        <div className="ink hard rounded-[20px] bg-[#fff6e6] p-6">
          <div className="flex items-center gap-2">
            <span className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#b26a00]"><GitMerge className="size-3.5" /> Linked to {strong.length} other storefront{strong.length === 1 ? "" : "s"}</span>
          </div>
          <p className="mt-3 text-sm font-medium leading-6 text-[#111214]/75">{name} shares things with other &ldquo;different&rdquo; shops that nobody shares with a real competitor by accident &mdash; the same tracking code, the same photos, or the same tested batch. They are very likely the same people. If one of them is a known scam, be careful with all of them.</p>
          <ul className="mt-4 space-y-3">
            {strong.map((l) => (
              <li key={`${l.basis}-${l.linkedSlug}`} className="flex items-start gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#b26a00]" />
                <div className="min-w-0 flex-1">
                  <Link href={`/vendors/${l.linkedSlug}`} className="inline-flex items-center gap-1 text-sm font-bold hover:underline">{vendorName(l.linkedSlug)} <ArrowUpRight className="size-3.5 text-black/35" /></Link>
                  <p className="mt-0.5 text-xs font-medium leading-5 text-black/60">{l.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="ink hard rounded-[20px] bg-[#e6fbf6] p-6">
          <p className="text-sm font-extrabold text-[#0e8f80]">Not linked to any other store we track</p>
          <p className="mt-2 text-sm font-medium leading-6 text-[#111214]/75">We checked {name} against every other store we track for the tell-tale signs that two &ldquo;different&rdquo; shops are the same people: the same tracking code, the same product photo, the same tested batch, the same supplier. We found none. That doesn&rsquo;t make them trustworthy &mdash; it just means they aren&rsquo;t one of a group of fake &ldquo;rival&rdquo; stores we&rsquo;ve spotted.</p>
        </div>
      )}

      {info.length > 0 ? (
        <div className="ink hard mt-4 rounded-[20px] bg-[#eef0ff] p-6">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">Same supplier</p>
          <p className="mt-2 text-sm font-medium leading-6 text-[#111214]/75">These stores&rsquo; lab reports name the same maker as {name}&rsquo;s do. You are probably looking at the same product in a different box &mdash; so compare them on price.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {info.map((l) => (
              <Link key={`src-${l.linkedSlug}`} href={`/vendors/${l.linkedSlug}`} className="ink-1 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-[#2b31d8] hover:-translate-y-0.5">{vendorName(l.linkedSlug)} <ArrowUpRight className="size-3.5" /></Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
