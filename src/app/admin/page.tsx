import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Database, FlaskConical, Globe, KeyRound, Link2, MousePointerClick, ShieldAlert, Users } from "lucide-react";
import { deriveSystemHealth } from "@/lib/system-health";
import { checkReadiness } from "@/server/health/readiness";
import { getRefreshMetrics } from "@/server/refresh/repository";
import { getIntelligenceMetrics } from "@/server/intelligence/repository";
import { getCollectionMetrics, isKeepingUp, describeWait, LATENESS_DEGRADED, getUnhealthyCollectorTargets } from "@/server/collect/metrics";
import { getNotificationSweepHealth, isSweepHealthy, isSweepKeepingUp } from "@/server/notifications/sweep";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { getAttributionOverview } from "@/server/outbound/partner-report";
import { getDataFreshness, getBrokenCollectors } from "@/server/health/data-health";
import { attentionState } from "@/lib/collector-attention";
import { getSearchConsoleSummary, isSearchConsoleConfigured } from "@/server/seo/search-console";
import { getCatalogCoverage } from "@/server/collect/coverage";
import { getVisitorSummary } from "@/server/analytics/visitors";
import { getPeopleOverview } from "@/server/admin/people";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Stat({ icon: Icon, value, label, sub }: { icon: typeof Users; value: string; label: string; sub?: string }) {
  return (
    <div className="ink hard rounded-[18px] bg-white p-5">
      <Icon className="size-5 text-[#2b31d8]" />
      <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-[-.04em]">{value}</p>
      <p className="mt-1 text-sm font-bold">{label}</p>
      {sub && <p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

export default async function AdminPage() {
  const principal = await getCurrentPrincipal();
  if (!principal || principal.accountType !== "staff") redirect("/admin/login?next=%2Fadmin");

  const db = await getDatabase();
  // System health, first — the owner reads this page and would otherwise have to remember to open
  // /status. Every one of these degrades to null rather than throwing: an admin page that 500s
  // because a health probe failed is worse than one that says a probe failed.
  const [readiness, refreshMetrics, intelMetrics, collectMetrics, sweepHealth] = await Promise.all([
    checkReadiness().catch(() => null),
    getRefreshMetrics().catch(() => null),
    getIntelligenceMetrics().catch(() => null),
    getCollectionMetrics().catch(() => null),
    getNotificationSweepHealth().catch(() => null),
  ]);
  const health = deriveSystemHealth({
    readiness: readiness ?? { status: "not_ready", schema: { expected: 0, actual: null } },
    collectors: collectMetrics ? { enabled: collectMetrics.enabled, overdue: collectMetrics.overdue, failing: collectMetrics.failing, oldestOverdueMinutes: collectMetrics.oldestOverdueMinutes, keepingUp: isKeepingUp(collectMetrics) } : null,
    refresh: refreshMetrics ? { enabled: refreshMetrics.enabled, failed: refreshMetrics.failed, worstLateness: refreshMetrics.worstLateness, behind: refreshMetrics.worstLateness !== null && refreshMetrics.worstLateness >= LATENESS_DEGRADED } : null,
    intelligenceReporting: Boolean(intelMetrics),
    sweep: sweepHealth ? { lastRanAt: sweepHealth.lastRanAt, lastOk: sweepHealth.lastOk, backlogReaders: sweepHealth.backlogReaders, healthy: isSweepHealthy(sweepHealth), keepingUp: isSweepKeepingUp(sweepHealth) } : null,
  });

  const coverage = await getCatalogCoverage().catch(() => null);

  const gscPromise = getSearchConsoleSummary();
  const [attribution, visitors, people, freshness, broken, counts, collectors, unhealthy] = await Promise.all([
    getAttributionOverview({ days: 30 }),
    getVisitorSummary({ days: 30 }),
    getPeopleOverview({ recentDays: 7 }),
    getDataFreshness(),
    getBrokenCollectors(),
    db.query<{ vendors: string; listings: string; coas: string; graded: string; due: string }>(
      `SELECT
        (SELECT COUNT(*) FROM organizations WHERE organization_type='vendor' AND origin='live') vendors,
        (SELECT COUNT(*) FROM listings WHERE origin='live') listings,
        (SELECT COUNT(*) FROM lab_test_records WHERE is_independent) coas,
        (SELECT COUNT(*) FROM organizations WHERE grade_letter IS NOT NULL) graded,
        (SELECT COUNT(*) FROM collection_targets WHERE enabled AND next_due_at <= NOW()) due`,
    ).then(r => r.rows[0]!),
    // Per-collector state. Without this, a collector that never RUNS is indistinguishable from one
    // that runs and finds nothing — which is exactly how enforcement sat at 24 records for hours.
    db.query<{ collector: string; targets: string; due: string; last_run_at: string | null; last_ok: boolean | null; last_error: string | null; failures: string; next_due_at: string }>(
      `SELECT collector, COUNT(*) AS targets,
              COUNT(*) FILTER (WHERE enabled AND next_due_at <= NOW()) AS due,
              MAX(last_run_at) AS last_run_at,
              BOOL_AND(COALESCE(last_ok, TRUE)) AS last_ok,
              MAX(last_error) AS last_error,
              MAX(consecutive_failures) AS failures,
              MIN(next_due_at) AS next_due_at
       FROM collection_targets GROUP BY collector ORDER BY collector`,
    ).then(r => r.rows),
    // By NAME. The per-kind table above collapses two failing vendors into one row, which is how
    // "2 failing" on /status could not be turned into two names.
    getUnhealthyCollectorTargets(db).catch(() => []),
  ]);

  const { totals, vendors } = attribution;

  // One number for "people who clicked through", read from outbound_clicks — the same source card 2
  // uses. The page previously showed 4 here and 2 in the banner because the banner re-derived it by
  // joining page views, which drops anyone whose view-tracking was blocked. Numerator and
  // denominator are now both distinct-daily-hashes, so the ratio is like-for-like.
  const clickThroughRate = visitors.readerDays > 0 ? totals.clickers / visitors.readerDays : 0;
  const unmatchedClickers = Math.max(0, totals.clickers - visitors.matchedClickers);

  return (
    <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8">
      {/* Health first, because the owner will not remember to go and look for it. Loud when
          something is wrong, quiet but present when nothing is — a band that only ever appears on
          a bad day is a band nobody learns to read. */}
      <section
        aria-label="System health"
        data-testid="admin-system-health"
        className={`ink ${health.level === "operational" ? "hard-mint" : "hard"} rounded-[20px] p-6 sm:p-7 ${health.level === "operational" ? "bg-[#111214] text-white" : health.level === "outage" ? "bg-[#fff1f0]" : "bg-[#fff8e8]"}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {health.level === "operational"
              ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#8fffd6]" />
              : <AlertTriangle className={`mt-0.5 size-5 shrink-0 ${health.level === "outage" ? "text-[#d3372c]" : "text-[#b26a00]"}`} />}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] opacity-60">System health</p>
              <p className="mt-1.5 text-base font-extrabold leading-6">{health.headline}</p>
            </div>
          </div>
          <Link
            href="/status"
            className={`ink-1 hard-sm press inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold ${health.level === "operational" ? "border-white/25 bg-white text-[#111214]" : "bg-white text-[#111214]"}`}
          >
            Full status <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <HealthSignal
            dark={health.level === "operational"}
            label="Database"
            value={readiness ? (readiness.status === "ready" ? "Ready" : readiness.status === "degraded" ? "Schema behind" : "Unreachable") : "Not reporting"}
            detail={readiness ? `schema ${readiness.schema.actual ?? "?"} of ${readiness.schema.expected}` : "the probe itself failed"}
          />
          <HealthSignal
            dark={health.level === "operational"}
            label="Collectors"
            value={collectMetrics ? `${collectMetrics.enabled} enabled` : "Not reporting"}
            detail={
              !collectMetrics
                ? "the probe itself failed"
                : collectMetrics.overdue === 0
                  ? "every source within its schedule"
                  : `${collectMetrics.overdue} waiting · ${collectMetrics.failing > 0 ? `${collectMetrics.failing} failing` : "none failing, draining"}`
            }
          />
          <HealthSignal
            dark={health.level === "operational"}
            label="Refresh queue"
            value={refreshMetrics ? `${refreshMetrics.enabled} enabled` : "Not reporting"}
            detail={refreshMetrics ? `${refreshMetrics.queued} queued · ${refreshMetrics.failed} failed` : "the probe itself failed"}
          />
          <HealthSignal
            dark={health.level === "operational"}
            label="Alerts going out"
            value={!sweepHealth ? "Not reporting" : sweepHealth.lastRanAt === null ? "Never run" : `${sweepHealth.lastSweptUsers} readers`}
            detail={
              !sweepHealth
                ? "the probe itself failed"
                : sweepHealth.lastRanAt === null
                  ? "nobody is being told anything while away"
                  : `last ran ${describeWait(Math.round((sweepHealth.hoursSinceLastRun ?? 0) * 60))} ago`
            }
          />
        </div>
      </section>

      <p className="mt-10 text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Admin</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Traffic you can prove you sent</h1>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
        Last 30 days. Read it in order: readers <strong>arrive</strong>, some <strong>click through</strong> to a
        vendor, and a few of those <strong>buy</strong>. Automated traffic — search crawlers, link previews, our own
        checks — is excluded, and so is our own signed-in browsing. Readers are counted{" "}
        <strong>once a day</strong>: with no cookies and no accounts we cannot tell that today&rsquo;s reader is
        yesterday&rsquo;s, so someone returning on another day counts again. Treat these as visits by readers, not as
        a headcount of distinct people. Every link carries{" "}
        <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[12px]">utm_source=vialgrade</code>, so a
        vendor can confirm the numbers in their own analytics without taking our word for it.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          icon={Users}
          value={visitors.readerDays.toLocaleString()}
          label="1. Readers, counted once a day"
          sub={
            visitors.busiestDay
              ? `${visitors.visits.toLocaleString()} pages read · busiest day ${visitors.busiestDay.people}`
              : `${visitors.visits.toLocaleString()} pages read`
          }
        />
        <Stat icon={MousePointerClick} value={totals.clicks.toLocaleString()} label="2. Clicks to a vendor" sub={`from ${totals.clickers.toLocaleString()} ${totals.clickers === 1 ? "reader" : "readers"}`} />
        <Stat icon={Link2} value={String(totals.vendors)} label="3. Vendors receiving them" />
        <Stat icon={ArrowUpRight} value={String(totals.conversions)} label="4. Confirmed orders" sub={totals.conversions === 0 ? "zero until a vendor sends orders back" : "reported back by a partner"} />
        <Stat icon={Database} value={money(totals.revenueCents)} label="5. Revenue we drove" sub={totals.revenueCents === 0 ? "zero until a deal is live" : undefined} />
      </div>

      {/* Inbound. Outbound alone cannot tell you whether traffic is growing or whether a source
          converts — and the arrivals-to-buyers ratio is the strongest line in the vendor pitch. */}
      <div className="ink hard mt-4 rounded-[18px] bg-[#e6fbf4] p-5">
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#0e8f80]">The number that sells a deal</p>
        <p className="mt-2 text-3xl font-extrabold tracking-[-.03em]">
          {Math.round(clickThroughRate * 100)}% of readers clicked through to a vendor
        </p>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#0e8f80]">
          {visitors.readerDays === 0
            ? "No reader traffic yet, so there is nothing to rate. This fills in as real visitors arrive."
            : `${totals.clickers.toLocaleString()} of ${visitors.readerDays.toLocaleString()} readers went on to a seller. Both sides are counted the same way — a hash that resets daily, no cookies and no accounts — so a reader returning on another day counts again in both.`}
          {unmatchedClickers > 0 &&
            ` We could tie ${visitors.matchedClickers} of those clicks back to a recorded page view; the other ${unmatchedClickers} came from readers whose view-tracking was blocked, which is normal and means arrivals are undercounted.`}
        </p>
      </div>

      <h2 className="mt-12 text-2xl font-extrabold tracking-[-.03em]">Where they came from</h2>

      {visitors.topSources.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="ink hard rounded-[18px] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Where they come from</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {visitors.topSources.map(s2 => (
                <li key={s2.source} className="flex justify-between gap-4">
                  <span className="truncate font-bold">{s2.source}</span>
                  <span className="tabular-nums text-[var(--muted)]">{s2.people}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ink hard rounded-[18px] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Most-read pages</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {visitors.topPages.slice(0, 8).map(p2 => (
                <li key={p2.path} className="flex justify-between gap-4">
                  <span className="truncate font-mono text-[12px]">{p2.path}</span>
                  <span className="tabular-nums text-[var(--muted)]">{p2.visits}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Google's side of the story: how often we were SHOWN and chosen, from Search Console —
          the step this site cannot observe on its own. Absent credentials, the card explains
          exactly how to connect it. */}
      <h2 className="mt-12 text-2xl font-extrabold tracking-[-.03em]">Google&rsquo;s side of the story</h2>
      {await (async () => {
        const gsc = await gscPromise;
        if (gsc) {
          return (
            <>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Search Console, last {gsc.windowDays} full days (Google&rsquo;s data lags ~2 days). This is the step before the funnel above: how often Google showed {gsc.site.replace("sc-domain:", "")} and how many people chose it.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat icon={Globe} value={gsc.impressions.toLocaleString()} label="Times shown in Google" />
                <Stat icon={MousePointerClick} value={gsc.clicks.toLocaleString()} label="Clicks from Google" sub={gsc.impressions > 0 ? `${(gsc.ctr * 100).toFixed(1)}% of impressions` : undefined} />
                <Stat icon={ArrowUpRight} value={gsc.position > 0 ? gsc.position.toFixed(1) : "—"} label="Average position" />
                <Stat icon={Users} value={String(gsc.topQueries.length)} label="Queries below" />
              </div>
              {gsc.topQueries.length > 0 && (
                <div className="ink hard mt-3 rounded-[18px] bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">What people typed</p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {gsc.topQueries.map(q => (
                      <li key={q.query} className="flex justify-between gap-4">
                        <span className="truncate font-bold">{q.query}</span>
                        <span className="shrink-0 tabular-nums text-[var(--muted)]">{q.clicks} clicks · {q.impressions.toLocaleString()} shown · pos {q.position.toFixed(1)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          );
        }
        return (
          <div className="ink hard mt-4 rounded-[18px] bg-white p-6">
            <p className="text-sm font-bold">{isSearchConsoleConfigured() ? "Search Console is configured but could not be reached — it will retry on the next load." : "Not connected yet. Ten minutes, one credential, and this card fills with Google impressions, clicks, and the exact queries people typed."}</p>
            {!isSearchConsoleConfigured() && (
              <ol className="mt-4 max-w-3xl list-decimal space-y-2.5 pl-5 text-sm font-medium leading-6 text-[var(--muted)]">
                <li>Open <span className="font-bold text-[#111214]">console.cloud.google.com</span> → sign in → top bar → <span className="font-bold text-[#111214]">Select a project → New project</span> → name it <code className="rounded bg-black/[.06] px-1">vialgrade</code> → Create.</li>
                <li>In that project: <span className="font-bold text-[#111214]">APIs &amp; Services → Library</span> → search &ldquo;Google Search Console API&rdquo; → <span className="font-bold text-[#111214]">Enable</span>.</li>
                <li><span className="font-bold text-[#111214]">APIs &amp; Services → Credentials → Create credentials → Service account</span> → name <code className="rounded bg-black/[.06] px-1">vialgrade-gsc</code> → Done. Open it → <span className="font-bold text-[#111214]">Keys → Add key → Create new key → JSON</span> → a file downloads.</li>
                <li>Open <span className="font-bold text-[#111214]">search.google.com/search-console</span> → the vialgrade.com property → <span className="font-bold text-[#111214]">Settings → Users and permissions → Add user</span> → paste the service account&rsquo;s email from the JSON (<code className="rounded bg-black/[.06] px-1">client_email</code>, ends in iam.gserviceaccount.com) → permission <span className="font-bold text-[#111214]">Full</span> → Add.</li>
                <li>Open <span className="font-bold text-[#111214]">vercel.com</span> → the <code className="rounded bg-black/[.06] px-1">vial</code> project → <span className="font-bold text-[#111214]">Settings → Environment Variables</span>. Add <code className="rounded bg-black/[.06] px-1">VIALGRADE_GSC_CLIENT_EMAIL</code> = the JSON&rsquo;s <code className="rounded bg-black/[.06] px-1">client_email</code>, and <code className="rounded bg-black/[.06] px-1">VIALGRADE_GSC_PRIVATE_KEY</code> = the JSON&rsquo;s <code className="rounded bg-black/[.06] px-1">private_key</code> value, pasted exactly as it appears. Save, then <span className="font-bold text-[#111214]">Deployments → ⋯ on the latest → Redeploy</span>.</li>
              </ol>
            )}
          </div>
        );
      })()}

      {/* The pipeline: who we already send buyers to, ranked — i.e. who to approach first. */}
      <h2 className="mt-12 text-2xl font-extrabold tracking-[-.03em]">Who to approach first</h2>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
        Ranked by traffic we are already sending them for free. Open a vendor to get the one-page report to send them.
      </p>
      <div className="ink hard mt-4 overflow-x-auto rounded-[18px] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b-2 border-[#111214]/10 text-[11px] uppercase tracking-[.1em] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3">Vendor</th><th className="px-5 py-3">Clicks sent</th>
              <th className="px-5 py-3">Readers</th><th className="px-5 py-3">Orders</th>
              <th className="px-5 py-3">Revenue</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#111214]/10">
            {vendors.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-sm font-medium text-[var(--muted)]">
                No outbound clicks yet. They start the moment a buyer uses a &ldquo;Buy at vendor&rdquo; button.
              </td></tr>
            )}
            {vendors.map(v => (
              <tr key={v.vendorSlug}>
                <td className="px-5 py-3 font-bold">{v.vendorName}</td>
                <td className="px-5 py-3 font-extrabold tabular-nums">{v.clicks.toLocaleString()}</td>
                <td className="px-5 py-3 tabular-nums">{v.visitorDays.toLocaleString()}</td>
                <td className="px-5 py-3 tabular-nums">{v.conversions || "—"}</td>
                <td className="px-5 py-3 tabular-nums">{v.revenueCents ? money(v.revenueCents) : "—"}</td>
                <td className="px-5 py-3"><span className="ink-1 rounded-full bg-[#f2f2ef] px-2 py-1 text-[11px] font-bold uppercase tracking-[.08em]">{v.status}</span></td>
                <td className="px-5 py-3">
                  <Link href={`/admin/partner/${v.vendorSlug}`} className="text-sm font-bold text-[#2b31d8] hover:underline">Report →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Account administration, deliberately NOT analytics. The privacy notice promises that
          analytics records carry no account identifier, so nothing here is joined to what anyone
          read — and the stored IP/user-agent hashes are counted but never shown. */}
      <h2 className="mt-12 text-2xl font-extrabold tracking-[-.03em]">People and sign-ins</h2>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
        Who holds an account, and who has signed in. This is account administration — it is never joined to what
        anyone read, and the IP and device hashes kept for session security are deliberately not shown here.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Users}
          value={String(people.totals.accounts)}
          label="Accounts"
          sub={people.totals.byType.map(t => `${t.count} ${t.accountType}`).join(" · ") || undefined}
        />
        <Stat icon={KeyRound} value={String(people.totals.signedInNow)} label="Signed in right now" sub="live, unexpired sessions" />
        <Stat
          icon={ShieldAlert}
          value={String(people.totals.failedRecently)}
          label="Failed sign-ins, 7 days"
          sub={people.totals.failedRecently === 0 ? "nothing to look at" : "check the log below"}
        />
        <Stat
          icon={ShieldAlert}
          value={String(people.totals.lockedNow)}
          label="Locked out now"
          sub={people.totals.lockedNow === 0 ? "no account is locked" : "too many failed attempts"}
        />
      </div>

      <div className="ink hard mt-4 overflow-x-auto rounded-[18px] bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b-2 border-[#111214]/10 text-[11px] uppercase tracking-[.1em] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3">Person</th><th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th><th className="px-5 py-3">Last signed in</th>
              <th className="px-5 py-3">Sessions</th><th className="px-5 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#111214]/10">
            {people.accounts.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm font-medium text-[var(--muted)]">
                No accounts yet.
              </td></tr>
            )}
            {people.accounts.map(a => (
              <tr key={a.userId}>
                <td className="px-5 py-3">
                  <span className="font-bold">{a.displayName}</span>
                  <span className="block text-xs font-medium text-[var(--muted)]">{a.email}</span>
                </td>
                <td className="px-5 py-3">
                  <span className="ink-1 rounded-full bg-[#f2f2ef] px-2 py-1 text-[11px] font-bold uppercase tracking-[.08em]">{a.accountType}</span>
                </td>
                <td className="px-5 py-3 text-xs font-bold">
                  {a.lockedUntil && new Date(a.lockedUntil) > new Date()
                    ? <span className="text-[#b4241f]">Locked</span>
                    : <span className={a.status === "active" ? "" : "text-[var(--muted)]"}>{a.status}</span>}
                  {!a.emailVerified && <span className="block font-medium text-[var(--muted)]">email unverified</span>}
                </td>
                <td className="px-5 py-3 text-xs font-medium tabular-nums">{a.lastLoginAt ? when(a.lastLoginAt) : "never"}</td>
                <td className="px-5 py-3 tabular-nums">{a.activeSessions || "—"}</td>
                <td className="px-5 py-3 text-xs font-medium tabular-nums text-[var(--muted)]">{a.createdAt ? when(a.createdAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {people.signIns.length > 0 && (
        <div className="ink hard mt-3 overflow-x-auto rounded-[18px] bg-white">
          <p className="px-5 pt-5 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">
            {people.signIns.length > 25
              ? `Sign-in attempts · 25 most recent of ${people.signIns.length >= 100 ? "100+" : people.signIns.length} in 7 days`
              : "Sign-in attempts, last 7 days"}
          </p>
          <table className="mt-3 w-full min-w-[520px] text-left text-sm">
            <tbody className="divide-y divide-[#111214]/10">
              {people.signIns.slice(0, 25).map((s, i) => (
                <tr key={`${s.at}-${i}`}>
                  <td className="px-5 py-2.5 text-xs font-medium tabular-nums text-[var(--muted)]">{when(s.at)}</td>
                  <td className="px-5 py-2.5 font-medium">{s.email}</td>
                  <td className="px-5 py-2.5 text-xs font-bold">
                    {s.outcome === "success"
                      ? <span className="text-[#0e8f80]">signed in</span>
                      : <span className="text-[#b4241f]">{s.outcome}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="h-4" />
        </div>
      )}

      <h2 className="mt-12 text-2xl font-extrabold tracking-[-.03em]">Is the data healthy?</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FlaskConical} value={counts.coas} label="Independent lab tests" />
        <Stat icon={Database} value={counts.listings} label="Live listings" sub={`${counts.vendors} vendors · ${counts.graded} graded`} />
        <Stat icon={MousePointerClick} value={counts.due} label="Collection queue due now" sub="drains every 15 minutes" />
        <Stat
          icon={Link2}
          value={String(broken.length)}
          label="Broken collectors"
          sub={broken.length ? broken.map(b => b.target).slice(0, 3).join(", ") : "every source that yielded data still does"}
        />
      </div>
      <h2 className="mt-12 text-2xl font-extrabold tracking-[-.03em]">Collectors needing attention</h2>
      {unhealthy.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-[var(--muted)]">Every collector is enabled and its last run succeeded.</p>
      ) : (
        <div className="ink hard mt-4 overflow-x-auto rounded-[18px] bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b-2 border-[#111214]/10 text-[11px] uppercase tracking-[.1em] text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3">Vendor / target</th><th className="px-5 py-3">Collector</th>
                <th className="px-5 py-3">State</th><th className="px-5 py-3">Last run</th>
                <th className="px-5 py-3">Next due</th><th className="px-5 py-3">Last error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111214]/10">
              {unhealthy.map(t => {
                const st = attentionState(t, collectors.map(c => ({ collector: c.collector, lastOk: c.last_ok === null ? null : Boolean(c.last_ok) })));
                return (
                <tr key={t.id} className={st.tone === "red" ? "bg-[#fff1f0]" : st.tone === "amber" ? "bg-[#fff4e0]" : "bg-[#f3f3f3]"}>
                  <td className="px-5 py-3 font-bold">{t.target}</td>
                  <td className="px-5 py-3 text-xs">{t.collector}</td>
                  <td className="px-5 py-3 text-xs font-bold">{st.label}</td>
                  <td className="px-5 py-3 text-xs">{t.lastRunAt ? new Date(t.lastRunAt).toLocaleString() : "never"}</td>
                  <td className="px-5 py-3 text-xs">{t.enabled && t.nextDueAt ? new Date(t.nextDueAt).toLocaleString() : "—"}</td>
                  <td className="px-5 py-3 text-xs text-[var(--muted)]">{t.lastError?.slice(0, 120) ?? "—"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="mt-12 text-2xl font-extrabold tracking-[-.03em]">Storefronts that cannot be graded</h2>
      {!coverage ? (
        <p className="mt-3 text-sm font-medium text-[var(--muted)]">The coverage report could not be read.</p>
      ) : coverage.ungradable.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-[var(--muted)]">Every storefront on record has a catalogue we have read.</p>
      ) : (
        <>
          {/* The grade scale needs a catalogue to rate, so a storefront with no listings can never
              earn a letter. None of these is a FAILING collector, which is exactly why they are
              invisible in the table above — most have no catalog collector enqueued at all. */}
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
            <span className="font-extrabold text-[#111214]">{coverage.ungradable.length} of {coverage.storefronts}</span> storefronts have no catalogue on record, so the grade scale has nothing to rate and the directory shows them as &ldquo;No listings&rdquo;.
            {/* Each clause appears only when it has something to describe. Once vendor-kind
                reconciliation moved the lab-feed factories out of this list, the uncurated bucket
                emptied and this paragraph was reporting "0 were surfaced from lab records". */}
            {coverage.counts["no-method"] > 0 && <>{" "}<span className="font-bold text-[#111214]">{coverage.counts["no-method"]}</span> are curated and polled for status, but no catalogue import method was ever identified &mdash; nothing reads their storefront.</>}
            {coverage.counts.uncurated > 0 && <>{" "}<span className="font-bold text-[#111214]">{coverage.counts.uncurated}</span> were surfaced from lab records and never curated.</>}
            {coverage.counts.collecting > 0 && <>{" "}<span className="font-bold text-[#111214]">{coverage.counts.collecting}</span> have a collector that has not yet succeeded &mdash; those appear above.</>}
          </p>
          <div className="ink hard mt-4 overflow-x-auto rounded-[18px] bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b-2 border-[#111214]/10 text-[11px] uppercase tracking-[.1em] text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3">Storefront</th><th className="px-5 py-3">Why it has no catalogue</th>
                  <th className="px-5 py-3">Lab tests we hold</th><th className="px-5 py-3">What would change it</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111214]/10">
                {coverage.ungradable.slice(0, 40).map((row) => (
                  <tr key={row.slug} className={row.state === "no-method" ? "bg-[#fff4e0]" : undefined}>
                    <td className="px-5 py-3 font-bold">{row.name}</td>
                    <td className="px-5 py-3 text-xs font-bold">
                      {row.state === "no-method" ? "Curated, but no import method" : row.state === "uncurated" ? "Never curated" : "Collector has not succeeded yet"}
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums">{row.coaCount || "—"}</td>
                    <td className="px-5 py-3 text-xs text-[var(--muted)]">
                      {/* The note is what a probe actually found. Without it this column could only
                          repeat the generic instruction, and the next person would re-probe a
                          storefront we already know answers 401. */}
                      {row.note ?? (row.state === "no-method" ? "Identify how its catalogue can be read, then set the flag in known-vendors.json" : row.state === "uncurated" ? "Add it to known-vendors.json with a domain" : "See the attention table above")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {coverage.ungradable.length > 40 && (
            <p className="mt-2 text-xs font-medium tabular-nums text-[var(--muted)]">Showing the 40 that matter most of {coverage.ungradable.length}.</p>
          )}
        </>
      )}

      <h2 className="mt-12 text-2xl font-extrabold tracking-[-.03em]">Collectors</h2>
      <div className="ink hard mt-4 overflow-x-auto rounded-[18px] bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b-2 border-[#111214]/10 text-[11px] uppercase tracking-[.1em] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3">Collector</th><th className="px-5 py-3">Targets</th>
              <th className="px-5 py-3">Due</th><th className="px-5 py-3">Last run</th>
              <th className="px-5 py-3">State</th><th className="px-5 py-3">Last error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#111214]/10">
            {collectors.map(c => {
              const neverRan = !c.last_run_at;
              const failing = c.last_ok === false || Number(c.failures) > 0;
              return (
                <tr key={c.collector} className={failing ? "bg-[#fff1f0]" : neverRan ? "bg-[#fff4e0]" : undefined}>
                  <td className="px-5 py-3 font-bold">{c.collector}</td>
                  <td className="px-5 py-3 tabular-nums">{c.targets}</td>
                  <td className="px-5 py-3 tabular-nums">{c.due}</td>
                  <td className="px-5 py-3 text-xs">{c.last_run_at ? new Date(c.last_run_at).toLocaleString() : "never"}</td>
                  <td className="px-5 py-3 text-xs font-bold">
                    {failing ? `failing (${c.failures})` : neverRan ? "never run" : "ok"}
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--muted)]">{c.last_error?.slice(0, 90) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs font-medium text-[var(--muted)]">
        Listings checked in the last 14 days: {freshness.listings.fresh} fresh · {freshness.listings.aging} aging · {freshness.listings.stale} stale.
        Lab tests: {freshness.coas.fresh} fresh · {freshness.coas.stale} stale.
      </p>
    </div>
  );
}

function HealthSignal({ label, value, detail, dark }: { label: string; value: string; detail: string; dark: boolean }) {
  return (
    <div className={`ink-1 rounded-[14px] p-3.5 ${dark ? "border-white/20 bg-white/[.07]" : "bg-white"}`}>
      <p className={`text-[9px] font-bold uppercase tracking-[.14em] ${dark ? "text-white/50" : "text-[var(--muted)]"}`}>{label}</p>
      <p className="mt-1.5 text-sm font-extrabold">{value}</p>
      <p className={`mt-0.5 text-[11px] font-medium leading-4 ${dark ? "text-white/50" : "text-[var(--muted)]"}`}>{detail}</p>
    </div>
  );
}
