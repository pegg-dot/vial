"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BookOpenCheck, Check, ClipboardCopy, Download,
  FileQuestion, GitBranch, Landmark, Microscope, ShieldAlert,
} from "lucide-react";
import {
  DESK_TOPICS, buildDeskBrief, coverageNote, deskClaims, deskSources, deskSponsors, questionCoverage,
  type DeskAudience, type DeskTopicId,
} from "@/lib/peptide-research-desk";
import { ResearchAiPanel } from "@/components/intelligence/research-ai-panel";
import type { ResearchAiAvailability } from "@/server/intelligence/research-ai-config";
import type { PexEvidenceSource } from "@/lib/pexiganan-evidence-network";

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

const kindNames: Record<PexEvidenceSource["kind"], string> = {
  compound: "Chemical identity",
  registry: "Clinical trial registry",
  "original-experiment": "Original experiment",
  "secondary-review": "Review article",
  "clinical-paper": "Published clinical paper",
};

/**
 * Investigation workbench: choosing a question fills the working panel directly
 * beneath the chooser; each observation carries its own source inspector, so the
 * original record, its limitation and the next check are visible without leaving
 * the finding. Model calls happen only through the explicit opt-in analyst panel.
 */
export function ResearchDesk({ aiStatus, aiPilotToken, initialTopic = "publication-matching" }: {
  aiStatus: ResearchAiAvailability; aiPilotToken: string | null; initialTopic?: DeskTopicId;
}) {
  const [topicId, setTopicId] = useState<DeskTopicId>(initialTopic);
  const [audience, setAudience] = useState<DeskAudience>("researcher");
  const [question, setQuestion] = useState("");
  const [copied, setCopied] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [announce, setAnnounce] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const topic = DESK_TOPICS.find(item => item.id === topicId)!;
  const claims = useMemo(() => deskClaims(topicId), [topicId]);
  const sources = useMemo(() => deskSources(topicId), [topicId]);
  const sponsors = deskSponsors(topicId);
  const coverage = useMemo(() => questionCoverage(topicId, question), [topicId, question]);
  const packet = useMemo(() => buildDeskBrief({ topicId, audience, question }), [topicId, audience, question]);

  // Keep the selected question in the address bar so reload, back and shared links preserve it.
  useEffect(() => {
    try { window.history.replaceState(null, "", "?topic=" + topicId); } catch { /* ignore */ }
  }, [topicId]);

  function chooseTopic(value: DeskTopicId) {
    if (value === topicId) return;
    const next = DESK_TOPICS.find(item => item.id === value)!;
    setTopicId(value);
    setQuestion("");
    setCopied(false);
    setPicked({});
    const nextClaims = deskClaims(value);
    setAnnounce("Showing " + next.label + ": " + nextClaims.length + " observations and " + deskSources(value).length + " original source records.");
    // Bring the result into view only when it is not already on screen (phones).
    const panel = panelRef.current;
    if (panel && panel.getBoundingClientRect().top > window.innerHeight * 0.55) {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panel.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
    }
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
    <div className="space-y-5">
      <section aria-labelledby="desk-first-task">
        <h2 id="desk-first-task" className="text-[11px] font-black uppercase tracking-[.12em] text-[#248373]">1 · Choose what to investigate (Pexiganan)</h2>
        <div role="group" aria-label="Research questions" className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {DESK_TOPICS.map(option => {
            const Icon = topicIcons[option.id];
            const selected = topicId === option.id;
            return (
              <button type="button" key={option.id} onClick={() => chooseTopic(option.id)} aria-pressed={selected}
                className={"flex min-w-0 items-start gap-3 rounded-[14px] border-2 p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b31d8] " +
                  (selected ? "border-[#17191b] bg-[#dffff0] shadow-[3px_3px_0_#17191b]" : "border-[#dae7dc] bg-white hover:border-[#539b79]")}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#17191b]/20 bg-white"><Icon className="size-[18px] text-[#2c7963]" /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-extrabold leading-5 text-[#24372c]">{option.label}{selected && <Check className="size-3.5 text-[#236849]" aria-label="selected" />}</span>
                  <span className="mt-0.5 block text-xs leading-[18px] text-[#65776b]">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      </section>

      <section ref={panelRef} aria-labelledby="desk-evidence-heading" className="scroll-mt-24 min-w-0 overflow-hidden rounded-[20px] border-2 border-[#17191b] bg-white">
        <div className="border-b-2 border-[#17191b] bg-[#f1ecff] px-5 py-5 sm:px-7">
          <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#7364ae]">2 · What the source records show</p>
          <h2 id="desk-evidence-heading" className="mt-2 text-xl font-extrabold leading-tight tracking-[-.035em] text-[#262338] sm:text-2xl">{topic.question}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d6781]">{topic.focus[audience]}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full border border-[#d0cae3] bg-white px-3 py-1.5">{claims.length} observations</span>
            <span className="rounded-full border border-[#d0cae3] bg-white px-3 py-1.5">{sources.length} original source records</span>
            <span className="rounded-full border border-[#d0cae3] bg-white px-3 py-1.5">Editorial snapshot · Oct 19, 2026</span>
          </div>
        </div>

        <div className="divide-y divide-[#e7ebe8]">
          {claims.map(claim => {
            const claimSources = claim.sourceIds.flatMap(id => sources.filter(item => item.id === id));
            const current = claimSources.find(item => item.id === picked[claim.id]) ?? claimSources[0];
            return (
              <article key={claim.id} className="grid gap-5 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <span className={"inline-flex items-center rounded-md border px-2.5 py-1.5 text-[10px] font-extrabold " + statusStyles[claim.status]}>{statusNames[claim.status]}</span>
                  <h3 className="mt-3 text-lg font-extrabold leading-6 text-[#253329]">{claim.heading}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#51665c]">{claim.finding}</p>
                  <div className="mt-4 rounded-xl border border-[#efdfc0] bg-[#fff9ee] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[.1em] text-[#99743b]">What it does not establish</p>
                    <p className="mt-1 text-xs leading-6 text-[#766449]">{claim.whatItDoesNotShow}</p>
                  </div>
                  <p className="mt-4 text-xs leading-6 text-[#607368]"><span className="font-extrabold text-[#2a715a]">Next check · </span>{claim.reviewTask}</p>
                </div>

                <div className="min-w-0 self-start rounded-2xl border-2 border-[#17191b] bg-[#fbfbf8]">
                  <div className="border-b border-[#dedfdb] px-4 pb-3 pt-3.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#247a63]">Original source · {claimSources.length} {claimSources.length === 1 ? "record" : "records"}</p>
                    <div role="group" aria-label={"Source records for: " + claim.heading} className="mt-2 flex flex-wrap gap-1.5">
                      {claimSources.map(item => (
                        <button type="button" key={item.id} aria-pressed={item.id === current?.id}
                          onClick={() => setPicked(state => ({ ...state, [claim.id]: item.id }))}
                          className={"min-h-9 rounded-lg border-2 px-2.5 py-1.5 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-[#2b31d8] " +
                            (item.id === current?.id ? "border-[#2b31d8] bg-[#eef0ff] text-[#2b31d8]" : "border-[#e2e5e3] bg-white text-[#34443b] hover:border-[#aeb3b5]")}>
                          {item.identifier}
                        </button>
                      ))}
                    </div>
                  </div>
                  {current && (
                    <div className="space-y-3 px-4 py-4">
                      <div>
                        <h4 className="text-sm font-extrabold leading-5 text-[#1f2b26]">{current.label}</h4>
                        <p className="mt-0.5 text-[11px] font-semibold text-[#6a716f]">{current.publisher} · {kindNames[current.kind]}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[#2c765a]">Documented observation</p>
                        <p className="mt-1 text-xs leading-6 text-[#414b46]">{current.observation}</p>
                      </div>
                      <div className="rounded-lg border-l-[3px] border-[#c48a41] bg-[#fff6e8] px-3 py-2.5">
                        <p className="text-[10px] font-extrabold text-[#956626]">What this record does not prove</p>
                        <p className="mt-1 text-xs leading-5 text-[#776348]">{current.limitation}</p>
                      </div>
                      <a href={current.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#17191b] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#2b31d8]">
                        Open {current.identifier} at {current.publisher.split(" / ")[0]} <ArrowUpRight className="size-4" />
                      </a>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {sponsors.length > 0 && (
            <div className="px-5 py-6 sm:px-7">
              <h3 className="text-lg font-extrabold leading-6 text-[#253329]">Sponsors named in these registry records</h3>
              <p className="mt-1 text-xs leading-6 text-[#607368]">Attribution comes from each registry&apos;s lead-sponsor field on the snapshot date. It is not current ownership, a deal history or a patent position.</p>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {sponsors.map(org => (
                  <li key={org.name} className="rounded-xl border border-[#dde9df] bg-[#f8fcf9] p-3.5">
                    <p className="text-sm font-extrabold text-[#24372c]">{org.name}</p>
                    <p className="mt-1 text-xs leading-5 text-[#607368]">{org.recordRole}</p>
                    <p className="mt-1.5 text-[11px] font-bold text-[#2b31d8]">{org.nctIds.join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="desk-brief-heading" className="rounded-[20px] border-2 border-[#17191b] bg-[#eafff1] p-5 sm:p-7">
        <div className="flex items-center gap-2 text-[#1f7d60]"><FileQuestion className="size-5" />
          <h2 id="desk-brief-heading" className="text-lg font-extrabold tracking-[-.035em]">3 · Your research brief</h2>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-[#577462]">Export what you have just inspected as a source-linked briefing packet: original links, what each record does not establish, and the remaining checks. No model is called.</p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold text-[#275740]">Your own wording for the brief (optional)</span>
              <textarea value={question} onChange={event => { setQuestion(event.target.value.slice(0, 500)); setCopied(false); }}
                rows={3} maxLength={500} placeholder={topic.question} aria-describedby="desk-question-coverage"
                className="w-full rounded-xl border-2 border-[#cee7d5] bg-white p-3 text-sm text-[#1f3327] outline-none focus:border-[#27825f]" />
            </label>
            <p id="desk-question-coverage" role="status" aria-live="polite"
              className={"mt-2 rounded-lg border px-3 py-2 text-xs leading-5 " + (coverage.state === "pinned"
                ? "border-[#cfe5d6] bg-white text-[#4f6a58]" : "border-[#e7d3a5] bg-[#fff7e3] text-[#7a5f2b]")}>
              <span className="font-extrabold">{coverage.state === "pinned" ? "Fixed evidence. " : "This does not search. "}</span>{coverageNote(coverage)}
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <span id="desk-emphasis" className="text-xs font-extrabold text-[#275740]">Brief emphasis</span>
              <div role="group" aria-labelledby="desk-emphasis" className="flex rounded-xl border-2 border-[#17191b] bg-white p-0.5 text-xs font-extrabold">
                {(["researcher", "analyst"] as const).map(value => (
                  <button type="button" key={value} aria-pressed={audience === value} onClick={() => { setAudience(value); setCopied(false); }}
                    className={"rounded-lg px-3.5 py-2 capitalize " + (audience === value ? "bg-[#17191b] text-white" : "text-[#656b6c] hover:bg-[#f4f6f4]")}>{value}</button>
                ))}
              </div>
            </div>
            <p className="text-[11px] leading-5 text-[#6a826e]">Same records either way. This only changes the one-line emphasis in the panel header and brief.</p>
            <button type="button" onClick={downloadPacket}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17191b] px-4 py-3 text-xs font-extrabold text-white hover:bg-[#323837]">
              <Download className="size-4" /> Download source briefing
            </button>
            <button type="button" onClick={copyPacket}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#17191b] bg-white px-4 py-3 text-xs font-extrabold text-[#17191b] hover:bg-[#f4faf5]">
              {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
              {copied ? "Copied briefing" : "Copy source pack for an AI model"}
            </button>
            <p aria-live="polite" className="text-[11px] leading-5 text-[#6a826e]">A model can help organize your findings, but scientific judgments must be checked against the underlying research.</p>
          </div>
        </div>
      </section>

      {aiStatus.reason !== "not-local" && (
        <ResearchAiPanel key={topicId + ":" + audience + ":" + question}
          topicId={topicId} audience={audience} question={question}
          aiStatus={aiStatus} aiPilotToken={aiPilotToken} />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-[17px] border border-[#e7d8bb] bg-[#fff9ec] p-5">
          <div className="flex items-center gap-2 text-[#926a30]"><ShieldAlert className="size-4" /><h2 className="text-xs font-black uppercase tracking-[.09em]">Deliberate limitations</h2></div>
          <p className="mt-2.5 text-xs leading-6 text-[#826e4c]">Only the curated Pexiganan records are covered; typed wording does not retrieve new evidence. This is not an autonomous biochemist: it does not invent peptides, assess synthesizability, certify safety, check patent freedom to operate, or quote manufacturers.</p>
        </section>
        <nav aria-label="Connected research destinations" className="rounded-[17px] border border-[#dae7de] bg-white p-5">
          <h2 className="text-xs font-black uppercase tracking-[.1em] text-[#5d7469]">Inspect the same compound elsewhere</h2>
          <div className="mt-2.5 grid gap-2 text-xs font-extrabold sm:grid-cols-2">
            <Link href="/intelligence/explore/pexiganan" className="flex items-center justify-between gap-2 rounded-lg bg-[#f4faf5] p-3 text-[#276d58] hover:bg-[#e6f5e9]">Compound dossier <ArrowRight className="size-4" /></Link>
            <Link href="/intelligence/passports/pexiganan" className="flex items-center justify-between gap-2 rounded-lg bg-[#f4faf5] p-3 text-[#276d58] hover:bg-[#e6f5e9]">Full evidence passport <ArrowRight className="size-4" /></Link>
            <Link href="/intelligence/organizations" className="flex items-center justify-between gap-2 rounded-lg bg-[#f4faf5] p-3 text-[#276d58] hover:bg-[#e6f5e9]">Recorded sponsors <ArrowRight className="size-4" /></Link>
            <Link href="/intelligence/materials?subject=pexiganan" className="flex items-center justify-between gap-2 rounded-lg bg-[#f4faf5] p-3 text-[#276d58] hover:bg-[#e6f5e9]">Material evidence <ArrowRight className="size-4" /></Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
