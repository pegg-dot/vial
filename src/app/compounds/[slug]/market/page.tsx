import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FlaskConical, Layers3, Tag } from "lucide-react";
import { getCompoundBySlug, getProductsByCompoundSlug } from "@/server/catalog/repository";
import { getLabTestsForCompound } from "@/server/ingest/lab-tests";
import { getDatabase } from "@/server/db/client";
import { CompoundMarket } from "@/components/market/compound-market";
import { formatCurrency, formatPricePerMg } from "@/lib/format";
import { splitByRankability } from "@/lib/market-picks";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const compound = await getCompoundBySlug(slug);
  if (!compound) return {};
  return {
    title: `Every ${compound.name} listing`,
    description: `Compare every ${compound.name} listing we track — by real cost per milligram, independently tested purity, and how recently each vendor's store was read.`,
    alternates: { canonical: `/compounds/${slug}/market` },
  };
}

// The full market for one compound. The compound page answers "which one?" with picks and a
// cheapest-first table; this answers "show me everything, my way" — the room you open when the
// summary is not enough. Deliberately its own route so it can be linked, shared and bookmarked.
export default async function CompoundMarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompoundBySlug(slug);
  if (!compound) notFound();

  const [listings, labTests] = await Promise.all([
    getProductsByCompoundSlug(slug),
    getDatabase().then((db) => getLabTestsForCompound(db, slug)),
  ]);

  // Headline figures read off the listings themselves, so this page can never quote a range it
  // does not also render. `splitByRankability` is the same helper the compound table uses.
  const { ranked } = splitByRankability(listings);
  const prices = listings.map((p) => p.price).filter((n) => n > 0).sort((a, b) => a - b);
  const cheapestPerMg = ranked[0]?.pricePerMg ?? null;
  const vendors = new Set(listings.map((p) => p.vendorSlug)).size;

  return (
    <>
      <section className="border-b-2 border-[#111214] bg-[#f0edff]">
        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-10">
          <Link href={`/compounds/${slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-black">
            <ArrowLeft className="size-4" /> Back to {compound.name}
          </Link>
          <h1 className="mt-4 text-balance text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[.98] tracking-[-.045em]">
            Every {compound.name} listing
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-[#111214]/70">
            {listings.length === 0
              ? `We hold no ${compound.name} listings right now.`
              : `All ${listings.length} we track from ${vendors} vendor${vendors === 1 ? "" : "s"}, sorted the way you want to compare them. Prices are read from each vendor's own store; VialGrade sells nothing and takes no money from vendors.`}
          </p>
          {listings.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
              <Stat icon={Layers3} value={String(listings.length)} label="Listings on record" />
              <Stat icon={Tag} value={prices.length ? `${formatCurrency(prices[0])}–${formatCurrency(prices[prices.length - 1])}` : "—"} label="Sticker price range" />
              <Stat icon={FlaskConical} value={cheapestPerMg != null ? formatPricePerMg(cheapestPerMg) : "—"} label="Cheapest per mg" />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-10">
        {listings.length > 0 ? (
          <CompoundMarket compoundName={compound.name} listings={listings} labTests={labTests} />
        ) : (
          <div className="ink hard-sm rounded-[16px] bg-white px-6 py-14 text-center">
            <p className="text-lg font-extrabold">No {compound.name} listing is on record.</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">
              We track this compound but have not read a vendor selling it. That is a gap in our coverage, not a statement about the market.
            </p>
            <Link href={`/compounds/${slug}`} className="ink hard-sm press mt-6 inline-block rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">Back to {compound.name}</Link>
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-1 size-4 shrink-0 text-[#5a4be0]" />
      <div>
        <p className="text-2xl font-extrabold tabular-nums leading-none tracking-[-.04em]">{value}</p>
        <p className="mt-1.5 text-[11px] font-semibold text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
}
