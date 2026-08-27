import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * How much of the set this row is actually showing.
 *
 * Every curated row here is a top-N — `bestValue(products, 8)`, `trending(compounds, 10)` — and
 * none of them said so. "Lowest cost per mg" rendered eight tiles with no way to reach the ninth
 * and nothing on the page admitting a ninth existed, which reads as "these are the cheapest
 * listings" rather than "these are the eight cheapest of 214". A truncated set presented as the
 * whole set is a claim we cannot stand behind, and it is the same defect as a page size rendered
 * under the word "total" (see /signals).
 *
 * `noun` is what the total counts, in the reader's words — "compounds", "priced listings".
 */
export interface CollectionRowExtent {
  shown: number;
  total: number;
  noun: string;
}

// A titled horizontal snap-carousel. Children are tiles the caller sizes
// (w-[280px] shrink-0 snap-start). Reuses the site-wide scroll-fade carousel pattern.
export function CollectionRow({
  eyebrow,
  title,
  blurb,
  extent,
  seeAllHref,
  seeAllLabel = "See all",
  children,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
  extent?: CollectionRowExtent;
  seeAllHref?: string;
  seeAllLabel?: string;
  children: React.ReactNode;
}) {
  const truncated = extent ? extent.total > extent.shown : false;
  return (
    <section className="py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">{title}</h2>
          {blurb && <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{blurb}</p>}
          {extent && truncated && (
            <p className="mt-2 text-xs font-bold text-[#0e8f80]">
              Showing the top <span className="tabular-nums">{extent.shown}</span> of{" "}
              <span className="tabular-nums">{extent.total}</span> {extent.noun}.
            </p>
          )}
        </div>
        {seeAllHref && (
          <Link href={seeAllHref} className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#111214]">
            {seeAllLabel} <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <div className="scroll-fade-x -mx-5 mt-6 overflow-x-auto px-5 pb-3 no-scrollbar sm:-mx-8 sm:px-8">
        <div className="flex w-max snap-x snap-mandatory gap-4">{children}</div>
      </div>
    </section>
  );
}
