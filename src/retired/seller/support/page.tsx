import { Headphones, Timer } from "lucide-react";
import { SellerPageHeader, Panel, StatusPill } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { getSellerContext } from "@/server/seller/ops";

export default async function SellerSupportPage() {
  const principal = await requireSellerPermission("seller:support:manage");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const db = await getDatabase();
  const cases = (await db.query(`SELECT * FROM support_cases WHERE seller_id=$1 OR requester_label=$2 ORDER BY created_at DESC`, [context.sellerId, String(context.seller.display_name)])).rows as Array<Record<string, unknown>>;
  return <><SellerPageHeader title="Support" description="Order, customer, evidence, and marketplace cases in one seller-scoped queue." />
    <div className="mt-7 space-y-4">{cases.length ? cases.map((item) => <Panel key={String(item.id)} action={<StatusPill status={String(item.status)} />}><div className="flex items-start gap-4"><div className="ink-1 grid size-11 place-items-center rounded-[14px] bg-[#f0edff] text-[#6d5dfc]"><Headphones className="size-5" /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold">{String(item.subject)}</h2><StatusPill status={String(item.priority)} /></div><p className="mt-1 text-sm font-medium text-[var(--muted)]">{String(item.category).replaceAll("_", " ")} · {String(item.requester_label)}</p><p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted)]"><Timer className="size-3.5" />SLA {String(item.sla_due_at || "Not assigned")}</p></div></div></Panel>) : <Panel><p className="text-sm font-medium text-[var(--muted)]">No open support cases.</p></Panel>}</div>
  </>;
}
