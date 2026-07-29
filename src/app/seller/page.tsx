import Link from "next/link";
import { ArrowRight, CircleAlert, PlugZap, Sparkles } from "lucide-react";
import { SellerPageHeader, Panel, ReadinessRow, StatCard, StatusPill, primaryButton, secondaryButton } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext } from "@/server/seller/ops";

export default async function SellerOverviewPage() {
  const principal = await requireSellerPermission("seller:profile:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const readiness = context.readiness as { completion_percent?: unknown; overall_state?: unknown; dimensions?: unknown; blockers?: unknown } | null;
  const dimensions = Array.isArray(readiness?.dimensions) ? readiness.dimensions as Array<{ key: string; label: string; score: number; status: string; detail: string }> : [];
  const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers as string[] : [];
  const connected = context.integrations.filter((row) => ["connected", "sandbox_ready"].includes(String((row as { status?: unknown }).status))).length;
  const activeProducts = context.products.filter((row) => ["review", "ready", "active"].includes(String((row as { status?: unknown }).status))).length;
  const openOrders = context.orders.filter((row) => !["delivered", "refunded", "cancelled"].includes(String((row as { status?: unknown }).status))).length;
  return <>
    <SellerPageHeader eyebrow="Seller operating system" title={`Good afternoon, ${principal.displayName.split(" ")[0]}.`} description="Everything needed to get your catalog connected, matched, documented, and ready for marketplace review." action={<Link href="/seller/onboarding" className={primaryButton}>Continue onboarding <ArrowRight className="ml-2 size-4" /></Link>} />
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Onboarding readiness" value={`${Number(readiness?.completion_percent ?? 0)}%`} detail={String(readiness?.overall_state ?? "blocked").replaceAll("_", " ")} tone="violet" />
      <StatCard label="Catalog products" value={context.products.length} detail={`${activeProducts} ready or under review`} />
      <StatCard label="Connected systems" value={connected} detail={`${context.integrations.length} available connectors`} />
      <StatCard label="Open orders" value={openOrders} detail={`${context.orders.length} total sandbox orders`} tone="dark" />
    </div>
    {blockers.length > 0 && <div className="ink-1 mt-6 flex gap-3 rounded-[18px] bg-[#fff4e0] p-5 text-[#b26a00]"><CircleAlert className="mt-0.5 size-5 shrink-0" /><div><p className="font-extrabold">Your next best action</p><p className="mt-1 text-sm leading-6">{blockers[0]}</p></div></div>}
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <Panel title="Launch checklist" description="Each dimension stays separate so a complete store connection cannot hide missing evidence or operations details.">
        {dimensions.slice(0, 8).map(({ key, ...item }) => <ReadinessRow key={key} {...item} />)}
      </Panel>
      <div className="space-y-6">
        <Panel title="Self-serve connections" description="Import from an existing store, a CSV, or a public catalog scan.">
          <div className="space-y-3">
            {context.integrations.slice(0, 4).map((row) => { const integration = row as { id: string; display_name: string; provider: string; status: string; last_synced_at?: string }; return <div key={integration.id} className="ink-1 flex items-center gap-3 rounded-[14px] bg-[#fafaf7] p-4"><div className="ink-1 grid size-10 place-items-center rounded-[10px] bg-white"><PlugZap className="size-4" /></div><div className="min-w-0 flex-1"><p className="font-bold">{integration.display_name}</p><p className="truncate text-xs font-medium text-[var(--muted)]">{integration.provider.replaceAll("_", " ")}</p></div><StatusPill status={integration.status} /></div>; })}
          </div>
          <Link href="/seller/integrations" className={`${secondaryButton} mt-5 w-full`}>Manage connections</Link>
        </Panel>
        <Panel title="AI-assisted matching" description="VIAL proposes canonical compound matches, quantities, and evidence relationships. You approve every change.">
          <div className="ink rounded-[16px] bg-[#6d5dfc] p-5 text-white"><Sparkles className="size-5" /><p className="mt-8 text-2xl font-extrabold tracking-[-.04em]">{context.products.filter((row) => Number((row as { match_confidence?: unknown }).match_confidence ?? 0) >= .9).length} high-confidence matches</p><p className="mt-2 text-sm leading-6 text-white/60">No listing is published automatically. Imports remain reviewable drafts.</p></div>
        </Panel>
      </div>
    </div>
  </>;
}
