import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Database, FlaskConical, Globe, GitCompareArrows, KeyRound, Link2, Mail, MailCheck, MousePointerClick, ShieldAlert, Store, TrendingUp, Users } from "lucide-react";
import { deriveSystemHealth } from "@/lib/system-health";
import { checkReadiness } from "@/server/health/readiness";
import { getRefreshMetrics } from "@/server/refresh/repository";
import { getIntelligenceMetrics } from "@/server/intelligence/repository";
import { getCollectionMetrics, isKeepingUp, describeWait, LATENESS_DEGRADED, getUnhealthyCollectorTargets } from "@/server/collect/metrics";
import { getNotificationSweepHealth, isSweepHealthy, isSweepKeepingUp } from "@/server/notifications/sweep";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { principalHasPermission } from "@/server/auth/permissions";
import { getAttributionOverview } from "@/server/outbound/partner-report";
import { getDataFreshness, getBrokenCollectors } from "@/server/health/data-health";
import { attentionState } from "@/lib/collector-attention";
import { getSearchConsoleSummary, isSearchConsoleConfigured } from "@/server/seo/search-console";
import { getCatalogCoverage } from "@/server/collect/coverage";
import { getVisitorSummary } from "@/server/analytics/visitors";
import { getPeopleOverview } from "@/server/admin/people";
import { getSignupOverview } from "@/server/digest/signup-overview";
import { getCatalogInsights, daysBetween } from "@/server/admin/catalog-insights";
import { listVerifyDemand } from "@/server/verify/query-log";
import { getDatabase } from "@/server/db/client";
import { AdminColumns } from "@/components/admin/admin-columns";
import { SignupTable } from "@/components/admin/signup-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const shortDay = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Stat({ icon: Icon, value, label, sub }: { icon: typeof Users; value: string | number; label: string; sub?: string }) {
  return (
    <div className="ink hard rounded-[18px] bg-white p-5">
      <Icon className="size-5 text-[#2b31d8]" />
      <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-[-.04em]">{value}</p>
      <p className="mt-1 text-sm font-bold">{label}</p>
      {sub && <p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

// The page in the order the owner reads it: what is growing, who is finding the site, what the
// site holds, whether it is still being collected, then housekeeping. Each entry is a section id.
const SECTIONS = [
  { id: "signups", label: "Signups" },
  { id: "reach", label: "Reach" },
  { id: "catalog", label: "On record" },
  { id: "collection", label: "Collection" },
  { id: "accounts", label: "Accounts" },
  { id: "historical", label: "Shop era" },
] as const;

function SectionHead({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6 pt-12">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">{eyebrow}</p>
      <h2 className="mt-1.5 text-2xl font-extrabold tracking-[-.03em]">{title}</h2>
      {children && <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">{children}</p>}
    </div>
  );
}

const SUB = "mt-8 text-base font-extrabold tracking-[-.02em]";

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

  const gscPromise = getSearchConsoleSummary();
  // Addresses are shown only to staff whose role may read personal data; everyone else sees counts.
  const mayReadAddresses = principalHasPermission(principal, "privacy:read");
  const [signups, catalog, lastView] = await Promise.all([
    getSignupOverview({ limit: 8, connection: db }).catch(() => null),
    getCatalogInsights({ connection: db }).catch(() => null),
    db.query<{ at: string | null }>(`SELECT to_char(MAX(created_at) AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS at FROM page_views WHERE NOT is_bot`).then(r => r.rows[0]?.at ?? null).catch(() => null),
  ]);
  const [attribution, visitors, people, freshness, broken, counts, collectors, unhealthy, coverage, verifyDemand] = await Promise.all([
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
    getCatalogCoverage().catch(() => null),
    listVerifyDemand({ limit: 40 }),
  ]);

  const { totals, vendors } = attribution;

  // One number for "people who clicked through", read from outbound_clicks — the same source card 2
  // uses. The page previously showed 4 here and 2 in the banner because the banner re-derived it by
  // joining page views, which drops anyone whose view-tracking was blocked. Numerator and
  // denominator are now both distinct-daily-hashes, so the ratio is like-for-like.
  const clickThroughRate = visitors.readerDays > 0 ? totals.clickers / visitors.readerDays : 0;
  const unmatchedClickers = Math.max(0, totals.clickers - visitors.matchedClickers);

  const trend = signups ? signups.last30Days - signups.previous30Days : 0;
  const today = new Date().toISOString().slice(0, 10);
  const priceAgeDays = catalog?.lastPriceRead ? daysBetween(catalog.lastPriceRead, today) : null;

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
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Overview</h1>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
        Who is signing up, who is finding the site, what the site holds, and whether it is still being read.
      </p>
      <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2">
        {SECTIONS.map(section => (
          <a key={section.id} href={`#${section.id}`} className="ink-1 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold hover:bg-[#eef0ff]">{section.label}</a>
        ))}
      </nav>

      {/* ── Signups: the email list. This is the site's signup now; reader accounts are closed. ── */}
      <SectionHead id="signups" eyebrow="Signups" title="Email list">
        Everyone who asked for the monthly update, from the first-visit prompt or the signup page. Unsubscribing deletes
        the address, so every figure is who is on the list now. The list is never joined to what anyone read.
      </SectionHead>
      {!signups ? (
        <p className="mt-4 text-sm font-medium text-[var(--muted)]">The email list could not be read.</p>
      ) : (
        <div data-testid="admin-signups">
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Mail} value={signups.total.toLocaleString()} label="On the list"
              sub={signups.total === 0 ? "no signups yet" : `${signups.last7Days.toLocaleString()} in the last 7 days`} />
            <Stat icon={TrendingUp} value={signups.last30Days.toLocaleString()} label="New in 30 days"
              sub={signups.previous30Days === 0 && signups.last30Days === 0 ? "none in the 30 days before either" : `${trend >= 0 ? "+" : "−"}${Math.abs(trend).toLocaleString()} against the 30 days before (${signups.previous30Days.toLocaleString()})`} />
            <Stat icon={MailCheck} value={signups.confirmed.toLocaleString()} label="Confirmed"
              sub="clicked the confirmation link; these get the update" />
            <Stat icon={CalendarClock} value={(signups.waiting + signups.confirmationSent).toLocaleString()} label="Not confirmed yet"
              sub={`${signups.waiting.toLocaleString()} waiting for the first email · ${signups.confirmationSent.toLocaleString()} sent a link`} />
          </div>

          {/* Said plainly, because it decides what a signup is worth today: an address that can be mailed, or one that is only being held. */}
          <div className={`ink hard mt-3 rounded-[18px] p-5 ${signups.mailConnected ? "bg-[#e6fbf4]" : "bg-[#fff8e8]"}`}>
            <p className="text-sm font-extrabold">{signups.mailConnected ? "Email sending is connected." : "Email sending is not connected, so signups are being saved but nobody is being emailed."}</p>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[#3a3d46]">
              {signups.mailConnected
                ? `New signups get a confirmation link straight away.${signups.waiting > 0 ? ` ${signups.waiting.toLocaleString()} saved earlier will get theirs on the next monthly run.` : ""}${signups.lastUpdateThrough ? ` The last monthly update ran through ${signups.lastUpdateThrough}.` : " No monthly update has gone out yet."}`
                : "Each address is kept with the consent the reader ticked. Once RESEND_API_KEY and DIGEST_FROM_EMAIL are set on the deployment, the monthly run sends every waiting address one confirmation link, and only the ones who click it get updates."}
            </p>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
            <div className="ink hard min-w-0 rounded-[18px] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Signups per day, last 30 days</p>
              <div className="mt-4">
                <AdminColumns title="Signups per day, last 30 days" unit="signup" emptyText="No signups in the last 30 days."
                  points={signups.daily.map(d => ({ label: shortDay(d.day), value: d.count }))}
                  startLabel={shortDay(signups.daily[0]!.day)} endLabel={shortDay(signups.daily[signups.daily.length - 1]!.day)} />
              </div>
            </div>
            <div className="ink hard min-w-0 overflow-hidden rounded-[18px] bg-white">
              <div className="flex items-center justify-between gap-3 px-5 pt-5">
                <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Latest signups</p>
                <Link href="/admin/signups" className="text-sm font-bold text-[#2b31d8] hover:underline">All signups →</Link>
              </div>
              <div className="mt-3">
                <SignupTable rows={signups.rows} showAddresses={mayReadAddresses} compact />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reach: who is finding the site. Google's side is live; our own reader counting is off. ── */}
      <SectionHead id="reach" eyebrow="Reach" title="Who is finding the site">
        Search Console is the live figure here: how often Google showed the site and how often it was chosen.
      </SectionHead>
      {await (async () => {
        const gsc = await gscPromise;
        if (gsc) {
          return (
            <>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Search Console, last {gsc.windowDays} full days (Google&rsquo;s data lags about 2 days): how often Google showed {gsc.site.replace("sc-domain:", "")} and how many people chose it.</p>
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

      <h3 className={SUB}>Readers on the site</h3>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
        {/* The page-view beacon answers 410 while the privacy review is open (lib/privacy-pause.ts), so this figure cannot grow. */}
        Reader counting is switched off: the page-view beacon has been paused since the privacy review began, so nothing new is being recorded.
        {lastView ? ` The last page view on record is from ${lastView}.` : " No page view is on record."}
        {" "}What was recorded is counted once a day per reader, with no cookies and no accounts, and excludes automated traffic and signed-in staff.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Users}
          value={visitors.readerDays.toLocaleString()}
          label="Readers in the last 30 days"
          sub={
            visitors.busiestDay
              ? `${visitors.visits.toLocaleString()} pages read · busiest day ${visitors.busiestDay.people}`
              : `${visitors.visits.toLocaleString()} pages read`
          }
        />
      </div>
      {visitors.topSources.length > 0 && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="ink hard rounded-[18px] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Where they came from</p>
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
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/analytics" className="ink hard-sm press inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold">
          Recorded traffic, day by day <ArrowUpRight className="size-4" />
        </Link>
      </div>

      {/* ── On record: what the public pages are built from, and how recently it was read. ── */}
      <SectionHead id="catalog" eyebrow="On record" title="What the site holds">
        The listings, prices and lab reports the compound, vendor and comparison pages are built from, and when a price was last read.
      </SectionHead>
      {!catalog ? (
        <p className="mt-4 text-sm font-medium text-[var(--muted)]">The catalogue figures could not be read.</p>
      ) : (
        <div data-testid="admin-catalog">
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Database} value={catalog.listings.toLocaleString()} label="Listings on record"
              sub={`${catalog.vendorsListed.toLocaleString()} vendors · ${catalog.compoundsListed.toLocaleString()} compounds with a price read`} />
            <Stat icon={FlaskConical} value={catalog.independentReports.toLocaleString()} label="Independent lab reports"
              sub={`${catalog.vendorsWithReports.toLocaleString()} vendors named · ${catalog.reportsAdded30Days.toLocaleString()} added in 30 days${catalog.lastReportAdded ? `, latest ${catalog.lastReportAdded}` : ""}`} />
            <Stat icon={GitCompareArrows} value={catalog.comparableCompounds.toLocaleString()} label="Compounds with price and lab result from one vendor"
              sub="where the vendor comparison can show both on one row" />
            <Stat icon={Store} value={catalog.listingsRead30Days.toLocaleString()} label="Listings with a price read in 30 days"
              sub={`${catalog.listingsRead7Days.toLocaleString()} in the last 7 days`} />
          </div>
          {/* The one thing no health probe says: a collector can be enabled and not failing while every price is months old. */}
          <div className={`ink hard mt-3 rounded-[18px] p-5 ${priceAgeDays === null || priceAgeDays > 14 ? "bg-[#fff8e8]" : "bg-[#e6fbf4]"}`} data-testid="admin-price-freshness">
            <p className="text-sm font-extrabold">
              {priceAgeDays === null
                ? "No live price has been read yet."
                : priceAgeDays > 14
                  ? `Prices are going stale: the last price was read ${priceAgeDays} days ago, on ${catalog.lastPriceRead}.`
                  : `Prices are current: the last price was read ${priceAgeDays === 0 ? "today" : priceAgeDays === 1 ? "yesterday" : `${priceAgeDays} days ago`}, on ${catalog.lastPriceRead}.`}
            </p>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[#3a3d46]">
              Every public price carries the day it was read, so a stale read shows on the page as an old date, not as a wrong price. The chart counts the listings whose price was read each week.
            </p>
          </div>
          <div className="ink hard mt-3 min-w-0 rounded-[18px] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Listings with a price read, per week, last 12 weeks</p>
            <div className="mt-4">
              <AdminColumns title="Listings with a price read, per week, last 12 weeks" unit="listing" emptyText="No price has been read in the last 12 weeks."
                points={catalog.weekly.map(w => ({ label: `week of ${shortDay(w.week)}`, value: w.listings }))}
                startLabel={`week of ${shortDay(catalog.weekly[0]!.week)}`} endLabel={`week of ${shortDay(catalog.weekly[catalog.weekly.length - 1]!.week)}`} />
            </div>
          </div>
        </div>
      )}

      {/* ── Collection: is the data still being gathered. ── */}
      <SectionHead id="collection" eyebrow="Collection" title="Is the data being collected">
        The collectors that read vendor pages and lab feeds, and the storefronts they cannot read.
      </SectionHead>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Store} value={counts.vendors} label="Vendors collected from" sub={`${counts.graded} graded`} />
        <Stat icon={MousePointerClick} value={counts.due} label="Collection queue due now" sub="drains every 15 minutes" />
        <Stat
          icon={Link2}
          value={String(broken.length)}
          label="Broken collectors"
          sub={broken.length ? broken.map(b => b.target).slice(0, 3).join(", ") : "every source that yielded data still does"}
        />
      </div>
      <h3 className={SUB}>Collectors needing attention</h3>
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
      <h3 className={SUB}>Storefronts that cannot be graded</h3>
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
            {coverage.counts.flagged > 0 && <>{" "}<span className="font-bold text-[#111214]">{coverage.counts.flagged}</span> are red-flagged and deliberately excluded from every collector &mdash; nothing polls them at all, and no import flag would change that.</>}
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
                  <tr key={row.slug} className={row.state === "no-method" ? "bg-[#fff4e0]" : row.state === "flagged" ? "bg-[#f3f3f3]" : undefined}>
                    <td className="px-5 py-3 font-bold">{row.name}</td>
                    <td className="px-5 py-3 text-xs font-bold">
                      {row.state === "no-method" ? "Curated, but no import method" : row.state === "uncurated" ? "Never curated" : row.state === "flagged" ? "Red-flagged — not collected at all" : "Collector has not succeeded yet"}
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums">{row.coaCount || "—"}</td>
                    <td className="px-5 py-3 text-xs text-[var(--muted)]">
                      {/* The note is what a probe actually found. Without it this column could only
                          repeat the generic instruction, and the next person would re-probe a
                          storefront we already know answers 401. */}
                      {row.note ?? (row.state === "no-method" ? "Identify how its catalogue can be read, then set the flag in known-vendors.json" : row.state === "uncurated" ? "Add it to known-vendors.json with a domain" : row.state === "flagged" ? "Nothing — it is excluded on purpose. Clearing the red flag would re-enable collection." : "See the attention table above")}
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

      <h3 className={SUB}>Collectors</h3>
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

      {/* ── Accounts: administration, deliberately NOT analytics. The privacy notice promises that
          analytics records carry no account identifier, so nothing here is joined to what anyone
          read — and the stored IP/user-agent hashes are counted but never shown. ── */}
      <SectionHead id="accounts" eyebrow="Accounts" title="Staff accounts and sign-ins">
        Who holds an account, and who has signed in. New reader accounts are closed, so the email list above is the
        site&rsquo;s signup now; what is listed here is staff and the reader accounts made before that. It is never joined
        to what anyone read, and the IP and device hashes kept for session security are deliberately not shown.
      </SectionHead>
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


      {/* ── Shop era: kept, not deleted. These are real recorded figures from when the site sent
          readers to sellers. Purchase referrals and /verify answer HTTP 410 now, so nothing here can grow. ── */}
      <SectionHead id="historical" eyebrow="Shop era" title="Historical referral figures">
        VialGrade no longer sends readers to sellers or takes orders, so these numbers cannot change. They are what was
        recorded before referrals were switched off, kept for the record.
      </SectionHead>
      <details className="mt-4" data-testid="admin-historical">
        <summary className="ink-1 w-fit cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-bold hover:bg-[#eef0ff]">Show the recorded figures</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={MousePointerClick} value={totals.clicks.toLocaleString()} label="Clicks to a vendor" sub={`from ${totals.clickers.toLocaleString()} ${totals.clickers === 1 ? "reader" : "readers"}`} />
          <Stat icon={Link2} value={String(totals.vendors)} label="Vendors that received them" />
          <Stat icon={ArrowUpRight} value={String(totals.conversions)} label="Confirmed orders" sub={totals.conversions === 0 ? "none reported back" : "reported back by a partner"} />
          <Stat icon={Database} value={money(totals.revenueCents)} label="Revenue recorded" sub={totals.revenueCents === 0 ? "none recorded" : undefined} />
        </div>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
          {visitors.readerDays === 0
            ? "No reader traffic is on record in the last 30 days, so there is no click-through rate to state."
            : `${Math.round(clickThroughRate * 100)}% of recorded readers clicked through to a vendor: ${totals.clickers.toLocaleString()} of ${visitors.readerDays.toLocaleString()}, both counted with a hash that resets daily.`}
          {unmatchedClickers > 0 && ` ${unmatchedClickers} of those clicks came from readers whose view-tracking was blocked.`}
        </p>
        <h3 className={SUB}>Vendors that received traffic</h3>
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
                No outbound clicks were recorded.
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

        <h3 className={SUB}>What readers checked on the old verify page</h3>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
          Every query typed into /verify that resolved to something, most-checked first. The endpoint is paused, so this list is as it stood.
        </p>
      <div className="ink hard mt-4 overflow-x-auto rounded-[18px] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b-2 border-[#111214]/10 text-[11px] uppercase tracking-[.1em] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3">Query</th><th className="px-5 py-3">Checks</th>
              <th className="px-5 py-3">Resolved as</th><th className="px-5 py-3">Last verdict</th>
              <th className="px-5 py-3">First asked</th><th className="px-5 py-3">Last asked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#111214]/10">
            {verifyDemand.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm font-medium text-[var(--muted)]">
                Nothing checked yet. Rows appear the first time someone uses /verify.
              </td></tr>
            )}
            {verifyDemand.map((q) => (
              <tr key={q.display} className={q.kind === "unknown-domain" ? "bg-[#fff6e6]" : undefined}>
                <td className="px-5 py-3 font-mono text-[13px] font-bold">{q.display}</td>
                <td className="px-5 py-3 font-extrabold tabular-nums">{q.checks.toLocaleString()}</td>
                <td className="px-5 py-3">
                  <span className="ink-1 rounded-full bg-[#f2f2ef] px-2 py-1 text-[11px] font-bold uppercase tracking-[.08em]">
                    {q.kind === "unknown-domain" ? "not tracked" : q.kind}
                  </span>
                </td>
                <td className="px-5 py-3 font-semibold">{q.lastVerdict}</td>
                <td className="px-5 py-3 tabular-nums text-[var(--muted)]">{when(q.firstSeenAt)}</td>
                <td className="px-5 py-3 tabular-nums text-[var(--muted)]">{when(q.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </details>
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
