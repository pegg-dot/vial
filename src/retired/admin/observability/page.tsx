import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Gauge, RefreshCw } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { getOperationalDashboard } from "@/server/observability/metrics";

export const metadata: Metadata = { title: "Observability" };
export const dynamic = "force-dynamic";

function value(metric: Awaited<ReturnType<typeof getOperationalDashboard>>["metrics"][number]) {
  if (metric.unit === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(metric.value);
  if (metric.unit === "milliseconds") return `${metric.value} ms`;
  if (metric.unit === "percent") return `${metric.value}%`;
  return new Intl.NumberFormat("en-US").format(metric.value);
}

export default async function ObservabilityPage() {
  await requirePermission("security:read");
  const dashboard = await getOperationalDashboard();
  return <div>
    <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Platform reliability</p>
    <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-extrabold tracking-[-.05em]">Observability</h1><p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Operational thresholds are derived from durable marketplace records. Alerts remain open until the underlying condition recovers or an operator resolves them.</p></div><span className="ink-1 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold"><RefreshCw className="size-3.5"/>Live snapshot</span></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{dashboard.metrics.map(metric=><div key={metric.key} className="ink hard rounded-[18px] bg-white p-5"><div className="flex items-center justify-between"><Gauge className="size-4 text-[#2b31d8]"/><span className={`ink-1 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase ${metric.severity==="critical"?"bg-[#fff1f0] text-[#d3372c]":metric.severity==="warning"?"bg-[#fff4e0] text-[#b26a00]":"bg-[#e6fbf4] text-[#0e8f80]"}`}>{metric.severity}</span></div><p className="mt-6 text-3xl font-extrabold tracking-[-.05em] tabular-nums">{value(metric)}</p><p className="mt-2 text-sm font-bold">{metric.label}</p><p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{metric.detail}</p></div>)}</div>
    <section className="ink hard mt-8 rounded-[20px] bg-white p-6"><h2 className="text-2xl font-extrabold tracking-[-.04em]">Durable alerts</h2><div className="mt-5 space-y-3">{dashboard.alerts.map(alert=><article key={alert.id} className="ink-1 flex flex-col justify-between gap-3 rounded-[12px] bg-white p-4 sm:flex-row sm:items-center"><div className="flex gap-3">{alert.status==="resolved"?<CheckCircle2 className="mt-0.5 size-4 text-[#0e8f80]"/>:<AlertTriangle className={`mt-0.5 size-4 ${alert.severity==="critical"?"text-[#d3372c]":"text-[#b26a00]"}`}/>}<div><p className="text-sm font-bold">{alert.title}</p><p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{alert.summary}</p></div></div><div className="text-right"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">{alert.status}</p><p className="mt-1 text-[10px] font-medium text-[var(--muted)]">{new Date(alert.updated_at).toLocaleString()}</p></div></article>)}{dashboard.alerts.length===0&&<p className="py-8 text-center text-sm font-medium text-[var(--muted)]">No operational alerts.</p>}</div></section>
  </div>;
}
