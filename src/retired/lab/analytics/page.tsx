import type { Metadata } from "next";
import { FileCheck2, FlaskConical, Boxes, ShieldCheck } from "lucide-react";
import { requirePrincipal } from "@/server/auth/principal";
import { getLaboratoryContext, getLaboratoryAnalytics } from "@/server/evidence-network/repository";

export const metadata: Metadata = { title: "Laboratory analytics" };
export const dynamic = "force-dynamic";

const n = (v: unknown) => Number(v ?? 0);

export default async function LabAnalyticsPage() {
  const principal = await requirePrincipal({ accountTypes: ["laboratory"] });
  const context = await getLaboratoryContext(principal.email);
  if (!context) {
    return <main className="mx-auto max-w-5xl px-5 py-14"><h1 className="text-3xl font-extrabold">Laboratory analytics</h1><p className="mt-4 text-[var(--muted)] font-medium">No laboratory is associated with this account.</p></main>;
  }
  const lab = context.lab as Record<string, unknown>;
  const { totals, orderStatus } = await getLaboratoryAnalytics(String(lab.id));
  const issueRate = n(totals.total_reports) > 0 ? Math.round((n(totals.issued_reports) / n(totals.total_reports)) * 100) : 100;
  const methodCoverage = n(totals.total_methods) > 0 ? Math.round((n(totals.validated_methods) / n(totals.total_methods)) * 100) : 0;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#0e8f80]">Laboratory operations</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">{String(lab.display_name ?? "Laboratory")} analytics</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">Throughput, report integrity, method coverage, and chain-of-custody activity across your accessioned work.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Metric icon={FileCheck2} value={String(n(totals.issued_reports))} label="Issued reports" sub={`${n(totals.revoked_reports)} revoked · ${issueRate}% issue rate`} />
        <Metric icon={Boxes} value={String(n(totals.total_orders))} label="Test orders" sub={`${n(totals.total_samples)} samples accessioned`} />
        <Metric icon={FlaskConical} value={`${methodCoverage}%`} label="Method coverage" sub={`${n(totals.validated_methods)}/${n(totals.total_methods)} validated`} />
        <Metric icon={ShieldCheck} value={String(n(totals.custody_events))} label="Custody events" sub="Hash-chained handoffs" />
      </div>

      <section className="mt-6 overflow-hidden ink hard rounded-[20px] bg-white">
        <div className="border-b-2 border-[#111214]/10 p-6">
          <h2 className="text-xl font-extrabold tracking-[-.03em]">Test order status mix</h2>
          <p className="mt-2 text-xs font-medium text-[var(--muted)]">Where your accessioned work currently sits in the pipeline.</p>
        </div>
        <div className="divide-y divide-black/[.06]">
          {orderStatus.map((row) => {
            const pct = n(totals.total_orders) > 0 ? (n(row.n) / n(totals.total_orders)) * 100 : 0;
            return (
              <div key={row.status} className="flex items-center gap-4 px-6 py-4">
                <span className="w-40 font-mono text-xs capitalize">{String(row.status).replaceAll("_", " ")}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6fbf4]"><div className="h-full rounded-full bg-[#12b3a6]" style={{ width: `${Math.max(pct, 3)}%` }} /></div>
                <span className="w-12 text-right font-mono text-xs tabular-nums">{n(row.n)}</span>
              </div>
            );
          })}
          {orderStatus.length === 0 && <p className="px-6 py-8 text-center text-xs text-[var(--muted)]">No test orders yet.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, value, label, sub }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string; sub: string }) {
  return <div className="ink-1 hard rounded-[18px] bg-white p-5"><Icon className="size-4 text-[#0e8f80]" /><p className="mt-5 text-3xl font-extrabold tracking-[-.055em] tabular-nums">{value}</p><p className="mt-1 text-xs font-bold">{label}</p><p className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">{sub}</p></div>;
}
