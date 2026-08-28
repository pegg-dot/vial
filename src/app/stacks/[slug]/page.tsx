import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Layers3 } from "lucide-react";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { reportError } from "@/server/observability/alerts";
import { STACKS, stackBySlug, resolveStack, resolveStackDetail, type StackComponentDetail } from "@/lib/stacks";
import { compoundTrustTier } from "@/lib/curation";
import { shelfForCompound } from "@/lib/market-taxonomy";
import { formatCurrency, formatPricePerMg } from "@/lib/format";
import { displayProductTitle } from "@/lib/product-title";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { ProductCard } from "@/components/product-card";
import { StackCard } from "@/components/market/stack-card";
import { TrustLine } from "@/components/listing-trust-chip";
import { VialPlain } from "@/components/vial-art";

export const dynamic = "force-dynamic";

// The page a stack card leads to. It did not exist: the card linked to whichever compound happened
// to be first in the recipe, so "GLOW" and "KLOW" both opened /compounds/ghk-cu and "Wolverine"
// opened BPC-157 — a reader pressing a stack landed somewhere that never mentioned the stack.
//
// What a stack page owes the reader, in order: what the combination IS (a discussion, never a
// protocol — no doses, no schedules, no "take"), what it costs to actually buy across the market
// (cheapest listing of each component, and the cheapest where the vendor's own vial is tested),
// and each component's own market with a way into its full page.

export function generateStaticParams() {
  return STACKS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const stack = stackBySlug(slug);
  if (!stack) return {};
  const parts = stack.componentSlugs.length;
  return {
    title: `${stack.name} stack`,
    description: `${stack.name} — a commonly discussed ${stack.kind} of ${parts} research compounds. Every vendor and price for each component, side by side. Not a protocol.`,
    alternates: { canonical: `/stacks/${slug}` },
  };
}

const TIER_TEXT = { independent: "text-[#0e8f80]", vendor: "text-[#b26a00]", none: "text-[var(--muted)]" } as const;

function Stat({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="ink-1 hard-sm rounded-[14px] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1.5 text-[26px] font-extrabold leading-none tabular-nums tracking-[-.04em] ${tone}`}>{value}</p>
      <p className="mt-1.5 text-[11px] font-semibold leading-4 text-[var(--muted)]">{note}</p>
    </div>
  );
}

function ListingCell({ product, vendorName }: { product: StackComponentDetail["cheapest"]; vendorName?: string }) {
  if (!product) return <span className="text-[12px] font-semibold text-[var(--muted)]">No listing meets this</span>;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2">
        <span className="text-[16px] font-extrabold tabular-nums tracking-[-.03em]">{formatCurrency(product.price)}</span>
        {product.pricePerMg ? <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">{formatPricePerMg(product.pricePerMg)}</span> : null}
      </div>
      <Link href={`/products/${product.slug}`} className="mt-0.5 block truncate text-[12px] font-bold hover:underline">{displayProductTitle(product.name, product.quantity)}</Link>
      <p className="truncate text-[11px] font-semibold text-[var(--muted)]">
        <Link href={`/vendors/${product.vendorSlug}`} className="hover:text-[#111214]">{vendorName ?? product.vendorSlug}</Link>
      </p>
      <div className="mt-1"><TrustLine trust={product.trust} /></div>
    </div>
  );
}

