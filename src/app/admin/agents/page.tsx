import type { Metadata } from "next";
import { Gauge, ShieldCheck, FlaskConical, Layers } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { getExtractionControlPlane } from "@/server/agents/control-repository";

export const metadata: Metadata = { title: "Agent control plane" };
export const dynamic = "force-dynamic";

const pct = (v: string | number) => `${(Number(v) * 100).toFixed(1)}%`;
const cents = (v: string | number) => `${Number(v).toFixed(3)}¢`;

export default async function AgentsPage() {
  await requirePermission("admin:manage");
  const cp = await getExtractionControlPlane();
  const baseline = cp.latestBaseline;
  const resolved = cp.selection.resolved;
  const modelState = !cp.selection.clientAvailable ? "Dark — no API key" : cp.modelBeatsBaseline ? "Benchmarked — beats baseline" : cp.latestModelRun ? "Benchmarked — below baseline" : "Available — not yet measured";

  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Governed extraction</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-[-.055em] sm:text-5xl">Agent control plane</h1>
      <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Extraction runs behind one measured seam. A model may assist only after it beats the deterministic baseline on a hand-labeled golden set, and every claim it produces — like every deterministic claim — still passes through the human review gate.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Metric icon={Layers} value={resolved} mono label="Active extractor" />
        <Metric icon={Gauge} value={baseline ? Number(baseline.f1).toFixed(3) : "—"} label="Baseline F1 (deterministic)" />
        <Metric icon={FlaskConical} value={cp.latestModelRun ? Number(cp.latestModelRun.f1).toFixed(3) : "—"} label="Model F1" />
        <Metric icon={ShieldCheck} value={String(cp.shadowCount)} label="Shadow runs logged" />
      </div>

      <section className="ink hard mt-8 overflow-hidden rounded-[20px] bg-white">
        <div className="border-b-2 border-[#111214] p-6">
          <h2 className="text-xl font-extrabold tracking-[-.03em]">Benchmark runs</h2>
          <p className="mt-2 text-xs font-medium text-[var(--muted)]">Every extractor is scored on the same golden dataset. The model is promotable only when its F1 exceeds the baseline at no loss of precision.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#111214]/[.04] text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">
              <tr><th className="px-6 py-4">Extractor</th><th>Precision</th><th>Recall</th><th>F1</th><th>Abstention</th><th>Cost</th><th>Kind</th></tr>
            </thead>
            <tbody className="divide-y divide-[#111214]/10">
              {cp.runs.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-4 font-mono text-xs">{r.extractor_id}</td>
                  <td>{pct(r.precision)}</td>
                  <td>{pct(r.recall)}</td>
                  <td className="font-extrabold">{Number(r.f1).toFixed(3)}</td>
                  <td>{pct(r.abstention_correct_rate)}</td>
                  <td className="font-mono text-xs">{cents(r.total_cost_cents)}</td>
                  <td><span className={`ink-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${r.is_baseline ? "bg-[#f7f7f4] text-[var(--muted)]" : "bg-[#e9eaff] text-[#2b31d8]"}`}>{r.is_baseline ? "baseline" : "model"}</span></td>
                </tr>
              ))}
              {cp.runs.length === 0 && <tr><td className="px-6 py-6 text-xs font-medium text-[var(--muted)]" colSpan={7}>No benchmark runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="ink hard rounded-[20px] bg-white p-6">
          <h2 className="text-xl font-extrabold tracking-[-.03em]">Where the baseline falls short</h2>
          <p className="mt-2 text-xs font-medium text-[var(--muted)]">The hard cases the regex baseline misses are exactly the recall gap a model must close to earn promotion.</p>
          <div className="mt-5 grid gap-2">
            {cp.caseResults.map((c) => {
              const missed = Number(c.false_negatives) > 0 || Number(c.false_positives) > 0;
              return (
                <div key={c.case_name} className="ink-1 flex items-center justify-between rounded-[12px] bg-[#f7f7f4] px-4 py-3">
                  <div>
                    <p className="font-mono text-xs">{c.case_name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{c.difficulty}</p>
                  </div>
                  <span className={`ink-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${missed ? "bg-[#fff4e0] text-[#b26a00]" : "bg-[#e6fbf4] text-[#0e8f80]"}`}>{missed ? `miss (fn ${c.false_negatives}, fp ${c.false_positives})` : c.correct_abstention ? "correct abstention" : "matched"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ink rounded-[20px] bg-[#111214] p-6 text-white">
          <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#8fa2ff]">Ship-gate</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-[-.04em]">The model runs only when it earns it.</h2>
          <div className="mt-5 space-y-3 text-xs leading-5 text-white/70">
            <Row label="Requested mode" value={cp.selection.mode} />
            <Row label="Resolved extractor" value={resolved} />
            <Row label="Model state" value={modelState} />
            <Row label="API key present" value={cp.selection.clientAvailable ? "yes" : "no"} />
            <Row label="Explicitly approved" value={cp.selection.modelApproved ? "yes" : "no"} />
          </div>
          <div className="mt-6 border-t border-white/25 pt-5 text-xs leading-5 text-white/55">
            <p className="font-bold text-white/80">To measure the model</p>
            <p className="mt-2">Set <span className="font-mono text-white/80">ANTHROPIC_API_KEY</span>, run <span className="font-mono text-white/80">npm run extract:smoke</span>, and — only if it beats the baseline — set <span className="font-mono text-white/80">VIAL_MODEL_EXTRACTOR_APPROVED=true</span>. Until then extraction stays deterministic.</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="ink hard rounded-[20px] bg-white p-6">
          <h2 className="text-xl font-extrabold tracking-[-.03em]">Versioned prompts</h2>
          <div className="mt-4 space-y-2">
            {cp.prompts.map((p) => (
              <div key={`${p.prompt_key}-${p.version}`} className="ink-1 flex items-center justify-between rounded-[12px] bg-[#f7f7f4] px-4 py-3">
                <span className="font-mono text-xs">{p.prompt_key} v{p.version}</span>
                <span className={`ink-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${p.status === "active" ? "bg-[#e6fbf4] text-[#0e8f80]" : "bg-[#f7f7f4] text-[var(--muted)]"}`}>{p.status}</span>
              </div>
            ))}
            {cp.prompts.length === 0 && <p className="text-xs font-medium text-[var(--muted)]">No prompt versions yet.</p>}
          </div>
          <h3 className="mt-6 text-sm font-bold">Activation history</h3>
          <div className="mt-3 space-y-2">
            {cp.activations.map((a, i) => (
              <div key={i} className="ink-1 rounded-[12px] bg-[#f7f7f4] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{a.extractor_id}</span>
                  {a.active && <span className="ink-1 rounded-full bg-[#e9eaff] px-2 py-0.5 text-[10px] font-extrabold text-[#2b31d8]">active</span>}
                </div>
                <p className="mt-1 text-[11px] font-medium text-[var(--muted)]">{a.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="ink hard rounded-[20px] bg-white p-6">
          <h2 className="text-xl font-extrabold tracking-[-.03em]">Shadow runs</h2>
          <p className="mt-2 text-xs font-medium text-[var(--muted)]">In shadow mode the model runs alongside the authoritative deterministic extractor. Its output is logged for measurement and never reaches the review queue.</p>
          <div className="mt-5 space-y-2">
            {cp.shadowRuns.map((s) => (
              <div key={s.id} className="ink-1 flex items-center justify-between rounded-[12px] bg-[#f7f7f4] px-4 py-3">
                <span className="font-mono text-xs">{s.model_extractor_version}</span>
                <span className="text-xs font-medium text-[var(--muted)]">agreement {pct(s.agreement_rate)} · {cents(s.cost_cents)}</span>
              </div>
            ))}
            {cp.shadowRuns.length === 0 && <p className="ink-1 mt-3 rounded-[12px] bg-[#f7f7f4] px-4 py-6 text-center text-xs font-medium text-[var(--muted)]">No shadow runs yet — set an API key and run with <span className="font-mono">VIAL_EXTRACTOR=shadow</span> to measure the model against live traffic at zero risk.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, value, label, mono }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string; mono?: boolean }) {
  return <div className="ink hard rounded-[18px] bg-white p-5"><Icon className="size-4 text-[#2b31d8]" /><p className={`mt-5 text-2xl font-extrabold tracking-[-.045em] ${mono ? "font-mono text-xl" : ""}`}>{value}</p><p className="mt-1 text-xs font-medium text-[var(--muted)]">{label}</p></div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-white/45">{label}</span><span className="font-mono text-white/85">{value}</span></div>;
}
