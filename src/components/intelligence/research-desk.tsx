"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BookOpenCheck, Check, ClipboardCopy, Download,
  FileQuestion, GitBranch, Landmark, Microscope, ShieldAlert,
} from "lucide-react";
import {
  DESK_TOPICS, buildDeskBrief, deskClaims, deskSources,
  type DeskAudience, type DeskTopicId,
} from "@/lib/peptide-research-desk";
import { ResearchAiPanel } from "@/components/intelligence/research-ai-panel";
import type { ResearchAiAvailability } from "@/server/intelligence/research-ai-config";

const topicIcons = {
  identity: Microscope,
  "clinical-trials": Landmark,
  "publication-matching": GitBranch,
  organizations: BookOpenCheck,
} as const;

const statusNames = {
  "directly-recorded": "Original source field",
  "cross-source-checked": "Sources connected",
  "needs-interpretation": "Unresolved linkage",
} as const;

const statusStyles = {
  "directly-recorded": "border-[#c1e9d0] bg-[#e7f9ed] text-[#28694f]",
  "cross-source-checked": "border-[#dbd5fd] bg-[#f1efff] text-[#6652a8]",
  "needs-interpretation": "border-[#efdcbe] bg-[#fff7e7] text-[#926727]",
} as const;

/** Source-first desk: model calls only via the explicit opt-in analyst panel. */
export function ResearchDesk({ aiStatus, aiPilotToken }: {
  aiStatus: ResearchAiAvailability; aiPilotToken: string | null;
}) {
  const [topicId, setTopicId] = useState<DeskTopicId>("publication-matching");
  const [audience, setAudience] = useState<DeskAudience>("researcher");
  const [question, setQuestion] = useState("");
  const [copied, setCopied] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  const topic = DESK_TOPICS.find(item => item.id === topicId)!;
  const claims = useMemo(() => deskClaims(topicId), [topicId]);
  const sources = useMemo(() => deskSources(topicId), [topicId]);
  const packet = useMemo(() => buildDeskBrief({ topicId, audience, question }), [topicId, audience, question]);

  function chooseTopic(value: DeskTopicId) {
    setTopicId(value);
    setQuestion("");
    setCopied(false);
    setShowAllSources(false);
  }

  async function copyPacket() {
    try {
      await navigator.clipboard.writeText(packet);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadPacket() {
    const url = URL.createObjectURL(new Blob([packet], { type: "text/markdown;charset=utf-8" }));
    const element = document.createElement("a");
    element.href = url;
    element.download = "vialgrade-pexiganan-" + topicId + "-source-brief.md";
    element.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-7">
      <section aria-labelledby="desk-first-task" className="rounded-[20px] border-2 border-[#17191b] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#248373]">Start with a research question</p>
            <h2 id="desk-first-task" className="mt-2 text-2xl font-extrabold tracking-[-.055em] text-[#17191b]">What would you like to investigate?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66766e]">Choose a real evidence task. Pexiganan is the only fully connected pilot, so we show exactly where the source record ends.</p>
          </div>
          <div className="flex rounded-xl border-2 border-[#17191b] bg-white p-1 text-xs font-extrabold" aria-label="Research perspective">
            <button type="button" aria-pressed={audience === "researcher"} onClick={() => setAudience("researcher")}
              className={"rounded-lg px-4 py-2.5 " + (audience === "researcher" ? "bg-[#17191b] text-white" : "text-[#656b6c] hover:bg-[#f4f6f4]")}>Researcher</button>
            <button type="button" aria-pressed={audience === "analyst"} onClick={() => setAudience("analyst")}
              className={"rounded-lg px-4 py-2.5 " + (audience === "analyst" ? "bg-[#17191b] text-white" : "text-[#656b6c] hover:bg-[#f4f6f4]")}>Analyst</button>
          </div>
        </div>
        <div role="group" aria-label="Research questions" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DESK_TOPICS.map(option => {
            const Icon = topicIcons[option.id];
            const selected = topicId === option.id;
            return (
              <button type="button" key={option.id} onClick={() => chooseTopic(option.id)}
                aria-pressed={selected}
                className={"flex min-h-[165px] min-w-0 flex-col items-start rounded-[15px] border-2 p-4 text-left transition-transform hover:-translate-y-0.5 " +
                  (selected ? "border-[#17191b] bg-[#dffff0] shadow-[3px_4px_0_#17191b]" : "border-[#dae7dc] bg-[#fbfdfb] hover:border-[#539b79]")}>
                <span className="grid size-10 place-items-center rounded-xl border border-[#17191b]/20 bg-white"><Icon className="size-5 text-[#2c7963]" /></span>
                <span className="mt-3 text-sm font-extrabold leading-5 text-[#24372c]">{option.label}</span>
                <span className="mt-1 text-xs leading-5 text-[#65776b]">{option.description}</span>
                {selected && <span className="mt-auto flex items-center gap-1 pt-2 text-[11px] font-extrabold text-[#236849]"><Check className="size-3.5" /> Selected</span>}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="desk-evidence-heading" className="min-w-0 overflow-hidden rounded-[20px] border-2 border-[#17191b] bg-white">
          <div className="border-b-2 border-[#17191b] bg-[#f1ecff] p-5 sm:p-7">
            <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#7364ae]">Source-backed investigation · Pexiganan</p>
            <h2 id="desk-evidence-heading" className="mt-3 text-xl font-extrabold leading-tight tracking-[-.035em] text-[#262338] sm:text-2xl">{topic.question}</h2>
            <p className="mt-3 text-sm leading-6 text-[#6d6781]">{topic.focus[audience]}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-full border border-[#d0cae3] bg-white px-3 py-2">{claims.length} specific observations</span>
              <span className="rounded-full border border-[#d0cae3] bg-white px-3 py-2">{sources.length} original source records</span>
              <span className="rounded-full border border-[#d0cae3] bg-white px-3 py-2">Editorial snapshot · Oct 19, 2026</span>
            </div>
          </div>

          <div className="divide-y divide-[#e7ebe8]">
            {claims.map(claim => (
              <article key={claim.id} className="p-5 sm:p-7">
                <span className={"inline-flex items-center rounded-md border px-2.5 py-1.5 text-[10px] font-extrabold " + statusStyles[claim.status]}>{statusNames[claim.status]}</span>
                <h3 className="mt-3 text-lg font-extrabold leading-6 text-[#253329]">{claim.heading}</h3>
                <p className="mt-2 text-sm leading-7 text-[#51665c]">{claim.finding}</p>
                <div className="mt-4 rounded-xl border border-[#efdfc0] bg-[#fff9ee] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[.1em] text-[#99743b]">What it does not establish</p>
                  <p className="mt-1 text-xs leading-6 text-[#766449]">{claim.whatItDoesNotShow}</p>
                </div>
                <details className="mt-4 rounded-xl border border-[#dce8df] bg-[#f8fcf9] p-4">
                  <summary className="cursor-pointer text-xs font-extrabold text-[#2a715a]">Review original sources and next check ({claim.sourceIds.length})</summary>
                  <p className="mt-3 text-xs leading-6 text-[#607368]">{claim.reviewTask}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {claim.sourceIds.map(id => {
                      const record = sources.find(item => item.id === id);
                      return record && (
                        <a key={id} href={record.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#bddcc6] bg-white px-3 py-2 text-xs font-bold text-[#256957] hover:bg-[#e2f6ea]">
                          {record.identifier} <ArrowUpRight className="size-3.5" />
                        </a>
                      );
                    })}
                  </div>
                </details>
              </article>
            ))}
          </div>

          <div className="border-t border-[#e0e8e1] bg-[#f8fbf9] p-5 sm:p-7">
            <button type="button" onClick={() => setShowAllSources(value => !value)}
              aria-expanded={showAllSources}
              className="flex w-full items-center justify-between gap-3 text-left text-sm font-extrabold text-[#2e674c]">
              <span>Inspect all {sources.length} source records</span><span>{showAllSources ? "Hide" : "Show"}</span>
            </button>
            {showAllSources && (
              <div className="mt-4 space-y-3">
                {sources.map(source => (
                  <div key={source.id} className="rounded-xl border border-[#dde9df] bg-white p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-[.09em] text-[#779084]">{source.kind} · {source.publisher}</p>
                    <a href={source.url} target="_blank" rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-extrabold text-[#267360] underline underline-offset-3">
                      {source.identifier} · {source.label} <ArrowUpRight className="size-3" />
                    </a>
                    <p className="mt-2 text-xs leading-5 text-[#748076]">{source.limitation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <ResearchAiPanel key={topicId + ":" + audience + ":" + question} topicId={topicId} audience={audience} question={question} aiStatus={aiStatus} aiPilotToken={aiPilotToken} />
          <section className="rounded-[18px] border-2 border-[#17191b] bg-[#eafff1] p-5">
            <div className="flex items-center gap-2 text-[#1f7d60]"><FileQuestion className="size-5" /><h2 className="text-lg font-extrabold tracking-[-.035em]">Your research brief</h2></div>
            <p className="mt-3 text-xs leading-6 text-[#577462]">Turn this evidence network into a reusable briefing packet. The packet contains original links, gaps and AI review instructions. No model is called.</p>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-extrabold text-[#275740]">Your own research question (optional)</span>
              <textarea value={question} onChange={event => {setQuestion(event.target.value.slice(0,500));setCopied(false);}}
                rows={4} maxLength={500} placeholder={topic.question}
                className="w-full rounded-xl border-2 border-[#cee7d5] bg-white p-3 text-sm text-[#1f3327] outline-none focus:border-[#27825f]" />
            </label>
            <button type="button" onClick={downloadPacket}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17191b] px-4 py-3 text-xs font-extrabold text-white hover:bg-[#323837]">
              <Download className="size-4" /> Download source briefing
            </button>
            <button type="button" onClick={copyPacket}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#17191b] bg-white px-4 py-3 text-xs font-extrabold text-[#17191b] hover:bg-[#f4faf5]">
              {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
              {copied ? "Copied briefing" : "Copy source pack for an AI model"}
            </button>
            <p aria-live="polite" className="mt-3 text-[11px] leading-5 text-[#6a826e]">A model can help organize your findings, but scientific judgments must be checked against the underlying research.</p>
          </section>
          <section className="rounded-[17px] border border-[#e7d8bb] bg-[#fff9ec] p-5">
            <div className="flex items-center gap-2 text-[#926a30]"><ShieldAlert className="size-4" /><p className="text-xs font-black uppercase tracking-[.09em]">Deliberate limitations</p></div>
            <p className="mt-3 text-xs leading-6 text-[#826e4c]">This is not an autonomous biochemist. It does not invent peptides, assess physical synthesizability, certify safety, verify patent freedom to operate, or generate manufacturer quotes.</p>
            <p className="mt-3 text-xs leading-6 text-[#826e4c]">Only the existing curated Pexiganan records are covered. Source metadata and editorial observations are not an independent biological assessment.</p>
          </section>
          <nav aria-label="Connected research destinations" className="rounded-[17px] border border-[#dae7de] bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[.1em] text-[#5d7469]">Follow the connected record</p>
            <div className="mt-3 grid gap-2 text-xs font-extrabold">
              <Link href="/intelligence/explore/pexiganan" className="flex items-center justify-between gap-2 rounded-lg bg-[#f4faf5] p-3 text-[#276d58] hover:bg-[#e6f5e9]">Compound dossier <ArrowRight className="size-4" /></Link>
              <Link href="/intelligence/passports/pexiganan" className="flex items-center justify-between gap-2 rounded-lg bg-[#f4faf5] p-3 text-[#276d58] hover:bg-[#e6f5e9]">Full evidence passport <ArrowRight className="size-4" /></Link>
              <Link href="/intelligence/organizations" className="flex items-center justify-between gap-2 rounded-lg bg-[#f4faf5] p-3 text-[#276d58] hover:bg-[#e6f5e9]">Recorded sponsors <ArrowRight className="size-4" /></Link>
              <Link href="/intelligence/materials?subject=pexiganan" className="flex items-center justify-between gap-2 rounded-lg bg-[#f4faf5] p-3 text-[#276d58] hover:bg-[#e6f5e9]">Material evidence <ArrowRight className="size-4" /></Link>
            </div>
          </nav>
        </aside>
      </div>
    </div>
  );
}