export default async function StackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const stack = stackBySlug(slug);
  if (!stack) notFound();

  const catalog = await getCatalogSnapshot().catch((error) => {
    reportError({ kind: "stack-unavailable", message: "The stack page could not read the catalog.", context: { error: String(error), slug } });
    return null;
  });
  if (!catalog) return <DataUnavailable surface="this stack" />;

  const detail = resolveStackDetail(stack, catalog.compounds, catalog.products);
  if (!detail) notFound();
  const { components, missing, lowestCombined, testedCombined, medianCombined, anyLive } = detail;
  const vendorName = new Map(catalog.vendors.map((v) => [v.slug, v.name]));
  const isBlend = stack.kind === "blend";
  // The recipe's size, not the number the catalog happens to track — "1 compounds bought separately"
  // is what a 2-compound recipe read as when one component was missing.
  const size = stack.componentSlugs.length;
  const vendorsAcross = new Set(components.flatMap((c) => catalog.products.filter((p) => p.compoundSlug === c.compound.slug && p.price > 0).map((p) => p.vendorSlug))).size;
  const others = STACKS.filter((s) => s.slug !== stack.slug)
    .map((s) => resolveStack(s, catalog.compounds))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, 6);

  return (
    <>
      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#eafff7]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-12">
          <Link href="/market" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#0e8f80] hover:underline"><ArrowLeft className="size-3.5" /> Market</Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#0e8f80]">
                <Layers3 className="size-3.5" /> Commonly discussed · {isBlend ? "Blend" : "Recipe"}
              </p>
              <h1 className="mt-3 flex flex-wrap items-center gap-3 text-balance text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-[.92] tracking-[-.05em]">
                {stack.name}
                {anyLive && <DataOriginBadge origin="live" />}
              </h1>
              <p className="mt-3 text-lg font-semibold text-[#111214]/80">{stack.goal}</p>
              <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-[#111214]/70">
                {isBlend
                  ? `A blend: one pre-mixed vial combining ${size} compounds. Below is each component's own market, so the blend's price can be judged against buying the parts.`
                  : `A recipe: ${size} compounds bought separately. Below is every vendor and price for each part, and the cheapest way to assemble the whole thing.`}{" "}
                A commonly discussed research combination &mdash; not a protocol, not a dose, not a recommendation.
              </p>
            </div>
            <div className="flex items-center">
              {components.slice(0, 4).map((c) => (
                <VialPlain key={c.compound.slug} className="-ml-4 h-16 w-16 drop-shadow-[4px_4px_0_#111214] first:ml-0 sm:h-20 sm:w-20" liquid={c.compound.accent?.[0] ?? stack.accent} />
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Lowest combined" value={lowestCombined != null ? formatCurrency(lowestCombined) : "—"} note={lowestCombined != null ? "Cheapest listing of each component, added up." : "Not every component has a priced listing yet."} />
            <Stat label="Cheapest tested" value={testedCombined != null ? formatCurrency(testedCombined) : "—"} tone={testedCombined != null ? "text-[#0e8f80]" : ""} note={testedCombined != null ? "Each vendor's own vial carries a lab test." : "At least one component has no tested listing."} />
            <Stat label="Median combined" value={medianCombined != null ? formatCurrency(medianCombined) : "—"} note="Typical market price of each component, added up." />
            <Stat label="Vendors" value={String(vendorsAcross)} note={`Distinct vendors selling at least one of the ${size} components.`} />
          </div>
          {missing.length > 0 && (
            <p className="mt-4 text-[12px] font-semibold text-[#b26a00]">
              Not tracked yet: {missing.join(", ")} &mdash; the totals above are withheld rather than shown for a partial stack.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]">Assemble it</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Cheapest way to buy this {isBlend ? "blend's parts" : "stack"}</h2>
        <p className="mt-1.5 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">
          Two answers per component: the cheapest listing on the market, and the cheapest whose vendor&rsquo;s own vial carries a lab test. VialGrade hands you to the vendor; it never sells.
        </p>
        <div className="ink-1 hard-sm mt-5 overflow-x-auto rounded-[16px] bg-white">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b-2 border-[#111214]/10 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Cheapest listing</th>
                <th className="px-4 py-3">Cheapest with a lab test</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.compound.slug} className="border-b-2 border-[#111214]/10 align-top last:border-b-0">
                  <td className="px-4 py-4">
                    <Link href={`/compounds/${c.compound.slug}`} className="text-[15px] font-extrabold tracking-[-.02em] hover:underline">{c.compound.name}</Link>
                    <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">{c.vendors} vendor{c.vendors === 1 ? "" : "s"}{c.compound.medianPrice > 0 ? ` · median ${formatCurrency(c.compound.medianPrice)}` : ""}</p>
                  </td>
                  <td className="px-4 py-4"><ListingCell product={c.cheapest} vendorName={c.cheapest ? vendorName.get(c.cheapest.vendorSlug) : undefined} /></td>
                  <td className="px-4 py-4"><ListingCell product={c.cheapestTested} vendorName={c.cheapestTested ? vendorName.get(c.cheapestTested.vendorSlug) : undefined} /></td>
                </tr>
              ))}
              <tr className="bg-[var(--background)] text-[15px] font-extrabold tabular-nums">
                <td className="px-4 py-3">Combined</td>
                <td className="px-4 py-3">{lowestCombined != null ? formatCurrency(lowestCombined) : <span className="text-[var(--muted)]">—</span>}</td>
                <td className="px-4 py-3 text-[#0e8f80]">{testedCombined != null ? formatCurrency(testedCombined) : <span className="text-[var(--muted)]">—</span>}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {components.map((c) => {
        const tier = compoundTrustTier(c.compound);
        const shelf = shelfForCompound(c.compound);
        return (
          <section key={c.compound.slug} className="mx-auto max-w-[1320px] px-5 py-6 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">{shelf.label}</p>
                <h2 className="mt-1.5 text-2xl font-extrabold tracking-[-.04em]">{c.compound.name} <span className="text-[var(--muted)]">·</span> <span className="text-[var(--muted)]">{c.compound.shorthand}</span></h2>
                <p className={`mt-1.5 text-[12px] font-bold ${TIER_TEXT[tier.tier]}`} title={tier.reasons.join(" · ")}>
                  {tier.label}{c.compound.medianPurity != null ? ` · ${c.compound.medianPurity.toFixed(1)}% median tested purity` : ""}
                </p>
              </div>
              <Link href={`/compounds/${c.compound.slug}`} className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-bold">
                Every {c.compound.name} listing <ArrowUpRight className="size-4" />
              </Link>
            </div>
            {c.bestValue.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {c.bestValue.map((p) => <ProductCard key={p.slug} product={p} />)}
              </div>
            ) : (
              <p className="ink-1 mt-4 rounded-[14px] bg-white px-5 py-8 text-center text-sm font-semibold text-[var(--muted)]">No priced listing for {c.compound.name} on the market yet.</p>
            )}
          </section>
        );
      })}

      {others.length > 0 && (
        <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]">Commonly discussed</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Other stacks</h2>
          <div className="scroll-fade-x -mx-5 mt-4 overflow-x-auto px-5 pb-2 no-scrollbar sm:-mx-8 sm:px-8">
            <div className="flex w-max snap-x snap-mandatory gap-4">
              {others.map((r) => <StackCard key={r.stack.slug} resolved={r} />)}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1320px] px-5 pb-14 pt-2 sm:px-8">
        <div className="ink-1 rounded-[16px] bg-[#fff6e6] p-5 text-[13px] font-medium leading-6 text-[#111214]/80">
          Stacks on VialGrade are combinations the research community discusses. Nothing here is a protocol, a dose, a schedule, or a suggestion to use anything &mdash; the page exists so the cost and evidence of each part can be compared honestly across vendors.
        </div>
      </section>
    </>
  );
}
