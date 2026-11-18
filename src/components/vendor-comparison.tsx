import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink, EyeOff, FlaskConical } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatCurrency, formatMgTotal, formatPricePerMg } from "@/lib/format";
import { COMPARISON_SORTS, formatPurityRange, reportDay, type ComparedSource, type ComparisonSort, type ComparisonTest } from "@/lib/source-comparison";
import { LISTING_LINK_LABEL, LISTING_LINK_NOTE, listingSourceUrl } from "@/lib/vendor-source-link";
import { checkContent } from "@/server/verify/content-check";
import { Chip, Pill, UI } from "@/components/intelligence/research-ui";
import { ExpandableRows } from "./expandable-rows";

// The vendor comparison for one compound (see lib/source-comparison.ts): one row per source, then
// two sources of the reader's choosing set side by side. Server-rendered throughout. Sorting and
// picking are plain links and a GET form, so a comparison is a URL that can be saved and shared,
// and nothing about a listing reaches the browser beyond the cells drawn here.

const PREVIEW_ROWS = 15;
const SIDE_BY_SIDE = "side-by-side";
const NONE = <span className="text-xs font-medium text-[var(--muted)]">—</span>;
const quiet = (text: string, wrap = false) => <span className={"text-xs font-medium text-[var(--muted)]" + (wrap ? "" : " whitespace-nowrap")}>{text}</span>;
const sub = (text: ReactNode) => <span className="mt-0.5 block whitespace-nowrap text-[11px] font-medium text-[var(--muted)]">{text}</span>;
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

const TEST_TYPE_LABEL: Record<string, string> = {
  sterility: "Sterility", endotoxin: "Endotoxin", "heavy-metals": "Heavy metals",
  dimer: "Dimer/aggregation", blend: "Blend", screening: "ID screen", identity: "Identity",
};

/** The comparison's address with a sort and up to two picked sources; defaults are left out of the URL. */
export function comparisonUrl(base: string, state: { sort?: ComparisonSort; a?: string; b?: string }, hash?: string): string {
  const query = new URLSearchParams();
  if (state.sort && state.sort !== "coverage") query.set("sort", state.sort);
  if (state.a) query.set("a", state.a);
  if (state.b) query.set("b", state.b);
  const search = query.toString();
  return base + (search ? "?" + search : "") + (hash ? "#" + hash : "");
}

/* ───────────────────────────── cells shared by both tables ───────────────────────────── */

function SourceName({ source }: { source: ComparedSource }) {
  return source.vendorSlug
    ? <Link href={`/vendors/${source.vendorSlug}`} className="font-bold text-[#111214] hover:underline">{source.name}</Link>
    : <span className="font-bold text-[#111214]">{source.name}</span>;
}

function sizeRange(sizes: readonly number[]): string | null {
  if (sizes.length === 0) return null;
  const lo = formatMgTotal(sizes[0]), hi = formatMgTotal(sizes[sizes.length - 1]);
  return lo === hi ? lo : `${lo} to ${hi}`;
}

function ListingsCell({ source }: { source: ComparedSource }) {
  if (source.listings.length === 0) return quiet("None on record");
  const sizes = sizeRange(source.sizesMg);
  return <><span className="font-bold tabular-nums">{plural(source.listings.length, "listing")}</span>{sizes && sub(sizes)}</>;
}

function PriceCell({ source }: { source: ComparedSource }) {
  if (source.listings.length === 0) return NONE;
  if (source.lowestPerMg == null) return quiet("No size published");
  const read = source.lowestPerMgListing?.observedAt?.slice(0, 10);
  return (
    <>
      <span className="font-extrabold tabular-nums">{formatPricePerMg(source.lowestPerMg)}</span>
      {read && sub(<>read {read}</>)}
      {source.outlierListings > 0 && sub(<>{plural(source.outlierListings, "price outlier")} set aside</>)}
    </>
  );
}

function ReportsCell({ source }: { source: ComparedSource }) {
  if (source.tests.length === 0) return quiet("None on record");
  return (
    <>
      <span className="font-bold tabular-nums">{source.independentReports}</span>
      {source.blindReports > 0 && sub(<>{source.blindReports} blind</>)}
      {source.otherReports > 0 && sub(<>{source.otherReports} not independent</>)}
    </>
  );
}

function PurityCell({ source }: { source: ComparedSource }) {
  const range = formatPurityRange(source);
  if (!range) return NONE;
  return (
    <>
      <Chip tone="mint" plain className="tabular-nums">{range}</Chip>
      {sub(source.purityCount === 1 ? "1 report" : <>median {source.purityMedian!.toFixed(1)}%, {source.purityCount} reports</>)}
    </>
  );
}

