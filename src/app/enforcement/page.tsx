import type { Metadata } from "next";
import { enforcementEmptyState } from "@/lib/enforcement-copy";
import Link from "next/link";
import { Gavel, ExternalLink, ShieldAlert, Landmark, Scale } from "lucide-react";
import { listEnforcementPage, getRegulatoryStats, type EnforcementFilter } from "@/server/regulatory/repository";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { reportError } from "@/server/observability/alerts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Enforcement record", description: "Public FDA, DOJ, and FTC actions against peptide and research-chemical sellers — sourced, factual, never our accusation.", alternates: { canonical: "/enforcement" } };

const AGENCY: Record<string, string> = { FDA: "FDA", DOJ: "U.S. DOJ", FTC: "FTC", state: "State", other: "Regulator" };
const TYPE: Record<string, string> = { warning_letter: "Warning letter", import_alert: "Import alert", doj_action: "Enforcement action", ftc_action: "FTC action", recall: "Recall", advisory: "Advisory" };

const FILTERS: { key: EnforcementFilter; label: string }[] = [
  { key: "matched", label: "Affects a vendor we track" },
  { key: "severe", label: "Proven &amp; severe" },
  { key: "all", label: "Everything on record" },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const sp = await searchParams;
  // Default to the records that touch a vendor a buyer might actually use. The openFDA feed is
  // mostly recalls naming companies we do not track — real, but not what someone is here for.
  const requested: EnforcementFilter = sp.filter === "all" ? "all" : sp.filter === "severe" ? "severe" : "matched";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const perPage = 50;
  const loaded = await Promise.all([
    listEnforcementPage({ filter: requested, page, perPage }),
    getRegulatoryStats(),
  ]).catch((error) => {
    reportError({ kind: "enforcement-unavailable", message: "The enforcement record could not be read.", context: { error: String(error) } });
    return null;
  });
  if (!loaded) return <DataUnavailable surface="the enforcement record" />;
  let [feed] = loaded;
  const [, stats] = loaded;
  // The default filter can be dead on arrival: a corpus of only unmatched openFDA recalls means
  // "matched" is empty, and the landing page was then blank while "Everything on record" had
  // content. Only falls back when the reader did NOT choose the filter themselves.
  const fellBack = !sp.filter && feed.total === 0 && stats.total > 0;
  if (fellBack) feed = await listEnforcementPage({ filter: "all", page: 1, perPage });
  const filter: EnforcementFilter = fellBack ? "all" : requested;
  const actions = feed.items;
  const pages = Math.max(1, Math.ceil(feed.total / perPage));
  const from = feed.total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, feed.total);
  const href = (f: EnforcementFilter, p: number) => `/enforcement?filter=${f}${p > 1 ? `&page=${p}` : ""}`;
  // One decision, used by both the count line and the empty block — they used to disagree.
  const empty = enforcementEmptyState({ corpusTotal: stats.total, filteredTotal: feed.total });
  return <div>
    <section className="border-b-2 border-[#111214]"><div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#d3372c]">Enforcement record</p>
      <h1 className="mt-4 max-w-5xl text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">The government paper trail.</h1>
      <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[var(--muted)]">Public FDA warning letters and import alerts, DOJ prosecutions, FTC actions, and recalls affecting peptide and research-chemical sellers. Every entry is a real government record with its source linked. We report the action &mdash; we never add an accusation of our own, and a match to a specific vendor is only made when we&rsquo;re confident.</p>
      <div className="mt-10 grid gap-3 sm:grid-cols-4">
        <Stat icon={Gavel} value={stats.total} label="Actions on record" />
        <Stat icon={ShieldAlert} value={stats.severe} label="Severe (proven)" />
        <Stat icon={Landmark} value={stats.vendorsAffected} label="Tracked vendors affected" />
        <Stat icon={Scale} value={stats.agencies} label="Agencies" />
      </div>
    </div></section>
    <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = f.key === "matched" ? feed.matched : f.key === "severe" ? feed.severe : stats.total;
          const active = f.key === filter;
          return <Link key={f.key} href={href(f.key, 1)} className={`ink-1 press rounded-full px-4 py-2 text-sm font-bold ${active ? "bg-[#111214] text-white" : "bg-white"}`}>
            {f.key === "matched" ? "Affects a vendor we track" : f.key === "severe" ? "Proven & severe" : "Everything on record"} <span className={active ? "text-white/60" : "text-[var(--muted)]"}>{count}</span>
          </Link>;
        })}
      </div>
      <p className="mt-4 text-sm font-medium text-[var(--muted)]">
        {empty.kind === "results" ? <>Showing {from}&ndash;{to} of {feed.total}.</> : empty.kind === "filter-empty" ? empty.message : ""}
      </p>
      <div className="mt-6 space-y-3">{actions.map((a) => {
        const severe = a.severity === "severe";
        return <div key={a.id} className={`ink-1 hard rounded-[18px] p-6 ${severe ? "bg-[#ffecea]" : "bg-white"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{AGENCY[a.agency] ?? a.agency} · {TYPE[a.action_type] ?? a.action_type}{a.outcome ? ` · ${a.outcome.replaceAll("_", " ")}` : ""}{a.action_date ? ` · ${a.action_date}` : ""}</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-.02em]">{a.title}</h2>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">Named: <span className="font-bold text-[#111214]">{a.subject_name}</span>{a.vendor_name ? <> · matched to <Link href={`/vendors/${a.vendor_slug}`} className="font-bold text-[#d3372c] hover:underline">{a.vendor_name}</Link></> : <span className="text-[var(--muted)]"> · not matched to a tracked vendor</span>}</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#111214]/70">{a.summary}</p>
            </div>
            <span className={`ink-1 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white ${severe ? "bg-[#d3372c]" : a.severity === "caution" ? "bg-[#b26a00]" : "bg-black/40"}`}>{a.severity}</span>
          </div>
          <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#d3372c] underline underline-offset-2">Read the official record <ExternalLink className="size-3" /></a>
        </div>;
      })}</div>
      {empty.kind === "corpus-empty" && <p className="text-sm font-medium text-[var(--muted)]">{empty.message}</p>}
      {empty.kind === "filter-empty" && <p className="text-sm font-medium text-[var(--muted)]">{empty.message} <Link href={href("all", 1)} className="font-bold text-[#111214] underline underline-offset-2">See everything on record</Link>.</p>}
      <div className="ink mt-10 rounded-[20px] bg-[#111214] p-7 text-white shadow-[5px_5px_0_0_#d3372c]"><Scale className="size-5 text-[#ff9b8f]" />
        <h2 className="mt-5 text-2xl font-extrabold">A record is a fact, not a verdict on the product.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">An FDA warning letter usually means a seller marketed unapproved drugs &mdash; it doesn&rsquo;t always mean the specific product you&rsquo;re looking at is impure. We show the record and the source so you can judge; we distinguish a proven criminal outcome from a mere charge, and a warning letter from a conviction. We never infer guilt VialGrade cannot source.</p>
      </div>
      {pages > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {page > 1 && <Link href={href(filter, page - 1)} className="ink-1 press rounded-full bg-white px-4 py-2 text-sm font-bold">&larr; Newer</Link>}
          <span className="px-2 text-sm font-bold text-[var(--muted)]">Page {page} of {pages}</span>
          {page < pages && <Link href={href(filter, page + 1)} className="ink-1 press rounded-full bg-white px-4 py-2 text-sm font-bold">Older &rarr;</Link>}
        </div>
      )}
    </section>
  </div>;
}
function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) { return <div className="ink-1 hard rounded-[18px] bg-white p-5"><Icon className="size-4 text-[#d3372c]" /><p className="mt-5 text-3xl font-extrabold tracking-[-.055em] tabular-nums">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{label}</p></div>; }
