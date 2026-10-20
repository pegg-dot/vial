"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowUpRight, BookOpenCheck, Check, Cpu, FileQuestion, ShieldAlert, Sparkles } from "lucide-react";
import type { DeskAudience, DeskTopicId } from "@/lib/peptide-research-desk";
import type { ResearchAiResult } from "@/lib/research-ai-contract";
import type { ResearchAiAvailability } from "@/server/intelligence/research-ai-config";

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
    <section aria-labelledby="research-ai-title" className="min-w-0 overflow-hidden rounded-[18px] border-2 border-[#17191b] bg-white">
      <div className="bg-[#eae6ff] p-5">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em] text-[#6c50a9]"><Cpu className="size-4" /> Tool-connected AI review</p>
        <h2 id="research-ai-title" className="mt-2 text-lg font-extrabold tracking-[-.035em] text-[#252240]">AI evidence analyst</h2>
        <p className="mt-2 text-xs leading-6 text-[#68617e]">
          Retrieve the pinned evidence record, ask the model for a structured interpretation, then mechanically check its source IDs before showing it.
        </p>
      </div>
      <div className="p-5">
        {aiStatus.enabled && aiPilotToken ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c1e7cd] bg-[#ecfbf0] px-3 py-1.5 text-[11px] font-extrabold text-[#28634a]"><Check className="size-3.5" /> Gateway configured</span>
              <span className="text-[10px] font-semibold text-[#718077]">{aiStatus.model}</span>
            </div>
            <form className="mt-4" onSubmit={analyze}>
              <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-6 text-[#4b6253]">
                <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-[#326e54]" />
                I consent to sending this question and the selected public source records to Vercel AI Gateway and its model provider. It may consume credits. Please don&apos;t enter private research or personal information.
              </label>
              <button type="submit" disabled={!agreed || running}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#30275c] px-4 py-3 text-xs font-extrabold text-white hover:bg-[#463878] disabled:cursor-not-allowed disabled:bg-[#c3bfd2]">
                <Sparkles className="size-4" /> {running ? "Reading evidence and reviewing…" : "Analyze this research question"}
              </button>
            </form>
            <p className="mt-3 text-[11px] leading-5 text-[#7b778a]">Credentials are present; provider access is not proven until a real analysis succeeds. Local pilot: at most 12 runs per process, each limited to four model steps. No saved conversation, automatic follow-up or purchasing.</p>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6d7b6] bg-[#fff8e7] px-3 py-1.5 text-[11px] font-extrabold text-[#896833]">
              <AlertCircle className="size-3.5" /> Model not connected
            </span>
            <p className="mt-3 text-xs leading-6 text-[#66756b]">
              The real AI tool-calling endpoint is installed but disabled. An operator must configure a budget-limited AI Gateway key and explicitly enable the local preview before any model request can run.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-[#7b897d]">No question has been sent to a model. The source dossier, comparisons and downloadable briefings work without AI.</p>
          </>
        )}
      </div>

      {error && <p role="alert" className="mx-5 mb-5 rounded-xl border border-[#e7b9a3] bg-[#fff4ed] p-3 text-xs leading-6 text-[#975331]">{error}</p>}

      {result && (
        <div aria-live="polite" className="border-t-2 border-[#17191b] bg-[#fafcfb] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.12em] text-[#785aaf]">AI draft · human review required</p>
          <p className="mt-2 text-xs font-bold text-[#4e5c51]">{result.scope === "insufficient" ? "Evidence insufficient" : "Limited evidence · provisional interpretation"}</p>
          <p className="mt-3 text-sm leading-7 text-[#2f453a]">{result.modelSummary}</p>
          <div className="mt-5 space-y-4">
            {result.findings.map(finding => (
              <article key={finding.claimId} className="rounded-xl border border-[#dbe5dc] bg-white p-4">
                <h3 className="text-sm font-extrabold leading-6 text-[#2a4436]">{finding.heading}</h3>
                <p className="mt-2 text-xs leading-6 text-[#61746a]"><span className="font-bold">Original editorial observation:</span> {finding.originalObservation}</p>
                <p className="mt-2 border-l-[3px] border-[#aca3d8] bg-[#f7f5ff] px-3 py-2 text-xs leading-6 text-[#5e557c]"><span className="font-bold">AI interpretation (not verified):</span> {finding.aiInterpretation}</p>
                <p className="mt-2 text-[11px] leading-5 text-[#8b7551]">Does not prove: {finding.originalLimit}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {finding.citations.map(source => (
                    <a key={source.id} href={source.url} rel="noopener noreferrer" target="_blank"
                      className="inline-flex items-center gap-1 rounded-lg border border-[#c4e3d0] bg-[#f1faf5] px-2.5 py-1.5 text-[11px] font-bold text-[#2b7156]">
                      {source.identifier} <ArrowUpRight className="size-3" />
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {result.potentialConflicts.length > 0 && (
              <section className="rounded-xl border border-[#e9d5af] bg-[#fff7e9] p-4">
                <h3 className="text-xs font-extrabold text-[#856134]">Unresolved source relationships, not proven contradictions</h3>
                {result.potentialConflicts.map((item, index) => (
                  <p key={item.claimId + index} className="mt-2 text-xs leading-6 text-[#7e6646]">{item.aiNote} <span className="font-bold">Original limit:</span> {item.originalLimit}</p>
                ))}
              </section>
            )}
            {result.gaps.length > 0 && (
              <section className="rounded-xl border border-[#dbdfed] bg-[#f4f5fb] p-4">
                <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-[#51597c]"><FileQuestion className="size-4" /> Still needs verification</h3>
                {result.gaps.map((gap, index) => (
                  <p key={gap.claimId + index} className="mt-2 text-xs leading-6 text-[#636b84]">{gap.aiNote}</p>
                ))}
              </section>
            )}
          </div>
          {result.nextSources.length > 0 && (
            <div className="mt-5">
              <p className="flex items-center gap-2 text-xs font-extrabold text-[#446755]"><BookOpenCheck className="size-4" /> Original records to inspect next</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.nextSources.map(source => (
                  <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#c5e1ce] bg-white px-3 py-2 text-xs font-bold text-[#226d54]">
                    {source.identifier}<ArrowUpRight className="size-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="mt-5 flex items-start gap-2 border-t border-[#e0e7e0] pt-4 text-[11px] leading-6 text-[#7d826f]"><ShieldAlert className="mt-1 size-4 shrink-0" />{result.boundaries[0]} Source snapshot: {result.sourceSnapshot}.</div>
          <p className="mt-1 text-[10px] text-[#8a9390]">{result.evidenceToolCalls} source-file lookup(s) · {result.model} · No saved model history</p>
        </div>
      )}
    </section>
  );
}
