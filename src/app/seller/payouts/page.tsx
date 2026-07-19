import { Banknote } from "lucide-react";
import { SellerPageHeader, Panel, StatCard, StatusPill } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import { getSellerContext } from "@/server/seller/ops";

export default async function SellerPayoutsPage() {
  const principal = await requireSellerPermission("seller:finance:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const entries = context.ledger as Array<Record<string, unknown>>;
  const payable = entries.filter((entry) => entry.entry_type === "seller_payable").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const refunds = entries.filter((entry) => String(entry.entry_type).includes("refund")).reduce((sum, entry) => sum + Math.abs(Number(entry.amount)), 0);
  const db = await getDatabase();
  const payouts = (await db.query(`SELECT * FROM commerce_payouts WHERE seller_id=$1 ORDER BY created_at DESC`, [context.sellerId])).rows as Array<Record<string, unknown>>;
  return <><SellerPageHeader title="Payouts" description="Ledger-derived seller balances, reserves, and sandbox payout history. Production money movement remains disabled." />
    <div className="mt-7 grid gap-4 sm:grid-cols-3"><StatCard label="Seller payable" value={`$${payable.toFixed(2)}`} tone="dark" /><StatCard label="Refund deductions" value={`$${refunds.toFixed(2)}`} /><StatCard label="Processor status" value="Sandbox" detail="No real funds moved" tone="violet" /></div>
    <Panel title="Payout history" className="mt-6">{payouts.length ? <div className="space-y-3">{payouts.map((payout) => <div key={String(payout.id)} className="flex items-center gap-4 rounded-2xl border p-4"><div className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Banknote className="size-4" /></div><div className="flex-1"><p className="font-medium">${Number(payout.amount).toFixed(2)}</p><p className="text-xs text-black/40">{new Date(String(payout.created_at)).toLocaleDateString()}</p></div><StatusPill status={String(payout.status)} /></div>)}</div> : <p className="text-sm text-black/45">No payout records. Sandbox sales remain in the internal ledger.</p>}</Panel>
  </>;
}