function ContentCell({ source }: { source: ComparedSource }) {
  if (source.contentChecked === 0) return NONE;
  const full = source.contentChecked - source.contentShort;
  return source.contentShort > 0
    ? <Chip tone="danger" plain className="whitespace-nowrap tabular-nums">{source.contentShort} of {source.contentChecked} under label</Chip>
    : <span className="whitespace-nowrap text-xs font-bold tabular-nums text-[#0b6b60]">{full} of {source.contentChecked} at label</span>;
}

/* ───────────────────────────── 1. every source ───────────────────────────── */

export function VendorComparisonTable({ sources, sort, picked, base }: {
  sources: readonly ComparedSource[];
  sort: ComparisonSort;
  /** Keys of the sources already in the side by side, in order. */
  picked: readonly string[];
  /** The page's own path, with no query. */
  base: string;
}) {
  const active = COMPARISON_SORTS.find((s) => s.key === sort)!;
  const [a, b] = picked;

  const pickCell = (source: ComparedSource) => {
    if (picked.includes(source.key)) {
      const rest = picked.filter((k) => k !== source.key);
      return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-extrabold text-[#0b6b60]">
          Selected
          <Link href={comparisonUrl(base, { sort, a: rest[0] })} scroll={false} aria-label={`Remove ${source.name} from the side by side`} className="font-bold text-[var(--muted)] underline underline-offset-2 hover:text-[#111214]">Remove</Link>
        </span>
      );
    }
    // The first pick stays where the reader is; the second completes the pair and goes to it.
    const next = a ? { sort, a, b: source.key } : { sort, a: source.key };
    return (
      <Link href={comparisonUrl(base, next, a ? SIDE_BY_SIDE : undefined)} scroll={Boolean(a)} aria-label={`Add ${source.name} to the side by side`} className={UI.linkSmall + " whitespace-nowrap"}>
        {a ? (b ? "Swap in" : "Set beside") : "Select"}
      </Link>
    );
  };

  const rows = sources.map((source) => (
    <tr key={source.key} data-source={source.key} className={picked.includes(source.key) ? "bg-[#f3fbf8]" : undefined}>
      <td className="px-4 py-2.5">
        <SourceName source={source} />
        {!source.vendorSlug && sub("Named on a lab report")}
      </td>
      <td className="px-4 py-2.5"><ListingsCell source={source} /></td>
      <td className="px-4 py-2.5"><PriceCell source={source} /></td>
      <td className="px-4 py-2.5"><ReportsCell source={source} /></td>
      <td className="px-4 py-2.5"><PurityCell source={source} /></td>
      <td className="px-4 py-2.5"><ContentCell source={source} /></td>
      <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium tabular-nums text-[var(--muted)]">{source.lastReported ?? "—"}</td>
      <td className="px-4 py-2.5">{pickCell(source)}</td>
    </tr>
  ));

  return (
    <div data-testid="vendor-comparison">
      <div className="px-5 pt-4">
        <div role="group" aria-label="Order the sources" className="flex flex-wrap items-center gap-2">
          {COMPARISON_SORTS.map((s) => (
            <Pill key={s.key} href={comparisonUrl(base, { sort: s.key, a, b })} size="sm" variant={s.key === sort ? "ink" : "ghost"} ariaCurrent={s.key === sort ? "true" : undefined}>{s.label}</Pill>
          ))}
        </div>
        <p className={UI.small + " mt-2.5 max-w-3xl"}>{active.blurb}</p>
      </div>
      <div className="mt-4 overflow-x-auto border-t-2 border-[#111214]">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b-2 border-[#111214] bg-[#f7f7f4] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2.5 font-bold">Source</th>
              <th className="px-4 py-2.5 font-bold">Listings</th>
              <th className="px-4 py-2.5 font-bold">Lowest price per mg, as read</th>
              <th className="px-4 py-2.5 font-bold">Independent lab reports</th>
              <th className="px-4 py-2.5 font-bold">Reported purity</th>
              <th className="px-4 py-2.5 font-bold">Content against label</th>
              <th className="px-4 py-2.5 font-bold">Latest report</th>
              <th className="px-4 py-2.5 font-bold">Side by side</th>
            </tr>
          </thead>
          <ExpandableRows colSpan={8} restCount={rows.length - PREVIEW_ROWS} label={`Show all ${rows.length} sources`}
            bodyClassName="divide-y divide-[#111214]/10" preview={rows.slice(0, PREVIEW_ROWS)} rest={rows.slice(PREVIEW_ROWS)} />
        </table>
      </div>
    </div>
  );
}

/* ───────────────────────────── 2. two sources, side by side ───────────────────────────── */

function ListingRows({ source, website }: { source: ComparedSource; website: string | null }) {
  if (source.listings.length === 0) return <p className={UI.small}>No {source.name} listing is on record for this compound. That is a gap in what we have read, not a statement that none exists.</p>;
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[#111214]/15">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="border-b border-[#111214]/15 bg-[#f7f7f4] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">
          <tr><th className="px-3 py-2 font-bold">Size</th><th className="px-3 py-2 font-bold">Price as read</th><th className="px-3 py-2 font-bold">Per mg</th><th className="px-3 py-2 font-bold">Read on</th><th className="px-3 py-2 font-bold">Read from</th></tr>
        </thead>
        <tbody className="divide-y divide-[#111214]/10">
          {source.listings.map((p: Product) => {
            const cite = listingSourceUrl(p.externalUrl, website);
            return (
              <tr key={p.slug}>
                <td className="px-3 py-2 font-bold">{p.mg != null && p.mg > 0 ? formatMgTotal(p.mg) : p.quantity || "—"}{p.availability === "Unavailable" && sub("Unavailable when read")}</td>
                <td className="px-3 py-2 font-extrabold tabular-nums">{p.price > 0 ? formatCurrency(p.price) : quiet("no price read")}</td>
                <td className="px-3 py-2 tabular-nums">{p.pricePerMg != null && p.pricePerMg > 0 ? formatPricePerMg(p.pricePerMg) : NONE}{p.trust?.priceFlag === "too-cheap" && sub("price outlier")}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-medium tabular-nums text-[var(--muted)]">{p.observedAt ? p.observedAt.slice(0, 10) : "—"}</td>
                <td className="px-3 py-2">
                  {cite
                    ? <a href={cite} target="_blank" rel="noopener noreferrer nofollow" title={LISTING_LINK_NOTE} aria-label={`${source.name} listing for ${p.name}, external`} className={UI.linkSmall + " whitespace-nowrap"}>{LISTING_LINK_LABEL} <ExternalLink className="size-3" aria-hidden="true" /></a>
                    : NONE}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportRows({ source }: { source: ComparedSource }) {
  if (source.tests.length === 0) return <p className={UI.small}>No lab report attributed to {source.name} is on record for this compound. The absence of a report is not a finding about the product.</p>;
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[#111214]/15">
      <table className="w-full min-w-[460px] text-left text-sm">
        <thead className="border-b border-[#111214]/15 bg-[#f7f7f4] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">
          <tr><th className="px-3 py-2 font-bold">Purity</th><th className="px-3 py-2 font-bold">Content</th><th className="px-3 py-2 font-bold">Lab</th><th className="px-3 py-2 font-bold">Dated</th><th className="px-3 py-2 font-bold">Batch</th><th className="px-3 py-2 font-bold">Report</th></tr>
        </thead>
        <tbody className="divide-y divide-[#111214]/10">
          {source.tests.map((t: ComparisonTest) => {
            const content = checkContent(t.sample_name, t.measured_content);
            const kind = t.test_type !== "purity" ? TEST_TYPE_LABEL[t.test_type] : null;
            return (
              <tr key={t.verify_url}>
                <td className="px-3 py-2">
                  {t.purity_pct != null && Number.isFinite(Number(t.purity_pct)) ? <span className="font-extrabold tabular-nums">{Number(t.purity_pct).toFixed(2)}%</span> : quiet("See report")}
                  {t.is_blind && <span className="mt-1 flex w-fit" title="The sample was obtained independently, so the source could not choose which vial was tested."><Chip tone="mint" icon={EyeOff}>Blind</Chip></span>}
                  {kind && sub(kind)}
                </td>
                <td className="px-3 py-2 text-xs tabular-nums">
                  {content.verdict
                    ? <span className={content.verdict === "underdosed" ? "font-bold text-[#ce403b]" : "font-bold text-[#0b6b60]"} title={content.note ?? undefined}>{content.measuredMg} of {content.labeledMg}mg{content.verdict === "underdosed" ? ", under label" : ""}</span>
                    : <span className="text-[var(--muted)]">{t.measured_content || "—"}</span>}
                </td>
                <td className="px-3 py-2 text-xs">{t.lab}{t.is_independent === false && sub("Not counted as independent")}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-medium tabular-nums text-[var(--muted)]">{reportDay(t.tested_at) ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--muted)]">{t.batch_code || "—"}</td>
                <td className="px-3 py-2">
                  {/^https?:\/\//i.test(t.verify_url)
                    ? <a href={t.verify_url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Open the lab report for ${t.sample_name}, external`} className={UI.linkSmall + " whitespace-nowrap"}>
                        <FlaskConical className="size-3.5" aria-hidden="true" /> Open <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </a>
                    : NONE}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function VendorSideBySide({ compoundName, sources, picked, sort, base, websiteByVendor }: {
  compoundName: string;
  /** Every source, for the pickers, in the order the table shows them. */
  sources: readonly ComparedSource[];
  /** The one or two sources chosen. */
  picked: readonly ComparedSource[];
  sort: ComparisonSort;
  base: string;
  /** Each vendor's released website (storefrontUrlFor), which decides whether a listing may be cited. */
  websiteByVendor: ReadonlyMap<string, string | null>;
}) {
  const [first, second] = picked;
  const anyCite = picked.some((s) => s.vendorSlug && s.listings.some((p) => listingSourceUrl(p.externalUrl, websiteByVendor.get(s.vendorSlug!))));

  const picker = (name: "a" | "b", label: string, selected: ComparedSource | undefined) => (
    <label className="grid min-w-[13rem] flex-1 gap-1.5 text-xs font-bold text-[#4a4d56]">
      {label}
      <select name={name} defaultValue={selected?.key ?? ""} className="field min-h-11 w-full min-w-0 rounded-[12px] bg-white px-3 text-sm font-bold text-[#111214]">
        <option value="">Choose a source</option>
        {sources.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
      </select>
    </label>
  );

  const measures: Array<{ label: string; cell: (s: ComparedSource) => ReactNode }> = [
    { label: "Vendor record", cell: (s) => s.vendorSlug
        ? <Link href={`/vendors/${s.vendorSlug}`} className={UI.linkSmall}>Open the {s.name} record</Link>
        : quiet("None: named on a lab report only", true) },
    { label: "Listings on record", cell: (s) => <ListingsCell source={s} /> },
    { label: "Lowest price per mg, as read", cell: (s) => <PriceCell source={s} /> },
    { label: "Most recent read", cell: (s) => (s.lastRead ? <span className="text-xs font-medium tabular-nums">{s.lastRead}</span> : NONE) },
    { label: "Independent lab reports", cell: (s) => <ReportsCell source={s} /> },
    { label: "Reported purity", cell: (s) => <PurityCell source={s} /> },
    { label: "Content against label", cell: (s) => <ContentCell source={s} /> },
    { label: "Most recent report", cell: (s) => (s.lastReported ? <span className="text-xs font-medium tabular-nums">{s.lastReported}</span> : NONE) },
  ];

  return (
    <div data-testid="vendor-side-by-side" className="space-y-5">
      {/* Keyed on the pair: the selects are uncontrolled, and a pick made from the table arrives as a
          client navigation, which would otherwise leave them showing the pair before it. */}
      <form key={picked.map((s) => s.key).join("|")} method="get" action={base + "#" + SIDE_BY_SIDE} className="flex flex-wrap items-end gap-3">
        {sort !== "coverage" && <input type="hidden" name="sort" value={sort} />}
        {picker("a", "First source", first)}
        {picker("b", "Second source", second)}
        <Pill type="submit" variant="primary">Compare</Pill>
        {picked.length > 0 && <Link href={comparisonUrl(base, { sort }, SIDE_BY_SIDE)} className={UI.linkSmall + " min-h-11"}>Clear</Link>}
      </form>

      {picked.length === 0 ? (
        <p className={UI.body}>Choose two sources of {compoundName}, here or with &ldquo;Select&rdquo; in the table above, to set what each lists and what a lab reported for each side by side.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[14px] ink-1 bg-white">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b-2 border-[#111214] bg-[#f7f7f4]">
                <tr>
                  <th className="w-[30%] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">On record</th>
                  {picked.map((s) => <th key={s.key} scope="col" className="px-4 py-3 text-base font-extrabold tracking-[-.02em] text-[#111214]">{s.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111214]/10">
                {measures.map((m) => (
                  <tr key={m.label}>
                    <th scope="row" className="px-4 py-2.5 text-xs font-bold text-[#4a4d56]">{m.label}</th>
                    {picked.map((s) => <td key={s.key} className="px-4 py-2.5 align-top">{m.cell(s)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {picked.length === 1 && <p className={UI.small}>Choose a second source to set beside {first.name}.</p>}

          <div className={"grid gap-5 " + (picked.length > 1 ? "lg:grid-cols-2" : "")}>
            {picked.map((s) => (
              <div key={s.key} data-source-detail={s.key} className="min-w-0 space-y-4">
                <h3 className={UI.h4}>{s.name}</h3>
                <div className="space-y-2">
                  <p className={UI.eyebrowMuted}>Listings on record</p>
                  <ListingRows source={s} website={s.vendorSlug ? websiteByVendor.get(s.vendorSlug) ?? null : null} />
                </div>
                <div className="space-y-2">
                  <p className={UI.eyebrowMuted}>Lab reports on record</p>
                  <ReportRows source={s} />
                </div>
              </div>
            ))}
          </div>
          <p className={UI.small}>
            A side by side of records, not a verdict. Each price is a dated third-party observation, not an offer, and each lab report describes the one sample submitted, not what a later shipment contains.{anyCite ? " " + LISTING_LINK_NOTE : ""}
          </p>
        </>
      )}
    </div>
  );
}
