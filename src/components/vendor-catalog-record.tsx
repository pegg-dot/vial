import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatCurrency, formatMgTotal, formatPricePerMg } from "@/lib/format";
import { LISTING_LINK_LABEL, LISTING_LINK_NOTE, listingSourceUrl } from "@/lib/vendor-source-link";
import { UI } from "@/components/intelligence/research-ui";
import { ExpandableRows } from "./expandable-rows";

// A vendor's catalog as a record, for the evidence-only release with the market record on: what
// was listed, the size, the price on the day it was read and the listing it was read from. A plain
// server-rendered table, because the product cards the legacy site uses lead to product pages and a
// compare tray that stay closed here. Rows arrive in the page's order (most recently read first).
const PREVIEW_ROWS = 12;

const AVAIL: Partial<Record<Product["availability"], string>> = {
  "Low stock": "Low stock when read",
  Unavailable: "Unavailable when read",
};

export function VendorCatalogRecord({ products, vendorName, compoundNames, websiteUrl }: {
  products: readonly Product[];
  vendorName: string;
  /** Compound slug to display name, for the link to each compound's page. */
  compoundNames: ReadonlyMap<string, string>;
  /** The vendor's released website (storefrontUrlFor), or null: no citation link without it. */
  websiteUrl: string | null;
}) {
  const sources = products.map((p) => listingSourceUrl(p.externalUrl, websiteUrl));
  const anySource = sources.some(Boolean);

  const rows = products.map((p, i) => {
    const compoundName = compoundNames.get(p.compoundSlug);
    const readOn = p.observedAt ? p.observedAt.slice(0, 10) : null;
    const avail = AVAIL[p.availability];
    const source = sources[i];
    return (
      <tr key={p.slug}>
        <td className="px-4 py-2.5">
          <span className="font-bold text-[#111214]">{p.name}</span>
          {compoundName && (
            <Link href={`/compounds/${p.compoundSlug}`} className="mt-0.5 block w-fit whitespace-nowrap text-xs font-bold text-[#2b31d8] hover:underline">{compoundName} record</Link>
          )}
        </td>
        <td className="px-4 py-2.5 font-medium text-[var(--muted)]">
          {p.mg != null && p.mg > 0 ? <span className="font-bold text-[#111214]">{formatMgTotal(p.mg)} total</span> : p.quantity || "—"}
        </td>
        <td className="px-4 py-2.5 font-extrabold tabular-nums">
          {p.price > 0 ? formatCurrency(p.price) : <span className="text-xs font-medium text-[var(--muted)]">no price read</span>}
          {avail && <span className="block text-[11px] font-bold text-[#4a4d56]">{avail}</span>}
        </td>
        <td className="px-4 py-2.5 tabular-nums">
          {p.pricePerMg != null && p.pricePerMg > 0 ? formatPricePerMg(p.pricePerMg) : <span className="text-xs font-medium text-[var(--muted)]">—</span>}
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium tabular-nums text-[var(--muted)]">{readOn ?? "—"}</td>
        <td className="px-4 py-2.5">
          {source
            ? <a href={source} target="_blank" rel="noopener noreferrer nofollow" title={LISTING_LINK_NOTE} aria-label={`${vendorName} listing for ${p.name}, external`} className="inline-flex min-h-6 items-center gap-1 whitespace-nowrap text-xs font-bold text-[#2b31d8] hover:underline">{LISTING_LINK_LABEL} <ExternalLink className="size-3" aria-hidden="true" /></a>
            : <span className="text-xs font-medium text-[var(--muted)]">—</span>}
        </td>
      </tr>
    );
  });

  return (
    <div data-testid="vendor-catalog-record">
      <div className="overflow-x-auto rounded-[16px] ink bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b-2 border-[#111214] bg-[#f7f7f4] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2.5 font-bold">Listing</th>
              <th className="px-4 py-2.5 font-bold">Size</th>
              <th className="px-4 py-2.5 font-bold">Price as read</th>
              <th className="px-4 py-2.5 font-bold">Per mg</th>
              <th className="px-4 py-2.5 font-bold">Read on</th>
              <th className="px-4 py-2.5 font-bold">Read from</th>
            </tr>
          </thead>
          <ExpandableRows colSpan={6} restCount={rows.length - PREVIEW_ROWS} label={`Show all ${rows.length} listings`}
            bodyClassName="divide-y divide-[#111214]/10" preview={rows.slice(0, PREVIEW_ROWS)} rest={rows.slice(PREVIEW_ROWS)} />
        </table>
      </div>
      <p className={UI.small + " mt-3"}>
        Each row is a dated observation of {vendorName}&rsquo;s own listing, not an offer, and it says nothing about what a shipment contains.{anySource ? " " + LISTING_LINK_NOTE : ""}
      </p>
    </div>
  );
}
