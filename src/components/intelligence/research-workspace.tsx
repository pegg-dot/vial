"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, ClipboardCopy, Download, ExternalLink, FileSearch, GitCompareArrows, LibraryBig, Radar, SlidersHorizontal } from "lucide-react";
import type { ResearchDossier } from "@/server/intelligence/public-dossiers";
import { citationPack, evidenceCaveats, evidenceItems, type EvidenceItem } from "@/lib/research-evidence";

type Filter = "all" | "trial" | "publication";
type Ordering = "newest" | "oldest";

function sampled(count: number, unavailable: boolean): string {
  return unavailable ? "Source unavailable" : count + " returned";
}

function dateLabel(date: string | null): string {
  return date ?? "Date unreported";
}

const filterLabels: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "trial", label: "Trial registry" },
  { value: "publication", label: "Publications" },
];

function SourceStatus({ unavailable, count, label }: { unavailable: boolean; count: number; label?: string }) {
  return (
    <span className={unavailable
      ? "inline-flex rounded-full border border-amber-700/20 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800"
      : "inline-flex rounded-full border border-[#111214]/10 bg-[#f4f4ef] px-2.5 py-1 text-[11px] font-bold text-[#111214]/70"}>
      {label ? label + ": " : ""}{sampled(count, unavailable)}
    </span>
  );
}

