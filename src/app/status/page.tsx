import type { Metadata } from "next";
import { SWEEP_STALE_HOURS, getNotificationSweepHealth, isSweepHealthy, isSweepKeepingUp } from "@/server/notifications/sweep";
import { AlertTriangle, BellRing, CheckCircle2, Database, RadioTower, ShieldCheck, Timer, XCircle } from "lucide-react";
import { getRefreshMetrics } from "@/server/refresh/repository";
import { getIntelligenceMetrics } from "@/server/intelligence/repository";
import { checkReadiness } from "@/server/health/readiness";
import { getCollectionMetrics, isKeepingUp, describeWait, LATENESS_DEGRADED } from "@/server/collect/metrics";

export const metadata: Metadata = { title: "System status", alternates: { canonical: "/status" } };
export const dynamic = "force-dynamic";

/**
 * The status page used to be incapable of reporting an outage.
 *
 * It hardcoded "All systems operational" and "Catalog: Working" — and then queried the database for
 * the other two cards. So during a real database outage it did both wrong things at once: it threw a
 * 500 (because the query failed) while the markup it was trying to render asserted that everything
 * was fine. The one page whose entire job is to tell you the truth during an incident was the page
 * that could only ever claim there wasn't one.
 *
 * Two changes. First, the headline is derived from the same readiness probe `/api/health/ready`
 * serves, so the page and the health endpoint cannot disagree. Second, every read here is allowed to
 * fail into a rendered state rather than an exception — following the pattern the homepage and the
 * catalog pages were given (`components/home-data-unavailable.tsx`), except that this page does not
 * hide behind a generic notice: an outage is the content it exists to publish, so it names it.
 *
 * A subsystem that cannot be read reports "Not reporting" and never a number. "0 queued" during an
 * outage is a lie with the confident shape of a measurement.
 */
