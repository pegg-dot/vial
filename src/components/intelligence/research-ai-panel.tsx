"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, BookOpenCheck, Check, Cpu, FileQuestion, ShieldAlert, Sparkles } from "lucide-react";
import type { DeskAudience, DeskTopicId } from "@/lib/peptide-research-desk";
import type { ResearchAiResult } from "@/lib/research-ai-contract";
import type { ResearchAiAvailability } from "@/server/intelligence/research-ai-config";
import { Chip, Notice, Pill, Quiet, UI } from "@/components/intelligence/research-ui";

export function ResearchAiPanel({
  topicId, audience, question, aiStatus, aiPilotToken,
}: {
  topicId: DeskTopicId;
  audience: DeskAudience;
  question: string;
  aiStatus: ResearchAiAvailability;
  aiPilotToken: string | null;
}) {
  const [agreed, setAgreed] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResearchAiResult | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(0);

  useEffect(() => () => controller.current?.abort(), []);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!aiStatus.enabled || !aiPilotToken || !agreed || running) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const generation = ++latest.current;
    setRunning(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/research/analyst", {
        method: "POST",
        headers: { "content-type": "application/json", "x-vialgrade-research-ai-token": aiPilotToken },
        credentials: "same-origin",
        body: JSON.stringify({ topicId, audience, question, consent: true }),
        signal: current.signal,
      });
      const payload: unknown = await response.json();
      if (generation !== latest.current) return;
      if (!response.ok) {
        const parsed = payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error?: unknown }).error)
          : "The model could not complete this review.";
        setError(response.status === 401 ? "The local analysis token expired. Reload the Research Desk and try again." : parsed);
        return;
      }
      const value = payload as ResearchAiResult;
      if (value.kind !== "model-proposed-not-expert-reviewed" || value.topicId !== topicId || !Array.isArray(value.findings)) {
        setError("The model response did not match the selected source file.");
        return;
      }
      setResult(value);
    } catch (err) {
      if (!current.signal.aborted && generation === latest.current) {
        setError(err instanceof Error && err.name === "AbortError"
          ? "Analysis stopped."
          : "The model connection failed. Your original source notes remain available.");
      }
    } finally {
      if (generation === latest.current) setRunning(false);
    }
  }

  return (
    <section aria-labelledby="research-ai-title" className="ink hard-sm min-w-0 overflow-hidden rounded-[16px] bg-white">
      <div className="border-b-2 border-[#111214] bg-[#f0edff] px-5 py-4">
        <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[.16em] text-[#5a4be0]"><Cpu className="size-4" aria-hidden="true" /> Tool-connected AI review</p>
        <h2 id="research-ai-title" className="mt-1 text-[clamp(1.125rem,1.6vw,1.375rem)] font-extrabold leading-[1.15] tracking-[-.03em] text-[#111214]">AI evidence analyst</h2>
        <p className="mt-1 max-w-3xl text-[13px] font-medium leading-5 text-[#4a4d56]">
          Retrieve the pinned evidence record, ask the model for a structured interpretation, then mechanically check its source IDs before showing it.
        </p>
      </div>
      <div className="px-5 py-4">
        {aiStatus.enabled && aiPilotToken ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="mint" icon={Check}>Gateway configured</Chip>
              <span className="text-[10px] font-semibold text-[var(--muted)]">{aiStatus.model}</span>
            </div>
            <form className="mt-4" onSubmit={analyze}>
              <label className="flex cursor-pointer items-start gap-2.5 text-xs font-medium leading-6 text-[#3a3d46]">
                <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-[#2b31d8]" />
                I consent to sending this question and the selected public source records to Vercel AI Gateway and its model provider. It may consume credits. Please don&apos;t enter private research or personal information.
              </label>
              <Pill type="submit" variant="primary" icon={Sparkles} disabled={!agreed || running} className="mt-4 w-full">
                {running ? "Reading evidence and reviewing…" : "Analyze this research question"}
              </Pill>
            </form>
            <p className="mt-3 text-[11px] font-medium leading-5 text-[var(--muted)]">Credentials are present; provider access is not proven until a real analysis succeeds. Local pilot: at most 12 runs per process, each limited to four model steps. No saved conversation, automatic follow-up or purchasing.</p>
          </>
        ) : (
          <>
            <Chip tone="warn" icon={AlertCircle}>Model not connected</Chip>
            <p className="mt-3 text-xs font-medium leading-6 text-[#3a3d46]">
              The real AI tool-calling endpoint is installed but disabled. An operator must configure a budget-limited AI Gateway key and explicitly enable the local preview before any model request can run.
            </p>
            <p className="mt-2 text-[11px] font-medium leading-5 text-[var(--muted)]">No question has been sent to a model. The source dossier, comparisons and downloadable briefings work without AI.</p>
          </>
        )}
      </div>

      {error && <Notice tone="danger" role="alert" icon={AlertCircle} className="mx-5 mb-5"><p className="text-xs leading-6">{error}</p></Notice>}

      {result && (
        <div aria-live="polite" className="border-t-2 border-[#111214] bg-[var(--background)] px-5 py-5">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[.16em] text-[#5a4be0]">AI draft · human review required</p>
          <p className="mt-2 text-xs font-bold text-[#111214]">{result.scope === "insufficient" ? "Evidence insufficient" : "Limited evidence · provisional interpretation"}</p>
          <p className={UI.bodyInk + " mt-3 leading-7"}>{result.modelSummary}</p>
          <div className="mt-5 space-y-4">
            {result.findings.map(finding => (
              <Quiet as="article" key={finding.claimId} className="bg-white">
                <h3 className="text-sm font-extrabold leading-6 text-[#111214]">{finding.heading}</h3>
                <p className="mt-2 text-xs font-medium leading-6 text-[#3a3d46]"><span className="font-bold">Original editorial observation:</span> {finding.originalObservation}</p>
                <p className="mt-2 border-l-[3px] border-[#6d5dfc] bg-[#f0edff] px-3 py-2 text-xs font-medium leading-6 text-[#3a3d46]"><span className="font-bold">AI interpretation (not verified):</span> {finding.aiInterpretation}</p>
                <p className="mt-2 text-[11px] font-medium leading-5 text-[#9b6b22]">Does not prove: {finding.originalLimit}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {finding.citations.map(source => (
                    <Pill key={source.id} href={source.url} external variant="ghost" size="sm" arrow="up">{source.identifier}</Pill>
                  ))}
                </div>
              </Quiet>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {result.potentialConflicts.length > 0 && (
              <Notice tone="warn" title={<h3 className="text-xs font-extrabold">Unresolved source relationships, not proven contradictions</h3>}>
                {result.potentialConflicts.map((item, index) => (
                  <p key={item.claimId + index} className="mt-2 text-xs leading-6">{item.aiNote} <span className="font-bold">Original limit:</span> {item.originalLimit}</p>
                ))}
              </Notice>
            )}
            {result.gaps.length > 0 && (
              <Notice tone="blue" icon={FileQuestion} title={<h3 className="text-xs font-extrabold">Still needs verification</h3>}>
                {result.gaps.map((gap, index) => (
                  <p key={gap.claimId + index} className="mt-2 text-xs leading-6">{gap.aiNote}</p>
                ))}
              </Notice>
            )}
          </div>
          {result.nextSources.length > 0 && (
            <div className="mt-5">
              <p className="flex items-center gap-2 text-xs font-extrabold text-[#111214]"><BookOpenCheck className="size-4 text-[#2b31d8]" aria-hidden="true" /> Original records to inspect next</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.nextSources.map(source => (
                  <Pill key={source.id} href={source.url} external variant="secondary" size="sm" arrow="up">{source.identifier}</Pill>
                ))}
              </div>
            </div>
          )}
          <div className="mt-5 flex items-start gap-2 border-t border-[#111214]/15 pt-4 text-[11px] font-medium leading-6 text-[var(--muted)]"><ShieldAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />{result.boundaries[0]} Source snapshot: {result.sourceSnapshot}.</div>
          <p className="mt-1 text-[10px] font-medium text-[var(--muted)]">{result.evidenceToolCalls} source-file lookup(s) · {result.model} · No saved model history</p>
        </div>
      )}
    </section>
  );
}