export function ResearchWorkspace({ dossiers, selectedTopic }: {
  dossiers: ResearchDossier[];
  selectedTopic?: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [ordering, setOrdering] = useState<Ordering>("newest");
  const [recordQuery, setRecordQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const dossier = selectedTopic ? dossiers.find(d => d.key === selectedTopic) : null;

  const items = useMemo(() => {
    if (!dossier) return [];
    const all = evidenceItems(dossier);
    const query = recordQuery.trim().toLocaleLowerCase();
    const matching = all.filter(item => (filter === "all" || item.kind === filter) &&
      (!query || [item.title, item.id, item.details].some(value => value.toLocaleLowerCase().includes(query))));
    return ordering === "newest" ? matching : [...matching].reverse();
  }, [dossier, filter, ordering, recordQuery]);

  const rawCitations = dossier ? citationPack(dossier) : "";

  async function copySources() {
    if (!dossier) return;
    try {
      await navigator.clipboard.writeText(rawCitations);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  function downloadSources() {
    if (!dossier) return;
    // Export is generated only in the browser. No account, server write,
    // external analytics event or personal research profile is created.
    const blob = new Blob([rawCitations], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vialgrade-" + dossier.key + "-sources.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!dossier) return (
    <section id="workspace" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-[#2b31d8]">
            <Radar className="size-4" /> Working research workspace
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-.045em] sm:text-5xl">Start with a compound. Trace the sources.</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            This index searches two independent public data systems for three predefined R&amp;D topics.
            Open a dossier to see dated source records, the limits of the results and a portable citation list.
            These are search samples, not complete research reviews.
          </p>
        </div>
        <span className="rounded-full border border-[#111214]/20 bg-white px-4 py-2 text-xs font-bold">
          3 research topics · 2 source systems
        </span>
      </div>

      <div className="mt-9 grid gap-4 lg:grid-cols-3">
        {dossiers.map((entry, i) => (
          <article key={entry.key} className="ink hard-sm flex flex-col rounded-[20px] bg-white p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold tracking-[.13em] text-[#2b31d8]">DOSSIER 0{i + 1}</span>
              <FileSearch className="size-5 text-[#2b31d8]" />
            </div>
            <h3 className="mt-7 text-2xl font-extrabold tracking-[-.04em]">{entry.label}</h3>
            <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">Fixed-keyword clinical trial and scholarly metadata discovery.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f7f7f4] p-3">
                <p className="text-[11px] text-[var(--muted)]">Registry studies</p>
                <p className="mt-2 text-sm font-extrabold">{entry.trials.unavailable ? "Unavailable" : entry.trials.studies.length + " sampled"}</p>
              </div>
              <div className="rounded-xl bg-[#f7f7f4] p-3">
                <p className="text-[11px] text-[var(--muted)]">Scholarly works</p>
                <p className="mt-2 text-sm font-extrabold">{entry.publications.unavailable ? "Unavailable" : entry.publications.works.length + " sampled"}</p>
              </div>
            </div>
            <Link href={"/intelligence/" + entry.key} className="mt-7 flex items-center justify-between gap-3 border-t border-[#111214]/15 pt-4 text-sm font-extrabold text-[#2b31d8] hover:underline">
              Open evidence dossier <ArrowUpRight className="size-4" />
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-12 overflow-hidden rounded-[18px] border-2 border-[#111214] bg-white">
        <div className="flex items-center gap-2 border-b border-[#111214]/15 px-5 py-4">
          <GitCompareArrows className="size-5 text-[#2b31d8]" />
          <h3 className="font-extrabold">Cross-topic source coverage</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-left text-sm">
            <thead className="bg-[#f7f7f4]">
              <tr><th scope="col" className="p-4">Source observation</th>{dossiers.map(d => <th key={d.key} scope="col" className="p-4">{d.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#111214]/10">
              <tr><th scope="row" className="p-4 font-medium">ClinicalTrials.gov returned sample</th>{dossiers.map(d => <td key={d.key} className="p-4 font-bold">{sampled(d.trials.studies.length, d.trials.unavailable)}</td>)}</tr>
              <tr><th scope="row" className="p-4 font-medium">OpenAlex returned sample</th>{dossiers.map(d => <td key={d.key} className="p-4 font-bold">{sampled(d.publications.works.length, d.publications.unavailable)}</td>)}</tr>
              <tr><th scope="row" className="p-4 font-medium">OpenAlex retraction flags in sample</th>{dossiers.map(d => <td key={d.key} className="p-4 font-bold">{d.publications.unavailable ? "Unknown" : d.publications.works.filter(w => w.retracted).length}</td>)}</tr>
              <tr><th scope="row" className="p-4 font-medium">Interpretation</th>{dossiers.map(d => <td key={d.key} className="p-4 text-xs text-[var(--muted)]">Source discovery only; no safety or efficacy inference</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
        Differences in returned counts do not rank clinical maturity, investment attractiveness,
        product authenticity or the quality of science. Every source has search and coverage limitations.
      </p>
    </section>
  );

  return (
    <section id="dossier" className="mx-auto max-w-[1120px] px-5 pb-20 pt-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#111214]/15 py-5">
        <div className="flex flex-wrap gap-2">
          <SourceStatus label="ClinicalTrials.gov" unavailable={dossier.trials.unavailable} count={dossier.trials.studies.length} />
          <SourceStatus label="OpenAlex" unavailable={dossier.publications.unavailable} count={dossier.publications.works.length} />
        </div>
        <div className="flex flex-wrap gap-2">
          {copyError ? <span role="status" className="self-center text-xs text-[#9e3d11]">Clipboard unavailable. Use Export citations instead.</span> : null}
          <button type="button" onClick={copySources} className="inline-flex items-center gap-2 rounded-full border border-[#111214]/25 bg-white px-4 py-2 text-xs font-extrabold hover:bg-[#f7f7f4]">
            {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            {copied ? "Copied source register" : "Copy source register"}
          </button>
          <button type="button" onClick={downloadSources} className="inline-flex items-center gap-2 rounded-full border border-[#111214] bg-[#111214] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#333]">
            <Download className="size-4" /> Export citations
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="ink-1 rounded-[18px] bg-white p-6">
          <div className="flex items-center gap-3">
            <Radar className="size-5 text-[#2b31d8]" />
            <h2 className="font-extrabold">Clinical trial registry</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Public study records matching this fixed query. Status and phase are registry fields, not measures of benefit.
          </p>
          <div className="mt-4"><SourceStatus unavailable={dossier.trials.unavailable} count={dossier.trials.studies.length} /></div>
          <a href={"https://clinicaltrials.gov/search?term=" + encodeURIComponent(dossier.label)} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#2b31d8] hover:underline">
            Inspect full registry search <ExternalLink className="size-3.5" />
          </a>
        </section>
        <section className="ink-1 rounded-[18px] bg-white p-6">
          <div className="flex items-center gap-3">
            <LibraryBig className="size-5 text-[#2b31d8]" />
            <h2 className="font-extrabold">Scholarly metadata</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            OpenAlex publication records matching the topic; results may include reviews or incidental references.
            The platform does not copy full article text.
          </p>
          <div className="mt-4"><SourceStatus unavailable={dossier.publications.unavailable} count={dossier.publications.works.length} /></div>
          <a href={"https://openalex.org/works?search=" + encodeURIComponent(dossier.label)} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#2b31d8] hover:underline">
            Inspect original source <ExternalLink className="size-3.5" />
          </a>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-[-.045em]">The dated evidence trail</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)]">
            Entries reflect source publication dates or registry update dates, not when a scientific conclusion became established.
            Registry records also show where a compound name or development code was found; a title or intervention mention does not confirm study results.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-bold text-[var(--muted)]"><SlidersHorizontal className="size-4" /> Filter source records</div>
      </div>

      <div className="mt-5 rounded-xl border border-[#111214]/15 bg-white p-4">
        <label htmlFor="record-search" className="block text-sm font-extrabold">Find a study, paper, identifier or registry status</label>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Search within the records returned for this topic. This is not a search of the full literature and nothing is sent to a server.</p>
        <input id="record-search" type="search" value={recordQuery} onChange={event => setRecordQuery(event.target.value)}
          placeholder="e.g. NCT number, phase, sponsor or title" className="mt-3 w-full rounded-lg border border-[#111214]/25 px-4 py-3 text-sm focus:outline-offset-2" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {filterLabels.map(item => (
          <button key={item.value} type="button" aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={filter === item.value
              ? "rounded-full border-2 border-[#111214] bg-[#111214] px-4 py-2 text-xs font-extrabold text-white"
              : "rounded-full border border-[#111214]/20 bg-white px-4 py-2 text-xs font-bold text-[#111214] hover:bg-[#eee]"}>
            {item.label}
          </button>
        ))}
        <label className="ml-auto inline-flex items-center gap-2 text-xs font-bold">
          Order
          <select value={ordering} onChange={event => setOrdering(event.target.value as Ordering)}
            className="rounded-full border border-[#111214]/25 bg-white px-3 py-2 text-xs">
            <option value="newest">Most recent</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      <div className="mt-6 divide-y divide-[#111214]/10 overflow-hidden rounded-[18px] border-2 border-[#111214] bg-white">
        {items.length === 0 ? (
          <div className="px-6 py-12">
            <p className="font-extrabold">No matching records in this view.</p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Clear your search or filters to try again. The source may also be unavailable or this limited sample may contain no matches.
              This does not mean the topic lacks scientific research.
            </p>
          </div>
        ) : items.map((item: EvidenceItem) => (
          <article key={item.id} className="flex gap-4 px-5 py-5 sm:px-7">
            <div className="hidden w-28 shrink-0 pt-1 text-xs font-extrabold text-[var(--muted)] sm:block">
              {dateLabel(item.date)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={item.kind === "trial"
                  ? "rounded-md bg-[#e5e2ff] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#2b31d8]"
                  : "rounded-md bg-[#e9f8ee] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#226342]"}>
                  {item.kind === "trial" ? "Trial registry" : "Scholarly metadata"}
                </span>
                <span className="text-xs text-[var(--muted)] sm:hidden">{dateLabel(item.date)}</span>
                {item.retracted ? <span className="text-xs font-extrabold text-[#9e3d11]">Source flagged retracted</span> : null}
              </div>
              <a className="mt-2 inline-flex items-start gap-1.5 text-sm font-extrabold leading-6 text-[#111214] underline-offset-2 hover:text-[#2b31d8] hover:underline"
                href={item.url} target="_blank" rel="noopener noreferrer">
                {item.title}<ArrowUpRight className="mt-1 size-3.5 shrink-0 text-[#2b31d8]" />
              </a>
              <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{item.details}</p>
              <p className="mt-1 text-[11px] font-medium text-[#555]">Source ID: {item.kind === "trial" ? item.id : item.id.replace("https://openalex.org/", "")}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
        Showing {items.length} of {dossier.trials.studies.length + dossier.publications.works.length} returned records after local filters.
        This sample does not measure the entire literature or all registered trials.
      </p>

      <section className="mt-12 rounded-[18px] border border-[#111214]/20 bg-[#fff9ed] p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-[#a76512]" aria-hidden="true" />
          <h2 className="text-lg font-extrabold">What the sources cannot establish</h2>
        </div>
        <ul className="mt-4 space-y-3 text-sm leading-7 text-[#5d492d]">
          {evidenceCaveats(dossier).map(caveat => (
            <li key={caveat} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-[#a76512]" />
              <span>{caveat}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 text-xs leading-6 text-[var(--muted)]">
        Source discovery is updated through a server-side cache (up to six hours).
        You do not need an account. Topic filters and citation exports are processed on your device,
        without a saved research-interest profile.
      </p>
    </section>
  );
}
