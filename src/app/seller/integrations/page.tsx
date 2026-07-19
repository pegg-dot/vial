import { ArrowDownToLine, CheckCircle2, ExternalLink, PlugZap } from "lucide-react";
import { SellerPageHeader, Panel, StatusPill, primaryButton, secondaryButton } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { connectorDefinitions } from "@/server/seller/connectors";
import { getSellerContext } from "@/server/seller/ops";
import { connectIntegrationAction, runCatalogImportAction } from "../actions";

export default async function SellerIntegrationsPage() {
  const principal = await requireSellerPermission("seller:profile:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const connections = new Map(context.integrations.map((row) => [String((row as { provider?: unknown }).provider), row as { status: string; last_synced_at?: string; settings?: unknown }]));
  return <>
    <SellerPageHeader title="Connections" description="Bring your current store into VIAL instead of rebuilding it. Connect once, review the proposed mapping, then keep catalog and inventory synchronized." />
    <div className="mt-7 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {connectorDefinitions.map((definition) => {
        const connection = connections.get(definition.provider);
        const ready = connection && ["connected", "sandbox_ready"].includes(connection.status);
        return <Panel key={definition.provider} className="flex flex-col" action={<StatusPill status={connection?.status ?? "disconnected"} />}>
          <div className="grid size-12 place-items-center rounded-2xl bg-black text-white"><PlugZap className="size-5" /></div>
          <div className="mt-5 flex items-center gap-2"><h2 className="text-xl font-semibold tracking-[-.035em]">{definition.name}</h2>{definition.recommended && <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-violet-700">Recommended</span>}</div>
          <p className="mt-2 min-h-12 text-sm leading-6 text-black/45">{definition.description}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">{definition.capabilities.map((capability) => <span key={capability} className="rounded-full bg-black/[.045] px-2.5 py-1 text-[10px] font-medium text-black/55">{capability}</span>)}</div>
          <div className="mt-auto pt-6">
            {!ready ? <form action={connectIntegrationAction}><input type="hidden" name="provider" value={definition.provider} />{["shopify", "woocommerce", "website"].includes(definition.provider) && <input className="field mb-3" name="storeUrl" aria-label={`${definition.name} store URL`} placeholder={definition.provider === "shopify" ? "store.myshopify.com" : "https://store.example.com"} />}<button className={`${primaryButton} w-full`}>Connect in sandbox</button></form> : <div className="space-y-3"><div className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="size-4" />Connection ready</div>{["shopify", "woocommerce", "csv", "website"].includes(definition.provider) && <form action={runCatalogImportAction}><input type="hidden" name="provider" value={definition.provider} /><button className={`${secondaryButton} w-full`}><ArrowDownToLine className="mr-2 size-4" />Create dry-run import</button></form>}</div>}
          </div>
        </Panel>;
      })}
    </div>
    <div className="mt-6 rounded-[26px] border border-violet-100 bg-violet-50 p-6"><div className="flex gap-4"><ExternalLink className="size-5 shrink-0 text-violet-700" /><div><h2 className="font-semibold text-violet-950">Production integration strategy</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-violet-900/65">Use embedded or hosted processor onboarding for identity requirements, OAuth for Shopify, API credentials plus signed webhooks for WooCommerce, and VIAL’s MCP server only for scoped AI-assisted proposals. Production credentials remain disabled in this release.</p></div></div></div>
  </>;
}
