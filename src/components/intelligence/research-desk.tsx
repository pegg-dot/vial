"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpenCheck, Check, ClipboardCopy, Download,
  GitBranch, Landmark, Microscope, ShieldAlert,
} from "lucide-react";
import {
  DESK_TOPICS, buildDeskBrief, coverageNote, deskClaims, deskSources, deskSponsors, questionCoverage,
  type DeskAudience, type DeskTopicId,
} from "@/lib/peptide-research-desk";
import { ResearchAiPanel } from "@/components/intelligence/research-ai-panel";
import { Chip, Frame, Notice, NumberedSection, Pill, Quiet, UI, type Tone } from "@/components/intelligence/research-ui";
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

// Tone says what kind of fact a status is: recorded (mint), connected across sources (blue), unresolved (amber).
const statusTone: Record<keyof typeof statusNames, Tone> = {
  "directly-recorded": "mint",
  "cross-source-checked": "blue",
  "needs-interpretation": "warn",
};

const kindNames: Record<PexEvidenceSource["kind"], string> = {
  compound: "Chemical identity",
  registry: "Clinical trial registry",
  "original-experiment": "Original experiment",
  "secondary-review": "Review article",
  "clinical-paper": "Published clinical paper",
};

const ELSEWHERE = [
  { href: "/intelligence/explore/pexiganan", label: "Compound dossier" },
  { href: "/intelligence/passports/pexiganan", label: "Full evidence passport" },
  { href: "/intelligence/organizations", label: "Recorded sponsors" },
  { href: "/intelligence/materials?subject=pexiganan", label: "Material evidence" },
] as const;

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
  const panelRef = useRef<HTMLDivElement>(null);
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
    <div className="grid gap-4">
      <NumberedSection id="desk-choose" number={1} eyebrow="Investigate" titleId="desk-first-task" title="Choose what to investigate (Pexiganan)"
        intro="Four fixed questions. Each opens the observations and original records pinned to it; nothing is searched or generated.">
        <div role="group" aria-label="Research questions" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DESK_TOPICS.map(option => {
            const Icon = topicIcons[option.id];
            const selected = topicId === option.id;
            return (
              <button type="button" key={option.id} onClick={() => chooseTopic(option.id)} aria-pressed={selected}
                className={"flex min-w-0 items-start gap-3 rounded-[14px] p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b31d8] " +
                  (selected ? "ink hard-sm bg-[#eef0ff]" : "ink-1 bg-white hover:bg-[#eef0ff]")}>
                <span className="ink-1 grid size-9 shrink-0 place-items-center rounded-lg bg-white" aria-hidden="true"><Icon className="size-[18px] text-[#2b31d8]" /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-extrabold leading-5 text-[#111214]">{option.label}{selected && <Check className="size-3.5 text-[#2b31d8]" aria-label="selected" />}</span>
                  <span className="mt-0.5 block text-xs font-medium leading-[18px] text-[var(--muted)]">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      </NumberedSection>

      <div ref={panelRef} className="scroll-mt-36">
        <NumberedSection id="desk-evidence" number={2} eyebrow="What the source records show" titleId="desk-evidence-heading"
          title={topic.question} intro={topic.focus[audience]} flush
          chips={<>
            <Chip>{claims.length} observations</Chip>
            <Chip>{sources.length} original source records</Chip>
            <Chip tone="mint">Editorial snapshot · Oct 19, 2026</Chip>
          </>}>
          <div className="divide-y-2 divide-[#111214]/10">
            {claims.map(claim => {
              const claimSources = claim.sourceIds.flatMap(id => sources.filter(item => item.id === id));
              const current = claimSources.find(item => item.id === picked[claim.id]) ?? claimSources[0];
              return (
                <article key={claim.id} className="grid gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <Chip tone={statusTone[claim.status]}>{statusNames[claim.status]}</Chip>
                    <h3 className={UI.h3 + " mt-3 leading-6"}>{claim.heading}</h3>
                    <p className={UI.bodyInk + " mt-2 leading-7"}>{claim.finding}</p>
                    <Notice tone="warn" title="What it does not establish" className="mt-4">
                      <p className="text-xs leading-6">{claim.whatItDoesNotShow}</p>
                    </Notice>
                    <p className="mt-4 text-xs font-medium leading-6 text-[#4a4d56]"><span className="font-extrabold text-[#2b31d8]">Next check · </span>{claim.reviewTask}</p>
                  </div>

                  <div className="min-w-0 self-start overflow-hidden rounded-[14px] border border-[#111214]/15 bg-[#fbfbf8]">
                    <div className="border-b border-[#111214]/15 px-4 pb-3 pt-3.5">
                      <p className={UI.eyebrowMuted}>Original source · {claimSources.length} {claimSources.length === 1 ? "record" : "records"}</p>
                      <div role="group" aria-label={"Source records for: " + claim.heading} className="mt-2 flex flex-wrap gap-1.5">
                        {claimSources.map(item => (
                          <button type="button" key={item.id} aria-pressed={item.id === current?.id}
                            onClick={() => setPicked(state => ({ ...state, [claim.id]: item.id }))}
                            className={"min-h-9 rounded-full px-3 text-xs font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b31d8] " +
                              (item.id === current?.id ? "ink bg-[#2b31d8] text-white" : "ink-1 bg-white text-[#111214] hover:bg-[#eef0ff]")}>
                            {item.identifier}
                          </button>
                        ))}
                      </div>
                    </div>
                    {current && (
                      <div className="space-y-3 px-4 py-4">
                        <div>
                          <h4 className={UI.h4 + " leading-5"}>{current.label}</h4>
                          <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">{current.publisher} · {kindNames[current.kind]}</p>
                        </div>
                        <div>
                          <p className={UI.eyebrowMuted}>Documented observation</p>
                          <p className="mt-1 text-xs font-medium leading-6 text-[#3a3d46]">{current.observation}</p>
                        </div>
                        <Notice tone="warn" title="What this record does not prove">
                          <p className="text-xs leading-5">{current.limitation}</p>
                        </Notice>
                        <Pill href={current.url} external variant="ink" size="sm" arrow="up">
                          Open {current.identifier} at {current.publisher.split(" / ")[0]}
                        </Pill>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            {sponsors.length > 0 && (
              <div className="px-5 py-6">
                <h3 className={UI.h3 + " leading-6"}>Sponsors named in these registry records</h3>
                <p className="mt-1 text-xs font-medium leading-6 text-[var(--muted)]">Attribution comes from each registry&apos;s lead-sponsor field on the snapshot date. It is not current ownership, a deal history or a patent position.</p>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {sponsors.map(org => (
                    <Quiet as="li" key={org.name}>
                      <p className="text-sm font-extrabold text-[#111214]">{org.name}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{org.recordRole}</p>
                      <p className="mt-1.5 text-[11px] font-bold text-[#2b31d8]">{org.nctIds.join(" · ")}</p>
                    </Quiet>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </NumberedSection>
      </div>

      <NumberedSection id="desk-brief" number={3} eyebrow="Export" titleId="desk-brief-heading" title="Your research brief"
        intro="Export what you have just inspected as a source-linked briefing packet: original links, what each record does not establish, and the remaining checks. No model is called.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold text-[#111214]">Your own wording for the brief (optional)</span>
              <textarea value={question} onChange={event => { setQuestion(event.target.value.slice(0, 500)); setCopied(false); }}
                rows={3} maxLength={500} placeholder={topic.question} aria-describedby="desk-question-coverage" className={UI.field} />
            </label>
            <Notice id="desk-question-coverage" role="status" live="polite" tone={coverage.state === "pinned" ? "white" : "warn"} className="mt-2">
              <p className="text-xs leading-5"><span className="font-extrabold">{coverage.state === "pinned" ? "Fixed evidence. " : "This does not search. "}</span>{coverageNote(coverage)}</p>
            </Notice>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <span id="desk-emphasis" className="text-xs font-extrabold text-[#111214]">Brief emphasis</span>
              <div role="group" aria-labelledby="desk-emphasis" className="ink-1 flex rounded-full bg-white p-0.5 text-xs font-extrabold">
                {(["researcher", "analyst"] as const).map(value => (
                  <button type="button" key={value} aria-pressed={audience === value} onClick={() => { setAudience(value); setCopied(false); }}
                    className={"min-h-8 rounded-full px-3.5 capitalize transition-colors " + (audience === value ? "bg-[#111214] text-white" : "text-[var(--muted)] hover:bg-[#eef0ff]")}>{value}</button>
                ))}
              </div>
            </div>
            <p className="text-[11px] font-medium leading-5 text-[var(--muted)]">Same records either way. This only changes the one-line emphasis in the panel header and brief.</p>
            <Pill variant="ink" icon={Download} onClick={downloadPacket} className="w-full">Download source briefing</Pill>
            <Pill variant="secondary" icon={copied ? Check : ClipboardCopy} onClick={copyPacket} className="w-full">
              {copied ? "Copied briefing" : "Copy source pack for an AI model"}
            </Pill>
            <p aria-live="polite" className="text-[11px] font-medium leading-5 text-[var(--muted)]">A model can help organize your findings, but scientific judgments must be checked against the underlying research.</p>
          </div>
        </div>
      </NumberedSection>

      {aiStatus.reason !== "not-local" && (
        <ResearchAiPanel key={topicId + ":" + audience + ":" + question}
          topicId={topicId} audience={audience} question={question}
          aiStatus={aiStatus} aiPilotToken={aiPilotToken} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Frame as="section" tone="warn" shadow="none" thin radius="rounded-[16px]" ariaLabelledBy="desk-limits">
          <div className="flex items-center gap-2 text-[#9b6b22]"><ShieldAlert className="size-4" aria-hidden="true" /><h2 id="desk-limits" className="text-xs font-black uppercase tracking-[.09em]">Deliberate limitations</h2></div>
          <p className="mt-2.5 text-xs font-medium leading-6 text-[#111214]">Only the curated Pexiganan records are covered; typed wording does not retrieve new evidence. This is not an autonomous biochemist: it does not invent peptides, assess synthesizability, certify safety, check patent freedom to operate, or quote manufacturers.</p>
        </Frame>
        <Frame as="nav" shadow="none" thin radius="rounded-[16px]" ariaLabel="Connected research destinations">
          <h2 className={UI.eyebrowMuted}>Inspect the same compound elsewhere</h2>
          <div className="mt-2.5 grid gap-2 text-xs font-extrabold sm:grid-cols-2">
            {ELSEWHERE.map(item => (
              <Link key={item.href} href={item.href} className="ink-1 flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white px-3 text-[#111214] transition-colors hover:bg-[#eef0ff]">
                {item.label} <ArrowRight className="size-4 text-[#2b31d8]" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </Frame>
      </div>
    </div>
  );
}
