import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { getPartnerReport } from "@/server/outbound/partner-report";
import { partnerCountingNote, partnerHeadline } from "@/server/outbound/partner-claim";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// The one page you send a vendor. Everything on it is a number they can check themselves, because
// a figure a vendor verifies in their own dashboard is worth more than any figure we assert.
export default async function PartnerReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const principal = await getCurrentPrincipal();
  const { slug } = await params;
  if (!principal || principal.accountType !== "staff") redirect(`/admin/login?next=%2Fadmin%2Fpartner%2F${slug}`);

  const report = await getPartnerReport(slug, { days: 30 });
  if (!report) notFound();

  const peak = Math.max(1, ...report.daily.map(d => d.clicks));

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] hover:text-black"><ArrowLeft className="size-4" /> All vendors</Link>

      <h1 className="mt-6 text-4xl font-extrabold tracking-[-.05em]">{report.vendorName}</h1>
      <p className="mt-2 text-sm font-medium text-[var(--muted)]">Last {report.periodDays} days · outbound traffic VialGrade sent</p>

      <div className="ink hard mt-8 rounded-[20px] bg-[#e6fbf4] p-6">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#0e8f80]">The pitch</p>
        <p className="mt-3 text-2xl font-extrabold leading-snug tracking-[-.03em]">
          {partnerHeadline({
            vendorName: report.vendorName,
            clicks: report.clicks,
            visitorDays: report.visitorDays,
            conversions: report.conversions,
            periodDays: report.periodDays,
          })}
        </p>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#0e8f80]">
          These are people who read the lab evidence for a specific product and then chose to click through to you.{" "}
          {partnerCountingNote({ visitorDays: report.visitorDays, periodDays: report.periodDays })} You do not have to
          take our word for any of it — see how to check it below.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Clicks sent", report.clicks.toLocaleString()],
          ["Readers, once a day", report.visitorDays.toLocaleString()],
          ["Products clicked", String(report.listingsClicked)],
          ["Confirmed orders", report.conversions ? String(report.conversions) : "—"],
        ].map(([label, value]) => (
          <div key={label} className="ink hard rounded-[16px] bg-white p-4">
            <p className="text-2xl font-extrabold tabular-nums">{value}</p>
            <p className="mt-1 text-xs font-bold text-[var(--muted)]">{label}</p>
          </div>
        ))}
      </div>

      {report.revenueCents > 0 && (
        <div className="ink hard mt-6 rounded-[18px] bg-[#111214] p-6 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#8fffd6]">Confirmed revenue we drove</p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums">{money(report.revenueCents)}</p>
        </div>
      )}

      {report.daily.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-extrabold tracking-[-.03em]">Daily</h2>
          <div className="ink hard mt-3 flex items-end gap-1 overflow-x-auto rounded-[16px] bg-white p-4" style={{ height: 140 }}>
            {report.daily.map(d => (
              <div key={d.day} title={`${d.day}: ${d.clicks}`} className="min-w-[6px] flex-1 rounded-t bg-[#2b31d8]" style={{ height: `${Math.max(4, (d.clicks / peak) * 100)}%` }} />
            ))}
          </div>
        </>
      )}

      {report.topCompounds.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-extrabold tracking-[-.03em]">What they came for</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.topCompounds.map(c => (
              <span key={c.compound} className="ink-1 rounded-full bg-white px-3 py-1.5 text-sm font-bold">
                {c.compound.replace(/-/g, " ")} <span className="text-[var(--muted)]">· {c.clicks}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {/* This section is the whole reason the report is credible. */}
      <h2 className="mt-10 text-xl font-extrabold tracking-[-.03em]">Check it yourself — don&rsquo;t trust us</h2>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">
        Every link we send you is tagged <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[12px]">utm_source={report.verification.utmSource}</code>.
        It is already in your analytics — we did not need anything from you to make that true.
      </p>
      <ul className="ink hard mt-4 space-y-2 rounded-[16px] bg-white p-5">
        {report.verification.where.map(w => (
          <li key={w} className="flex items-start gap-2 text-sm font-medium leading-6">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0e8f80]" /> {w}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-extrabold tracking-[-.03em]">Making it exact</h2>
      <div className="ink hard mt-3 rounded-[16px] bg-white p-5 text-sm font-medium leading-6">
        <p className="font-bold">Option A — a coupon code (no integration at all)</p>
        <p className="mt-1 text-[var(--muted)]">
          Give us a code. We show it on your listings. Every use is provably ours, and the discount converts better.
          {report.couponCode && <> Current code: <strong className="text-black">{report.couponCode}</strong>.</>}
        </p>
        <p className="mt-4 font-bold">Option B — one HTTP call on order confirmation</p>
        <p className="mt-1 text-[var(--muted)]">
          Our links carry a <code className="rounded bg-black/[.06] px-1 font-mono text-[12px]">vg</code> parameter. Post it back and we
          attribute the exact order — you only ever pay on sales we can both see.
        </p>
      </div>
    </div>
  );
}
