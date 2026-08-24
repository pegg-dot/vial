import Link from "next/link";
import { requireStaff } from "@/server/auth/session";
import { getRefreshPolicies, getRefreshMetrics } from "@/server/refresh/repository";
import { advanceAndTraceAction } from "../provenance-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sources" };

// Where a source is watched, and where a change to one is deliberately triggered.
//
// The point of the whole pipeline is that nothing arrives from nowhere. Every policy here names a
// source, the listing it speaks for, the transport it is read over, and when it was last read. A
// controlled fixture is a source whose versions we own, which is how the cascade can be exercised
// end to end without waiting on somebody else's website to change.
//
// "Advance + trace" moves that fixture to its next version and runs the refresh in one step, under
// a single root event, so what follows — snapshot, diff, proposed claims, publication — is one
// traceable chain rather than a pile of coincidences.

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ refreshed?: string; claims?: string; status?: string; error?: string }> }) {
  await requireStaff();
  const { refreshed, claims, status, error } = await searchParams;
  const [policies, metrics] = await Promise.all([getRefreshPolicies(), getRefreshMetrics()]);

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2b31d8]">Provenance</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Refresh without losing lineage.</h1>
      <p className="mt-4 max-w-[64ch] text-[15px] leading-7 text-[var(--muted)]">
        Each policy watches one source on behalf of one listing. Re-reading it captures a new snapshot and
        diffs it against the last, so a value that changes can always be traced to the version of the source
        that changed it — never to &ldquo;the data was updated&rdquo;.
      </p>

      {error ? (
        <p role="alert" className="ink-1 mt-6 rounded-[12px] bg-[#ffecea] px-4 py-3 text-sm font-semibold text-[#d3372c]">{error}</p>
      ) : null}

      {refreshed ? (
        <p className="ink-1 mt-6 rounded-[12px] bg-[#e6fbf4] px-4 py-3 text-sm font-semibold text-[#0e8f80]">
          Refresh operation completed{status === "not-modified"
            ? " — the source was unchanged, so nothing was proposed."
            : ` — ${claims ?? 0} claim${claims === "1" ? "" : "s"} proposed. `}
          {status !== "not-modified" ? <Link href="/admin/review" className="font-extrabold underline">Review them</Link> : null}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <span className="ink-1 rounded-full bg-white px-3 py-1.5 font-semibold">{policies.length} policies</span>
        <span className="ink-1 rounded-full bg-white px-3 py-1.5 font-semibold">{metrics.enabled} watching</span>
        <span className="ink-1 rounded-full bg-white px-3 py-1.5 font-semibold">{metrics.due} due</span>
        <span className="ink-1 rounded-full bg-white px-3 py-1.5 font-semibold">{metrics.attempts} attempts</span>
        {metrics.failed > 0 ? <span className="ink-1 rounded-full bg-[#ffecea] px-3 py-1.5 font-semibold text-[#d3372c]">{metrics.failed} failed</span> : null}
        {metrics.stale > 0 ? <span className="ink-1 rounded-full bg-[#fff3e0] px-3 py-1.5 font-semibold text-[#b26a00]">{metrics.stale} stale</span> : null}
      </div>

      <div className="mt-6 grid gap-5">
        {policies.length === 0 ? (
          <div className="ink hard rounded-[18px] bg-white p-8">
            <p className="text-lg font-extrabold">No sources are being watched.</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">A refresh policy binds a source to the listing it speaks for. Without one, nothing is re-read on a schedule.</p>
          </div>
        ) : policies.map((policy) => {
          const atLatest = policy.fixtureMaxVersion != null && policy.fixtureVersion != null && policy.fixtureVersion >= policy.fixtureMaxVersion;
          const controlled = policy.transport === "fixture";
          return (
            <article key={policy.id} data-policy-id={policy.id} className="ink hard rounded-[18px] bg-white p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold tracking-[-.02em]">{policy.vendorName} — {policy.productName}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{policy.sourceLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ink-1 rounded-full bg-[#f7f7f4] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{policy.transport}</span>
                  <span className={`ink-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${policy.enabled ? "bg-[#e6fbf4] text-[#0e8f80]" : "bg-[#f7f7f4] text-[var(--muted)]"}`}>
                    {policy.enabled ? "watching" : "paused"}
                  </span>
                </div>
              </div>

              <p className="mt-3 break-all font-mono text-xs text-[var(--muted)]">{policy.sourceLocation}</p>

              <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-3">
                <div><dt className="font-bold uppercase tracking-wide text-[var(--muted)]">Last read</dt><dd className="mt-0.5 font-semibold tabular-nums">{when(policy.lastSucceededAt)}</dd></div>
                <div><dt className="font-bold uppercase tracking-wide text-[var(--muted)]">Every</dt><dd className="mt-0.5 font-semibold tabular-nums">{policy.intervalMinutes} min</dd></div>
                <div>
                  <dt className="font-bold uppercase tracking-wide text-[var(--muted)]">Failures in a row</dt>
                  <dd className={`mt-0.5 font-semibold tabular-nums ${policy.consecutiveFailures > 0 ? "text-[#d3372c]" : ""}`}>{policy.consecutiveFailures}</dd>
                </div>
              </dl>

              {controlled ? (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <form action={advanceAndTraceAction}>
                    <input type="hidden" name="policyId" value={policy.id} />
                    <button
                      type="submit"
                      disabled={atLatest}
                      className="ink hard-sm press rounded-full bg-[#2b31d8] px-5 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Advance + trace
                    </button>
                  </form>
                  <span className="text-xs font-semibold text-[var(--muted)] tabular-nums">
                    fixture v{policy.fixtureVersion ?? 0} of {policy.fixtureMaxVersion ?? 0}
                    {atLatest ? " — already at the latest version" : ""}
                  </span>
                </div>
              ) : (
                <p className="mt-5 text-xs font-semibold text-[var(--muted)]">
                  Read over {policy.transport}. Re-read on its own schedule; there is no version here to advance by hand.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
