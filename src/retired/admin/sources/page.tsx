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
  if (status === "succeeded") return "ink-1 bg-[#e6fbf4] text-[#0e8f80]";
  if (status === "failed") return "ink-1 bg-[#fff1f0] text-[#d3372c]";
  if (status === "running") return "ink-1 bg-[#e9eaff] text-[#2b31d8]";
  return "ink-1 bg-[#f7f7f4] text-[var(--muted)]";
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
      <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Controlled market refresh</p>
      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-[-.055em] sm:text-5xl">Refresh without losing lineage.</h1>
          <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Every fetch is policy-bound, size-limited, content-addressed, diffed against the prior snapshot, and routed through human review. Fixture controls below simulate real source changes without touching an external peptide seller.</p>
        </div>
        <form action={runRefreshSweepAction}><button className="ink hard-sm press inline-flex h-11 items-center gap-2 rounded-full bg-[#111214] px-5 text-sm font-bold text-white"><Sparkles className="size-4" />Run sweep + signals</button></form>
      </div>

      {params.error && <div className="ink-1 mt-6 rounded-[14px] bg-[#fff1f0] px-4 py-3 text-sm font-medium text-[#d3372c]">{decodeURIComponent(params.error)}</div>}
      {(params.ran || params.advanced || params.sweep) && <div className="ink-1 mt-6 rounded-[14px] bg-[#e6fbf4] px-4 py-3 text-sm font-medium text-[#0e8f80]">Refresh operation completed. {params.trace && <Link href={`/admin/traces#${params.trace}`} className="font-bold text-[#2b31d8] underline underline-offset-4">Open the causal trace</Link>}</div>}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, detail }) => <div key={label} className="ink hard rounded-[18px] bg-white p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--muted)]">{label}</p><Icon className="size-4 text-[#2b31d8]" /></div><p className="mt-5 text-4xl font-extrabold tracking-[-.055em] tabular-nums">{value}</p><p className="mt-2 text-xs font-medium text-[var(--muted)]">{detail}</p></div>)}
      </div>

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#2b31d8]">Source policies</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.035em]">Approved refresh perimeter</h2></div><p className="text-xs font-medium text-[var(--muted)]">{policies.length} policies</p></div>
        <div className="grid gap-4 xl:grid-cols-2">
          {policies.map((policy) => {
            const fixtureCanAdvance = policy.transport === "fixture" && (policy.fixtureVersion ?? 0) < (policy.fixtureMaxVersion ?? 0);
            return <article key={policy.id} className="ink hard rounded-[20px] bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`ink-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${policy.enabled ? "bg-[#e6fbf4] text-[#0e8f80]" : "bg-[#f7f7f4] text-[var(--muted)]"}`}>{policy.enabled ? "Enabled" : "Paused"}</span><span className="ink-1 rounded-full bg-[#e9eaff] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#2b31d8]">{policy.transport}</span><span className="ink-1 rounded-full bg-[#f7f7f4] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[var(--muted)]">{policy.parserProfile}</span></div><h3 className="mt-3 text-xl font-extrabold tracking-[-.025em]">{policy.productName}</h3><p className="mt-1 text-sm font-medium text-[var(--muted)]">{policy.vendorName} · {policy.sourceLabel}</p><p className="mt-3 truncate font-mono text-[10px] text-[var(--muted)]">{policy.sourceLocation}</p></div>
                <Link href={`/products/${policy.targetListingSlug}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8]">Public record <ArrowUpRight className="size-3" /></Link>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <Mini label="Next run" value={relative(policy.nextRunAt)} />
                <Mini label="Last success" value={relative(policy.lastSucceededAt)} />
                <Mini label="Failures" value={String(policy.consecutiveFailures)} />
                <Mini label="Fixture" value={policy.transport === "fixture" ? `v${policy.fixtureVersion ?? 0} / v${policy.fixtureMaxVersion ?? 0}` : "Live HTTP"} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t-2 border-[#111214] pt-5">
                <form action={runSourceRefreshAction}><input type="hidden" name="policyId" value={policy.id} /><button className="ink hard-sm press-blue inline-flex h-9 items-center gap-2 rounded-full bg-[#2b31d8] px-4 text-xs font-bold text-white"><RefreshCcw className="size-3.5" />Run current source</button></form>
                {fixtureCanAdvance && session.role === "admin" && <form action={advanceAndRefreshFixtureAction}><input type="hidden" name="policyId" value={policy.id} /><button className="ink-1 hard-sm press inline-flex h-9 items-center gap-2 rounded-full bg-[#e9eaff] px-4 text-xs font-bold text-[#2b31d8]"><Play className="size-3.5" />Advance + trace</button></form>}
                {session.role === "admin" && <form action={toggleSourcePolicyAction}><input type="hidden" name="policyId" value={policy.id} /><input type="hidden" name="enabled" value={String(!policy.enabled)} /><button className="ink-1 hard-sm press inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-xs font-bold">{policy.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{policy.enabled ? "Pause" : "Enable"}</button></form>}
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="ink hard mt-10 rounded-[20px] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#2b31d8]">Durable queue</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.035em]">Recent refresh jobs</h2></div><p className="text-xs font-medium text-[var(--muted)]">{metrics.attempts} attempt receipts</p></div>
        <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b-2 border-[#111214] text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--muted)]"><tr><th className="pb-3">Source</th><th className="pb-3">Trigger</th><th className="pb-3">Status</th><th className="pb-3">Attempts</th><th className="pb-3">Created</th><th className="pb-3">Result</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id} className="border-b border-[#111214]/10 last:border-0"><td className="py-4"><p className="font-bold">{job.sourceLabel}</p><p className="mt-1 font-mono text-[10px] text-[var(--muted)]">{job.id.slice(0, 20)}</p></td><td className="py-4 text-[var(--muted)]">{job.triggerType}</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 font-extrabold ${statusTone(job.status)}`}>{job.status}</span></td><td className="py-4 tabular-nums">{job.attemptCount}/{job.maxAttempts}</td><td className="py-4 text-[var(--muted)]">{relative(job.createdAt)}</td><td className="max-w-[260px] py-4 text-[var(--muted)]">{job.lastError ?? (job.result.rootEventId ? <Link href={`/admin/traces#${job.result.rootEventId}`} className="font-bold text-[#2b31d8]">Open trace →</Link> : "Awaiting result")}</td></tr>)}</tbody></table>{jobs.length === 0 && <p className="py-10 text-center text-sm font-medium text-[var(--muted)]">No refresh jobs yet.</p>}</div>
      </section>

      <div className="ink mt-6 rounded-[20px] bg-[#111214] p-5 text-white sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[12px] border border-white/25 bg-white/10"><ShieldCheck className="size-4 text-[#8fa2ff]" /></span><div><h2 className="font-extrabold">Network boundary</h2><p className="mt-2 text-sm font-medium leading-6 text-white/50">Live HTTP policies require an explicit hostname allowlist. Each redirect is revalidated, private and reserved addresses are blocked, credentials and custom ports are rejected, and response size, content type, and timeout limits are enforced before content reaches an agent.</p></div></div></div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="ink-1 rounded-[12px] bg-[#f7f7f4] p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{label}</p><p className="mt-2 text-xs font-bold">{value}</p></div>; }
