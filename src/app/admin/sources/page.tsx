import type { Metadata } from "next";
import {
  Activity,
  ArrowUpRight,
  CircleAlert,
  Clock3,
  DatabaseZap,
  Pause,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  advanceAndRefreshFixtureAction,
  runRefreshSweepAction,
  runSourceRefreshAction,
  toggleSourcePolicyAction,
} from "../operations-actions";
import { requireStaff } from "@/server/auth/session";
import { getRefreshJobs, getRefreshMetrics, getRefreshPolicies } from "@/server/refresh/repository";

export const metadata: Metadata = { title: "Source refresh" };
export const dynamic = "force-dynamic";

function relative(value?: string) {
  if (!value) return "Never";
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 1) return "now";
  if (minutes > 0) return `in ${minutes}m`;
  if (minutes > -60) return `${Math.abs(minutes)}m ago`;
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusTone(status: string) {
  if (status === "succeeded") return "bg-emerald-50 text-emerald-800";
  if (status === "failed") return "bg-rose-50 text-rose-800";
  if (status === "running") return "bg-violet-50 text-violet-800";
  return "bg-black/[.05] text-black/60";
}

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireStaff();
  const [policies, jobs, metrics, params] = await Promise.all([getRefreshPolicies(), getRefreshJobs(40), getRefreshMetrics(), searchParams]);
  const cards = [
    { label: "Enabled", value: metrics.enabled, icon: Activity, detail: "Controlled source policies" },
    { label: "Due now", value: metrics.due, icon: Clock3, detail: "Ready for scheduler pickup" },
    { label: "In queue", value: metrics.queued, icon: RefreshCcw, detail: "Queued, retrying, or running" },
    { label: "Failed", value: metrics.failed, icon: CircleAlert, detail: "Terminal job failures" },
    { label: "Stale", value: metrics.stale, icon: DatabaseZap, detail: "No success in 24 hours" },
  ];
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Controlled market refresh</p>
      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Refresh without losing lineage.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">Every fetch is policy-bound, size-limited, content-addressed, diffed against the prior snapshot, and routed through human review. Fixture controls below simulate real source changes without touching an external peptide seller.</p>
        </div>
        <form action={runRefreshSweepAction}><button className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111214] px-5 text-sm font-semibold text-white"><Sparkles className="size-4" />Run sweep + signals</button></form>
      </div>

      {params.error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{decodeURIComponent(params.error)}</div>}
      {(params.ran || params.advanced || params.sweep) && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Refresh operation completed. {params.trace && <Link href={`/admin/traces#${params.trace}`} className="font-semibold underline underline-offset-4">Open the causal trace</Link>}</div>}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, detail }) => <div key={label} className="rounded-[22px] border border-black/[.07] bg-white p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--muted)]">{label}</p><Icon className="size-4 text-black/35" /></div><p className="mt-5 text-4xl font-semibold tracking-[-.055em] tabular-nums">{value}</p><p className="mt-2 text-xs text-[var(--muted)]">{detail}</p></div>)}
      </div>

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--muted)]">Source policies</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">Approved refresh perimeter</h2></div><p className="text-xs text-[var(--muted)]">{policies.length} policies</p></div>
        <div className="grid gap-4 xl:grid-cols-2">
          {policies.map((policy) => {
            const fixtureCanAdvance = policy.transport === "fixture" && (policy.fixtureVersion ?? 0) < (policy.fixtureMaxVersion ?? 0);
            return <article key={policy.id} className="rounded-[28px] border border-black/[.07] bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${policy.enabled ? "bg-emerald-50 text-emerald-800" : "bg-black/[.05] text-black/45"}`}>{policy.enabled ? "Enabled" : "Paused"}</span><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-violet-800">{policy.transport}</span><span className="rounded-full bg-black/[.04] px-2.5 py-1 text-[10px] font-semibold uppercase text-black/50">{policy.parserProfile}</span></div><h3 className="mt-3 text-xl font-semibold tracking-[-.025em]">{policy.productName}</h3><p className="mt-1 text-sm text-[var(--muted)]">{policy.vendorName} · {policy.sourceLabel}</p><p className="mt-3 truncate font-mono text-[10px] text-black/40">{policy.sourceLocation}</p></div>
                <Link href={`/products/${policy.targetListingSlug}`} className="inline-flex items-center gap-1 text-xs font-semibold">Public record <ArrowUpRight className="size-3" /></Link>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <Mini label="Next run" value={relative(policy.nextRunAt)} />
                <Mini label="Last success" value={relative(policy.lastSucceededAt)} />
                <Mini label="Failures" value={String(policy.consecutiveFailures)} />
                <Mini label="Fixture" value={policy.transport === "fixture" ? `v${policy.fixtureVersion ?? 0} / v${policy.fixtureMaxVersion ?? 0}` : "Live HTTP"} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-black/[.06] pt-5">
                <form action={runSourceRefreshAction}><input type="hidden" name="policyId" value={policy.id} /><button className="inline-flex h-9 items-center gap-2 rounded-full bg-black px-4 text-xs font-semibold text-white"><RefreshCcw className="size-3.5" />Run current source</button></form>
                {fixtureCanAdvance && session.role === "admin" && <form action={advanceAndRefreshFixtureAction}><input type="hidden" name="policyId" value={policy.id} /><button className="inline-flex h-9 items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 text-xs font-semibold text-violet-800"><Play className="size-3.5" />Advance + trace</button></form>}
                {session.role === "admin" && <form action={toggleSourcePolicyAction}><input type="hidden" name="policyId" value={policy.id} /><input type="hidden" name="enabled" value={String(!policy.enabled)} /><button className="inline-flex h-9 items-center gap-2 rounded-full border border-black/[.08] bg-white px-4 text-xs font-semibold">{policy.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{policy.enabled ? "Pause" : "Enable"}</button></form>}
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="mt-10 rounded-[28px] border border-black/[.07] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--muted)]">Durable queue</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">Recent refresh jobs</h2></div><p className="text-xs text-[var(--muted)]">{metrics.attempts} attempt receipts</p></div>
        <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-black/[.07] text-[10px] uppercase tracking-[.14em] text-[var(--muted)]"><tr><th className="pb-3">Source</th><th className="pb-3">Trigger</th><th className="pb-3">Status</th><th className="pb-3">Attempts</th><th className="pb-3">Created</th><th className="pb-3">Result</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id} className="border-b border-black/[.05] last:border-0"><td className="py-4"><p className="font-semibold">{job.sourceLabel}</p><p className="mt-1 font-mono text-[10px] text-black/40">{job.id.slice(0, 20)}</p></td><td className="py-4 text-[var(--muted)]">{job.triggerType}</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 font-semibold ${statusTone(job.status)}`}>{job.status}</span></td><td className="py-4 tabular-nums">{job.attemptCount}/{job.maxAttempts}</td><td className="py-4 text-[var(--muted)]">{relative(job.createdAt)}</td><td className="max-w-[260px] py-4 text-[var(--muted)]">{job.lastError ?? (job.result.rootEventId ? <Link href={`/admin/traces#${job.result.rootEventId}`} className="font-semibold text-black">Open trace →</Link> : "Awaiting result")}</td></tr>)}</tbody></table>{jobs.length === 0 && <p className="py-10 text-center text-sm text-[var(--muted)]">No refresh jobs yet.</p>}</div>
      </section>

      <div className="mt-6 rounded-[24px] bg-[#111214] p-5 text-white sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10"><ShieldCheck className="size-4 text-emerald-300" /></span><div><h2 className="font-semibold">Network boundary</h2><p className="mt-2 text-sm leading-6 text-white/50">Live HTTP policies require an explicit hostname allowlist. Each redirect is revalidated, private and reserved addresses are blocked, credentials and custom ports are rejected, and response size, content type, and timeout limits are enforced before content reaches an agent.</p></div></div></div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[var(--background)] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">{label}</p><p className="mt-2 text-xs font-semibold">{value}</p></div>; }
