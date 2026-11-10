"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, ClipboardCopy, Download, ExternalLink, LibraryBig, Radar } from "lucide-react";
import type { ResearchDossier } from "@/server/intelligence/public-dossiers";
import { citationPack, evidenceCaveats, evidenceItems, filterByRegistryMatch, type EvidenceItem, type RegistryMatchFilter } from "@/lib/research-evidence";
import { Chip, Notice, NumberedSection, Pill, Quiet, UI } from "@/components/intelligence/research-ui";

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
  return <Chip tone={unavailable ? "warn" : "paper"}>{label ? label + ": " : ""}{sampled(count, unavailable)}</Chip>;
}

/**
 * The topic dossier body: the two source systems, the dated trail with its local filters, and the
 * limits. Filters, ordering and the citation export all run in the browser; nothing is sent anywhere.
 */
export function ResearchWorkspace({ dossiers, selectedTopic }: {
  dossiers: ResearchDossier[];
  selectedTopic?: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [ordering, setOrdering] = useState<Ordering>("newest");
  const [recordQuery, setRecordQuery] = useState("");
  const [registryMatchFilter, setRegistryMatchFilter] = useState<RegistryMatchFilter>("all");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const dossier = selectedTopic ? dossiers.find(d => d.key === selectedTopic) : null;

  const items = useMemo(() => {
    if (!dossier) return [];
    const all = evidenceItems(dossier);
    const query = recordQuery.trim().toLocaleLowerCase();
    const matching = filterByRegistryMatch(all, registryMatchFilter).filter(item => (filter === "all" || item.kind === filter) &&
      (!query || [item.title, item.id, item.details].some(value => value.toLocaleLowerCase().includes(query))));
    return ordering === "newest" ? matching : [...matching].reverse();
  }, [dossier, filter, ordering, recordQuery, registryMatchFilter]);

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

  // Every route that renders this passes a selected topic; there is no index view.
  if (!dossier) return null;

  return (
    <div id="dossier" className="grid scroll-mt-32 gap-4">
      <NumberedSection id="dossier-sources" number={1} eyebrow="Sources" title="Two public source systems, one fixed query"
        intro="ClinicalTrials.gov and OpenAlex are each asked the same fixed topic query. A count is what the sample returned on the cache date, not a total."
        chips={<>
          <SourceStatus label="ClinicalTrials.gov" unavailable={dossier.trials.unavailable} count={dossier.trials.studies.length} />
          <SourceStatus label="OpenAlex" unavailable={dossier.publications.unavailable} count={dossier.publications.works.length} />
        </>}
        actions={<>
          {copyError ? <p role="status" className="text-xs font-bold text-[#ce403b]">Clipboard unavailable. Use Export citations instead.</p> : null}
          <Pill variant="secondary" size="sm" icon={copied ? Check : ClipboardCopy} onClick={copySources}>
            {copied ? "Copied source register" : "Copy source register"}
          </Pill>
          <Pill variant="ink" size="sm" icon={Download} onClick={downloadSources}>Export citations</Pill>
        </>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Quiet>
            <div className="flex items-center gap-2">
              <Radar className="size-5 text-[#2b31d8]" aria-hidden="true" />
              <h3 className={UI.h4}>Clinical trial registry</h3>
            </div>
            <p className={UI.body + " mt-2"}>Public study records matching this fixed query. Status and phase are registry fields, not measures of benefit.</p>
            <div className="mt-3"><SourceStatus unavailable={dossier.trials.unavailable} count={dossier.trials.studies.length} /></div>
            <a href={"https://clinicaltrials.gov/search?term=" + encodeURIComponent(dossier.label)} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " mt-3"}>
              Inspect full registry search <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Quiet>
          <Quiet>
            <div className="flex items-center gap-2">
              <LibraryBig className="size-5 text-[#2b31d8]" aria-hidden="true" />
              <h3 className={UI.h4}>Scholarly metadata</h3>
            </div>
            <p className={UI.body + " mt-2"}>
              OpenAlex publication records matching the topic; results may include reviews or incidental references.
              The platform does not copy full article text.
            </p>
            <div className="mt-3"><SourceStatus unavailable={dossier.publications.unavailable} count={dossier.publications.works.length} /></div>
            <a href={"https://openalex.org/works?search=" + encodeURIComponent(dossier.label)} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " mt-3"}>
              Inspect original source <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Quiet>
        </div>
      </NumberedSection>

      <NumberedSection id="dossier-trail" number={2} eyebrow="Evidence trail" title="The dated evidence trail" flush
        intro="Entries reflect source publication dates or registry update dates, not when a scientific conclusion became established. Registry records also show where a compound name or development code was found; a title or intervention mention does not confirm study results.">
        <div className="grid gap-4 border-b-2 border-[#111214]/10 bg-[#fbfbf8] px-5 py-4">
          <div>
            <label htmlFor="record-search" className="block text-xs font-extrabold text-[#111214]">Find a study, paper, identifier or registry status</label>
            <p className={UI.small + " mt-1"}>Search within the records returned for this topic. This is not a search of the full literature and nothing is sent to a server.</p>
            <input id="record-search" type="search" value={recordQuery} onChange={event => setRecordQuery(event.target.value)}
              placeholder="e.g. NCT number, phase, sponsor or title" className={UI.field + " mt-2"} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="registry-match-filter" className="block text-xs font-extrabold text-[#111214]">Trial name appears in</label>
              <select id="registry-match-filter" value={registryMatchFilter}
                onChange={event => {
                  const next = event.target.value as RegistryMatchFilter;
                  setRegistryMatchFilter(next);
                  if (next !== "all") setFilter("trial");
                }}
                className={UI.field + " mt-2"}>
                <option value="all">Any field (all trial matches)</option>
                <option value="intervention-recorded">Registered intervention field</option>
                <option value="named-in-title">Study title only</option>
                <option value="search-hit-only">Keyword match; role unconfirmed</option>
              </select>
              <p className={UI.small + " mt-1.5"}>
                These are match locations within the returned sample, not evidence quality ratings. Some combination studies may need manual review.
              </p>
            </div>
            <div>
              <label htmlFor="record-order" className="block text-xs font-extrabold text-[#111214]">Order</label>
              <select id="record-order" value={ordering} onChange={event => setOrdering(event.target.value as Ordering)} className={UI.field + " mt-2"}>
                <option value="newest">Most recent</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
          <div role="group" aria-label="Source type" className="flex flex-wrap items-center gap-2">
            {filterLabels.map(item => (
              <button key={item.value} type="button" aria-pressed={filter === item.value}
                onClick={() => { setFilter(item.value); if (item.value !== "trial") setRegistryMatchFilter("all"); }}
                className={"min-h-9 rounded-full px-4 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b31d8] " +
                  (filter === item.value ? "ink bg-[#111214] text-white" : "ink-1 bg-white text-[#111214] hover:bg-[#eef0ff]")}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-[#111214]/10">
          {items.length === 0 ? (
            <div className="px-5 py-10">
              <p className="text-sm font-extrabold text-[#111214]">No matching records in this view.</p>
              <p className={UI.body + " mt-2"}>
                Clear your search or filters to try again. The source may also be unavailable or this limited sample may contain no matches.
                This does not mean the topic lacks scientific research.
              </p>
            </div>
          ) : items.map((item: EvidenceItem) => (
            <article key={item.id} className="grid gap-3 px-5 py-5 sm:grid-cols-[112px_minmax(0,1fr)]">
              <p className="hidden pt-1 text-xs font-extrabold text-[var(--muted)] sm:block">{dateLabel(item.date)}</p>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={item.kind === "trial" ? "blue" : "mint"}>{item.kind === "trial" ? "Trial registry" : "Scholarly metadata"}</Chip>
                  <span className="text-xs font-bold text-[var(--muted)] sm:hidden">{dateLabel(item.date)}</span>
                  {item.retracted ? <Chip tone="danger">Source flagged retracted</Chip> : null}
                </div>
                <a className="mt-2 inline-flex min-h-6 items-start gap-1.5 break-words text-sm font-extrabold leading-6 text-[#111214] hover:text-[#2b31d8] hover:underline"
                  href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}<ArrowUpRight className="mt-1 size-3.5 shrink-0 text-[#2b31d8]" aria-hidden="true" />
                </a>
                <p className={UI.small + " mt-2"}>{item.details}</p>
                <p className="mt-1 break-all text-[11px] font-medium text-[#4a4d56]">Source ID: {item.kind === "trial" ? item.id : item.id.replace("https://openalex.org/", "")}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="border-t border-[#111214]/15 px-5 py-3 text-[11px] font-medium leading-5 text-[var(--muted)]">
          Showing {items.length} of {dossier.trials.studies.length + dossier.publications.works.length} returned records after local filters.
          This sample does not measure the entire literature or all registered trials.
        </p>
      </NumberedSection>

      <NumberedSection id="dossier-limits" number={3} eyebrow="Limits" title="What the sources cannot establish">
        <Notice tone="warn" icon={AlertTriangle}>
          <ul className="list-disc space-y-2 pl-5 text-xs leading-6">
            {evidenceCaveats(dossier).map(caveat => <li key={caveat}>{caveat}</li>)}
          </ul>
        </Notice>
        <p className={UI.small}>
          Source discovery is updated through a server-side cache (up to six hours).
          You do not need an account. Topic filters and citation exports are processed on your device,
          without a saved research-interest profile.
        </p>
      </NumberedSection>
    </div>
  );
}
