import { Activity, CircleAlert, PackageCheck, ShieldCheck } from "lucide-react";
import { Panel, ReadinessRow, SellerPageHeader, StatCard, StatusPill } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext } from "@/server/seller/ops";

export default async function SellerHealthPage() {
  const principal = await requireSellerPermission("seller:analytics:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const readiness = context.readiness as { overall_state?: unknown; completion_percent?: unknown; dimensions?: unknown; blockers?: unknown; warnings?: unknown } | null;
  const dimensions = Array.isArray(readiness?.dimensions) ? readiness.dimensions as Array<{ key: string; label: string; score: number; status: string; detail: string }> : [];
  const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers as string[] : [];
  const warnings = Array.isArray(readiness?.warnings) ? readiness.warnings as string[] : [];
  const products = context.products.map((row) => row as Record<string, unknown>);
  const lowStock = products.filter((row) => Number(row.inventory ?? 0) <= 5).length;
  const confirmedLinks = context.evidenceLinks.filter((row) => String((row as Record<string, unknown>).status) === "confirmed").length;
  const evidenceCoverage = products.length ? Math.round(confirmedLinks / products.length * 100) : 0;
  return <>
    <SellerPageHeader title="Marketplace health" description="A dimensional operating view of readiness, evidence, fulfillment, and policy standing. No opaque seller trust score." action={<StatusPill status={String(readiness?.overall_state ?? "blocked")} />} />
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Onboarding readiness" value={`${Number(readiness?.completion_percent ?? 0)}%`} detail="Across eight independent dimensions" tone="violet" />
      <StatCard label="Confirmed evidence links" value={confirmedLinks} detail={`${evidenceCoverage}% of products`} />
      <StatCard label="Low-stock products" value={lowStock} detail="Five or fewer available units" />
      <StatCard label="Open disputes" value={context.disputes.length} detail="Seller-scoped commerce cases" tone="dark" />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <Panel title="Readiness dimensions">{dimensions.map(({ key, ...item }) => <ReadinessRow key={key} {...item} />)}</Panel>
      <div className="space-y-6">
        <Panel title="Current interventions" description="The system explains exactly what needs attention.">
          <div className="space-y-3">{[...blockers, ...warnings].length ? [...blockers, ...warnings].map((message, index) => <div key={`${message}-${index}`} className="ink-1 flex gap-3 rounded-[14px] bg-[#fff4e0] p-4"><CircleAlert className="mt-0.5 size-4 shrink-0 text-[#b26a00]" /><p className="text-sm leading-5 text-[#b26a00]">{message}</p></div>) : <div className="ink-1 flex gap-3 rounded-[14px] bg-[#e6fbf4] p-4"><ShieldCheck className="size-4 text-[#0e8f80]" /><p className="text-sm text-[#0e8f80]">No current readiness blockers.</p></div>}</div>
        </Panel>
        <Panel title="Operational standing">
          {[{ label: "Catalog sync", status: context.integrations.some((row) => ["connected", "sandbox_ready"].includes(String((row as Record<string, unknown>).status))) ? "ready" : "attention", Icon: Activity }, { label: "Order operations", status: context.orders.length ? "active" : "no activity", Icon: PackageCheck }].map(({ label, status, Icon }) => <div key={String(label)} className="flex items-center gap-3 border-b border-[#111214]/10 py-4 last:border-0"><Icon className="size-4" /><span className="flex-1 text-sm font-medium">{String(label)}</span><StatusPill status={String(status)} /></div>)}
        </Panel>
      </div>
    </div>
  </>;
}
