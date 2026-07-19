import { BarChart3, Eye, Heart, ShoppingCart, Sparkles } from "lucide-react";
import { Panel, SellerPageHeader, StatCard } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext } from "@/server/seller/ops";

export default async function SellerAnalyticsPage() {
  const principal = await requireSellerPermission("seller:analytics:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const rows = context.analytics.map((row) => row as Record<string, unknown>).reverse();
  const total = (key: string) => rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
  const revenue = total("gross_revenue");
  const maxViews = Math.max(1, ...rows.map((row) => Number(row.listing_views ?? 0)));
  const latest = rows.at(-1) ?? {};
  return <>
    <SellerPageHeader title="Analytics" description="Understand discovery, consideration, evidence engagement, and fulfillment without mixing those dimensions into one vanity score." />
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Listing views" value={total("listing_views").toLocaleString()} detail="Last 14 seeded days" />
      <StatCard label="Saves" value={total("saves")} detail="Cross-device watchlist events" tone="violet" />
      <StatCard label="Orders" value={total("orders")} detail={`$${revenue.toFixed(2)} gross sandbox revenue`} />
      <StatCard label="Evidence coverage" value={`${Math.round(Number(latest.evidence_coverage ?? 0) * 100)}%`} detail="Separate from fulfillment and product quality" tone="dark" />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <Panel title="Discovery trend" description="Daily listing views with deterministic, seller-scoped data.">
        <div className="flex h-64 items-end gap-2" role="img" aria-label="Fourteen day listing views chart">
          {rows.map((row) => { const value = Number(row.listing_views ?? 0); return <div key={String(row.metric_date)} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-lg bg-black" style={{ height: `${Math.max(8, value / maxViews * 205)}px` }} title={`${value} views`} /><span className="hidden text-[9px] text-black/35 sm:block">{String(row.metric_date).slice(5)}</span></div>; })}
        </div>
      </Panel>
      <Panel title="Funnel" description="Each conversion step is shown independently.">
        <div className="space-y-4">
          {[
            { label: "Views", value: total("listing_views"), Icon: Eye },
            { label: "Saves", value: total("saves"), Icon: Heart },
            { label: "Comparison adds", value: total("comparison_adds"), Icon: Sparkles },
            { label: "Carts", value: total("carts"), Icon: ShoppingCart },
            { label: "Orders", value: total("orders"), Icon: BarChart3 },
          ].map(({ label, value, Icon }) => <div key={String(label)} className="flex items-center gap-3 rounded-2xl bg-[#fafaf7] p-4"><div className="grid size-9 place-items-center rounded-xl bg-white"><Icon className="size-4" /></div><p className="flex-1 text-sm font-medium">{String(label)}</p><b>{Number(value).toLocaleString()}</b></div>)}
        </div>
      </Panel>
    </div>
  </>;
}
