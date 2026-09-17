import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MousePointerClick, Users, Eye, Repeat } from "lucide-react";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { getDailySeries, getSourceBreakdown, getVendorClickBreakdown, getCompoundClickBreakdown } from "@/server/analytics/daily";
import { DailyBars } from "@/components/admin/daily-bars";

export const dynamic = "force-dynamic";
export const metadata = { title: "Traffic" };

const VIOLET = "#2b31d8";
const TEAL = "#0e8f80";

const RANGES = [7, 30, 90] as const;

function Stat({ icon: Icon, value, label, sub }: { icon: typeof Users; value: string; label: string; sub: string }) {
  return (
    <div className="ink hard rounded-[18px] bg-white p-5">
      <Icon className="size-5 text-[#2b31d8]" />
      <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-[-.04em]">{value}</p>
      <p className="mt-1 text-sm font-bold">{label}</p>
      <p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{sub}</p>
    </div>
  );
}

function Breakdown({ title, note, rows, unit }: { title: string; note: string; rows: { label: string; people: number; events: number }[]; unit: string }) {
  const max = Math.max(...rows.map(r => r.events), 1);
  return (
    <div className="ink hard rounded-[18px] bg-white p-5">
      <h3 className="text-sm font-extrabold tracking-[-.01em]">{title}</h3>
      <p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{note}</p>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-[12px] border-2 border-dashed border-[#111214]/20 px-4 py-5 text-center text-xs font-semibold text-[var(--muted)]">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map(r => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-bold">{r.label}</span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">
                  <span className="font-extrabold text-[#111214]">{r.events.toLocaleString()}</span> {unit} · {r.people.toLocaleString()} readers
                </span>
              </div>
              {/* The bar is a second reading of the same number, not the only one — the value is
                  printed beside it, so nothing here depends on judging a length by eye. */}
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#111214]/8">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.events / max) * 100)}%`, background: VIOLET }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const principal = await getCurrentPrincipal();
  if (!principal || principal.accountType !== "staff") redirect("/admin/login?next=%2Fadmin%2Fanalytics");

  const requested = Number((await searchParams).days ?? 30);
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30;

  const [series, sources, vendors, compounds] = await Promise.all([
    getDailySeries({ days }),
    getSourceBreakdown({ days }),
    getVendorClickBreakdown({ days }),
    getCompoundClickBreakdown({ days }),
  ]);

  const pick = (key: keyof typeof series.points[number]) => series.points.map(p => ({ day: p.day, value: Number(p[key]) }));
  const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[#2b31d8] hover:underline"><ArrowLeft className="size-4" /> Admin</Link>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-.045em]">Traffic, day by day</h1>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
        Every number here is bucketed by counting day &mdash; the day boundary is 4am Eastern, not midnight UTC, so one
        evening&rsquo;s reading is never split into two days. Bots are excluded throughout.
      </p>

      {/* One row of controls above the charts, which is where a filter belongs. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {RANGES.map(r => (
          <Link
            key={r}
            href={`/admin/analytics?days=${r}`}
            className={`ink-1 press rounded-full px-4 py-2 text-xs font-bold ${r === days ? "bg-[#111214] text-white" : "bg-white"}`}
          >
            Last {r} days
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Eye} value={series.totals.views.toLocaleString()} label="Page views" sub={`${series.pagesPerReader.toFixed(1)} pages per reader`} />
        <Stat icon={Users} value={series.totals.readerDays.toLocaleString()} label="Reader-days" sub="Not people — see the note below" />
        <Stat icon={MousePointerClick} value={series.totals.clicks.toLocaleString()} label="Clicks to vendors" sub={`${(series.clickThroughRate * 100).toFixed(1)}% of readers clicked through`} />
        <Stat icon={Repeat} value={series.totals.conversions.toLocaleString()} label="Confirmed orders" sub={series.totals.revenueCents > 0 ? `${money(series.totals.revenueCents)} reported` : "No vendor has reported revenue yet"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DailyBars heading="Readers" note="Distinct people each day. Bots excluded." points={pick("readers")} accent={VIOLET} />
        <DailyBars heading="Page views" note="Every page a reader opened." points={pick("views")} accent={VIOLET} />
        <DailyBars heading="Readers who came back the same day" note="More than one page view in the day — the only repeat this data can see." points={pick("returningWithinDay")} accent={VIOLET} />
        <DailyBars heading="Clicks to vendors" note="Every “Buy at vendor” handoff." points={pick("clicks")} accent={TEAL} />
      </div>

      {/* The limit is stated where the numbers are, not in a doc nobody opens. */}
      <div className="ink hard-sm mt-4 rounded-[18px] bg-[#fff6e6] p-5">
        <h2 className="text-sm font-extrabold">Why there is no “returning visitors” chart</h2>
        <p className="mt-2 max-w-4xl text-[13px] font-medium leading-6 text-[#111214]/75">
          A reader is counted with a hash of their address and browser, salted with the day. Tomorrow the same person
          hashes differently, on purpose &mdash; it is enough to say &ldquo;41 people read us today&rdquo; and never enough to follow one
          person around or build a profile. So the totals above are <strong>reader-days</strong>: someone who visits on three
          days counts three times, and nothing here can tell you whether today&rsquo;s readers are yesterday&rsquo;s.
          Same-day repeats are the one exception, charted above.
        </p>
        <p className="mt-2 max-w-4xl text-[13px] font-medium leading-6 text-[#111214]/75">
          Cross-day returning readers would need the salt to stop rotating daily. That is a real trade &mdash; it makes the
          hash a durable pseudonymous identifier &mdash; so it is a decision to take deliberately, not a chart to add.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Breakdown title="Where readers come from" note="By distinct readers, so one noisy referrer cannot dominate." rows={sources} unit="views" />
        <Breakdown title="Vendors readers click through to" note="The number a partner conversation opens with." rows={vendors} unit="clicks" />
        <Breakdown title="Compounds that pull the clicks" note="What to deepen coverage on next." rows={compounds} unit="clicks" />
      </div>
    </div>
  );
}
