import { ShieldAlert } from "lucide-react";
import { Panel, primaryButton, SellerPageHeader, StatusPill } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext } from "@/server/seller/ops";
import { submitSellerDisputeEvidenceAction } from "../actions";

export default async function SellerDisputesPage() {
  const principal = await requireSellerPermission("seller:orders:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  return <><SellerPageHeader title="Disputes" description="Review sandbox cases, evidence deadlines, and seller responses scoped to your own order allocations." />
    <div className="mt-7 space-y-4">{context.disputes.length ? context.disputes.map((row) => { const dispute = row as Record<string, unknown>; const open=!['won','lost','closed'].includes(String(dispute.status)); return <Panel key={String(dispute.id)} action={<StatusPill status={String(dispute.status)} />}><div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]"><div className="flex gap-4"><div className="ink-1 grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#fff1f0] text-[#d3372c]"><ShieldAlert className="size-5" /></div><div><h2 className="font-extrabold">{String(dispute.reason || "Dispute")}</h2><p className="mt-1 text-sm font-medium text-[var(--muted)]">Amount ${Number(dispute.amount).toFixed(2)} · Order {String(dispute.order_id)}</p><p className="mt-3 text-xs text-[var(--muted)]">Evidence due {String(dispute.evidence_due_at || "Not set")}</p></div></div>{open&&<form action={submitSellerDisputeEvidenceAction} className="grid gap-3"><input type="hidden" name="disputeId" value={String(dispute.id)} /><label className="text-xs font-semibold text-[var(--muted)]">Evidence type<select className="field mt-2" name="evidenceType"><option value="fulfillment">Fulfillment</option><option value="customer_communication">Customer communication</option><option value="refund_policy">Refund policy</option></select></label><label className="text-xs font-semibold text-[var(--muted)]">Response<textarea className="field mt-2 min-h-24" name="content" required placeholder="Describe the relevant seller record." /></label><button className={`${primaryButton} w-fit`}>Submit evidence</button></form>}</div></Panel>; }) : <Panel><p className="text-sm font-medium text-[var(--muted)]">No disputes for this seller.</p></Panel>}</div>
  </>;
}