export default async function StatusPage() {
  // checkReadiness never throws — an unreachable database is a result, not an exception.
  const readiness = await checkReadiness();
  const online = readiness.database === "reachable";
  const [refresh, intel, collect, sweep] = online
    ? await Promise.all([
        getRefreshMetrics().catch((error) => { console.error("[status] refresh metrics unavailable:", error); return null; }),
        getIntelligenceMetrics().catch((error) => { console.error("[status] intelligence metrics unavailable:", error); return null; }),
        getCollectionMetrics().catch((error) => { console.error("[status] collection metrics unavailable:", error); return null; }),
        getNotificationSweepHealth().catch((error) => { console.error("[status] notification sweep unavailable:", error); return null; }),
      ])
    : [null, null, null, null];

  // A starving queue is an outage with none of an outage's symptoms: every tick succeeds, nothing
  // errors, and the data quietly goes stale. Until this line the page could not have said so.
  const collectorsBehind = collect ? !isKeepingUp(collect) : false;
  // Same question of the refresh queue. Sizing it correctly depends on the live listing count,
  // which was misread once already — so the page reports being behind rather than relying on the
  // arithmetic having been right.
  const refreshBehind = refresh ? refresh.worstLateness !== null && refresh.worstLateness >= LATENESS_DEGRADED : false;

  const banner =
    readiness.status === "not_ready"
      ? { Icon: XCircle, tone: "#ff9d94", shadow: "hard", text: "Major outage — the database is unreachable" }
      : readiness.status === "degraded"
        ? { Icon: AlertTriangle, tone: "#ffd479", shadow: "hard", text: `Degraded — database schema is at ${readiness.schema.actual}, expected ${readiness.schema.expected}` }
        : !(refresh && intel && collect && sweep)
          ? { Icon: AlertTriangle, tone: "#ffd479", shadow: "hard", text: "Degraded — one or more subsystems are not reporting" }
          : collect.enabled === 0
            ? { Icon: AlertTriangle, tone: "#ffd479", shadow: "hard", text: "Degraded — no collectors are registered, so nothing is being gathered" }
            : collectorsBehind
              ? { Icon: AlertTriangle, tone: "#ffd479", shadow: "hard", text: `Degraded — collectors are behind; the oldest source has waited ${describeWait(collect.oldestOverdueMinutes ?? 0)} past its schedule` }
              : refresh.enabled === 0
                ? { Icon: AlertTriangle, tone: "#ffd479", shadow: "hard", text: "Degraded — no sources are enabled, so nothing is being refreshed" }
                : refreshBehind
                  ? { Icon: AlertTriangle, tone: "#ffd479", shadow: "hard", text: `Degraded — the refresh queue is behind; the worst source is ${Math.round(refresh.worstLateness ?? 0)}x its own interval late` }
                  // A card reading "25 failed" under a green "All systems operational" banner is the
                  // precise contradiction this page exists to prevent — it used to hardcode the
                  // headline while querying for the cards, and could only ever claim there was no
                  // outage. The headline has to move with the numbers.
                  : refresh.failed > 0
                    ? { Icon: AlertTriangle, tone: "#ffd479", shadow: "hard", text: `Degraded — ${refresh.failed} refresh ${refresh.failed === 1 ? "job has" : "jobs have"} failed` }
                    : !isSweepHealthy(sweep)
                      ? { Icon: AlertTriangle, tone: "#ffd479", shadow: "hard", text: sweep.lastRanAt === null ? "Degraded — the alert sweep has never run, so nobody is being notified while they are away" : !sweep.lastOk ? "Degraded — the alert sweep failed on one or more readers" : "Degraded — the alert sweep has not completed on schedule" }
                      // Not a fault, and it must not be phrased as one: the sweep ran, succeeded,
                      // and is simply too small for the number of readers now subscribed. Stopping
                      // on the budget USED to be recorded as a failure, so this page announced a
                      // broken sweep on every healthy tick. The honest complaint is coverage.
                      : !isSweepKeepingUp(sweep)
                        ? { Icon: AlertTriangle, tone: "#ffd479", shadow: "hard", text: `Degraded — the alert sweep is behind; ${sweep.backlogReaders} subscribed readers were not reached on its last tick` }
                : { Icon: CheckCircle2, tone: "#8fffd6", shadow: "hard-mint", text: "All systems operational" };

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-16 sm:px-8 sm:py-24">
      <div className={`ink ${banner.shadow} rounded-[20px] bg-[#111214] p-7 text-white sm:p-10`}>
        <div className="flex items-center gap-3">
          <banner.Icon className="size-5 shrink-0" style={{ color: banner.tone }} />
          <p className="text-sm font-bold">{banner.text}</p>
        </div>
        <h1 className="mt-8 text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">System status</h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
          Whether the parts of VialGrade that gather and serve this data are working right now.
        </p>
        <p className="mt-4 text-xs font-medium text-white/40">
          Checked {new Date(readiness.time).toUTCString()} · readiness probe answered in {readiness.latencyMs}ms
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={Database}
          title="Catalog"
          value={online ? "Working" : "Unavailable"}
          detail={online ? "Prices, vendors and lab tests are being served" : "The catalogue cannot be read right now"}
          ok={online}
        />
        <Card
          icon={RadioTower}
          title="Refresh engine"
          value={refresh ? `${refresh.enabled} enabled` : "Not reporting"}
          detail={
            !refresh
              ? "No figures available while this subsystem is unreadable"
              : refresh.enabled === 0
                ? "No sources are enabled — nothing is being refreshed"
                : refreshBehind
                  ? `${refresh.due} due · worst is ${Math.round(refresh.worstLateness ?? 0)}x its interval late`
                  // Failures have to be on the face of this card. "0 queued · 25 stale" is what a
                  // queue looks like when nothing has run AND what it looks like when every job
                  // ran and failed — last_succeeded_at stays null either way. Those are opposite
                  // problems and the card could not tell them apart.
                  : refresh.failed > 0
                    ? `${refresh.failed} failed · ${refresh.queued} queued · ${refresh.stale} stale`
                    : `${refresh.queued} queued · ${refresh.stale} stale`
          }
          ok={refresh !== null && refresh.enabled > 0 && !refreshBehind && refresh.failed === 0}
        />
        <Card
          icon={Timer}
          title="Collectors"
          value={collect ? `${collect.enabled} enabled` : "Not reporting"}
          detail={
            !collect
              ? "No figures available while this subsystem is unreadable"
              : collect.enabled === 0
                ? "Nothing is being gathered — no collectors are registered"
                : collect.overdue === 0
                  ? "Every source is within its schedule"
                  : `${collect.overdue} waiting · oldest ${describeWait(collect.oldestOverdueMinutes ?? 0)} past due`
          }
          ok={Boolean(collect) && !collectorsBehind}
        />
        <Card
          icon={BellRing}
          title="Alerts going out"
          value={!sweep ? "Not reporting" : sweep.lastRanAt === null ? "Never run" : `${sweep.lastSweptUsers} readers`}
          detail={
            !sweep
              ? "No figures available while this subsystem is unreadable"
              : sweep.lastRanAt === null
                ? "The nightly sweep has never run — nobody is being told anything while they are away"
                : !sweep.lastOk
                  ? `Last sweep failed on one or more readers, ${describeWait(Math.round((sweep.hoursSinceLastRun ?? 0) * 60))} ago`
                  : (sweep.hoursSinceLastRun ?? 0) >= SWEEP_STALE_HOURS
                    ? `Last ran ${describeWait(Math.round((sweep.hoursSinceLastRun ?? 0) * 60))} ago — past its daily schedule`
                    // A backlog is what a budget stop actually costs, so it is said as a number of
                    // people rather than hidden inside a red mark on a tick that did its job.
                    : sweep.backlogReaders > 0
                      ? `Last ran ${describeWait(Math.round((sweep.hoursSinceLastRun ?? 0) * 60))} ago · ${sweep.backlogReaders} readers queued for the next tick`
                      : `Last ran ${describeWait(Math.round((sweep.hoursSinceLastRun ?? 0) * 60))} ago`
          }
          ok={sweep !== null && isSweepHealthy(sweep) && isSweepKeepingUp(sweep)}
        />
        <Card
          icon={ShieldCheck}
          title="Intelligence graph"
          value={intel ? `${intel.traces} traces` : "Not reporting"}
          detail={intel ? `${intel.alerts} alerts · ${intel.open} open signals` : "No figures available while this subsystem is unreadable"}
          ok={Boolean(intel)}
        />
      </div>

      <div className="ink-1 hard mt-8 rounded-[18px] bg-white p-6">
        <h2 className="text-xl font-extrabold tracking-[-.03em]">What this page covers</h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">
          This page is about our own site, not about whether a vendor&rsquo;s website is up. Approved
          sources are fetched live over the internet.
        </p>
        <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">
          The headline above is derived from the same readiness check served at{" "}
          <code className="font-mono text-[13px]">/api/health/ready</code> — it is not a fixed message.
          When a subsystem cannot be read this page says so and shows no number for it, rather than
          reporting a zero it cannot stand behind.
        </p>
        <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">
          &ldquo;Collectors&rdquo; is about whether the queue that gathers prices, certificates and
          vendor status is <em>keeping up</em>, not merely whether its last run succeeded. A queue that
          always succeeds and is always behind serves data that is quietly out of date, which is why
          the figure shown is how long the oldest source has waited past its own schedule.
        </p>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, value, detail, ok }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string; detail: string; ok: boolean }) {
  return (
    <div className="ink-1 hard rounded-[18px] bg-white p-5">
      <Icon className={ok ? "size-4 text-[#0e8f80]" : "size-4 text-[#b26a00]"} />
      <p className="mt-6 text-sm font-bold">{title}</p>
      <p className={ok ? "mt-2 text-2xl font-extrabold tracking-[-.045em]" : "mt-2 text-2xl font-extrabold tracking-[-.045em] text-[#b26a00]"}>{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
    </div>
  );
}
