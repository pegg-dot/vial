import { Braces, Cable, ShieldCheck } from "lucide-react";
import { DeveloperTokenClient, type TokenRow } from "@/components/seller/developer-token-client";
import { DeveloperWebhookClient } from "@/components/seller/developer-webhook-client";
import { Panel, SellerPageHeader } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { getSellerContext } from "@/server/seller/ops";

export default async function SellerDeveloperPage() {
  const principal = await requireSellerPermission("seller:tokens:manage");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const db = await getDatabase();
  const [tokenResult, endpointResult, deliveryResult] = await Promise.all([
    db.query(`SELECT id,name,token_prefix,scopes,last_used_at,expires_at,revoked_at,created_at FROM seller_api_tokens WHERE seller_id=$1 ORDER BY created_at DESC`, [context.sellerId]),
    db.query(`SELECT id,url,status,events,secret_prefix,last_delivery_at,failure_count,created_at FROM seller_webhook_endpoints WHERE seller_id=$1 ORDER BY created_at DESC`, [context.sellerId]),
    db.query(`SELECT d.* FROM seller_webhook_deliveries d JOIN seller_webhook_endpoints e ON e.id=d.endpoint_id WHERE e.seller_id=$1 ORDER BY d.created_at DESC LIMIT 25`, [context.sellerId]),
  ]);
  const tokens = tokenResult.rows as TokenRow[];
  const configuration = JSON.stringify({ mcpServers: { vialSeller: { command: "npm", args: ["run", "mcp:seller"], env: { VIAL_MCP_SELLER_TOKEN: "paste-token-here", VIAL_DATABASE_URL: "postgres://…" } } } }, null, 2);
  return <>
    <SellerPageHeader title="Developer" description="Connect automation through scoped APIs or the VIAL Seller MCP. Read and proposal tools are available; publishing and approval remain human-gated." />
    <div className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <Panel title="Scoped API tokens" description="Create least-privilege tokens for an approved seller operator."><DeveloperTokenClient initialTokens={tokens} /></Panel>
      <div className="space-y-6">
        <Panel title="MCP quick start" description="Use the official MCP SDK over stdio for local agents. Streamable HTTP can be added when remote authentication infrastructure is approved.">
          <div className="flex gap-3 rounded-2xl bg-violet-50 p-4"><Braces className="mt-0.5 size-4 text-violet-700" /><p className="text-sm leading-6 text-violet-950/70">Tools can inspect onboarding, list catalog records, propose compound matches, identify evidence gaps, and create reviewable imports.</p></div>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#111214] p-4 text-xs leading-6 text-white/75"><code>{configuration}</code></pre>
        </Panel>
        <Panel title="Safety boundary">
          <div className="space-y-3">{[{ Icon: ShieldCheck, title: "No autonomous publishing", detail: "MCP proposals remain drafts until an authorized user confirms them." }, { Icon: Cable, title: "Tenant-scoped data", detail: "Every token is linked to exactly one seller and a narrow scope list." }].map(({ Icon, title, detail }) => <div key={String(title)} className="flex gap-3 rounded-2xl border border-black/[.06] p-4"><Icon className="mt-0.5 size-4" /><div><p className="text-sm font-semibold">{String(title)}</p><p className="mt-1 text-xs leading-5 text-black/45">{String(detail)}</p></div></div>)}</div>
        </Panel>
      </div>
    </div>
    <div className="mt-6"><Panel title="Outbound webhooks" description="Create signed seller endpoints and test delivery state without calling an external service in sandbox."><DeveloperWebhookClient initialEndpoints={endpointResult.rows as never[]} initialDeliveries={deliveryResult.rows as never[]} /></Panel></div>
  </>;
}
