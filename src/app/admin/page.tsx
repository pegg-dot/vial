import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Database, FlaskConical, KeyRound, Link2, MousePointerClick, ShieldAlert, Users } from "lucide-react";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { getAttributionOverview } from "@/server/outbound/partner-report";
import { getDataFreshness, getBrokenCollectors } from "@/server/health/data-health";
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
  const [attribution, visitors, people, freshness, broken, counts, collectors] = await Promise.all([
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
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Admin</p>
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
