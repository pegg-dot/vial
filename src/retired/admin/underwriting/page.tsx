import { RefreshCw, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { approvedCommerceDashboard } from "@/server/commerce/activation";
import { decideUnderwritingAction, syncProviderAccountAdminAction } from "../commerce-v5-actions";

function list(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }
  return [];
}

export default async function UnderwritingPage() {
  await requirePermission("commerce:read");
  const dashboard = await approvedCommerceDashboard();
  const accounts = dashboard.accounts as Array<Record<string, unknown>>;
  const reviews = dashboard.underwriting as Array<Record<string, unknown>>;
  return <div>
    <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Approved commerce</p>
    <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Seller underwriting</h1>
    <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Processor capability is necessary but not sufficient. VialGrade separately records seller underwriting, due requirements, risk tier, catalog scope, jurisdictions, and expiration.</p>
    <div className="mt-7 grid gap-4 sm:grid-cols-4">{[["Provider",dashboard.provider],["Mode",dashboard.mode],["Accounts",accounts.length],["Live enabled",dashboard.liveEnabled?"Yes":"No"]].map(([label,value])=><div key={String(label)} className="ink hard rounded-[18px] bg-white p-5"><p className="text-xs font-bold text-[var(--muted)]">{String(label)}</p><p className="mt-2 text-2xl font-extrabold capitalize">{String(value)}</p></div>)}</div>
    <div className="mt-8 space-y-4">{accounts.map((account)=><section key={String(account.id)} className="ink hard rounded-[20px] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-extrabold">{String(account.display_name)}</h2><p className="mt-1 font-mono text-xs text-[var(--muted)]">{String(account.provider_account_id)}</p></div><span className="ink-1 rounded-full bg-[#e9eaff] px-3 py-1 text-xs font-extrabold text-[#2b31d8]">{String(account.underwriting_status)}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-4">{[["Charges",account.charges_enabled],["Payouts",account.payouts_enabled],["Transfers",account.transfers_enabled],["Details",account.details_submitted]].map(([label,value])=><div key={String(label)} className="ink-1 rounded-[12px] bg-[#f7f7f4] p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{String(label)}</p><p className="mt-2 font-bold">{value?"Enabled":"Blocked"}</p></div>)}</div>{list(account.requirements_currently_due).length>0&&<div className="ink-1 mt-4 rounded-[12px] bg-[#fff4e0] p-4 text-sm font-medium text-[#b26a00]">Due: {list(account.requirements_currently_due).join(", ")}</div>}<div className="mt-5 flex flex-wrap gap-3"><form action={syncProviderAccountAdminAction}><input type="hidden" name="sellerId" value={String(account.seller_id)}/><button className="ink-1 hard-sm press rounded-full bg-white px-4 py-2 text-sm font-bold text-[#111214]"><RefreshCw className="mr-2 inline size-4"/>Sync</button></form><form action={decideUnderwritingAction} className="flex flex-wrap gap-2"><input type="hidden" name="sellerId" value={String(account.seller_id)}/><input name="notes" aria-label={`Underwriting notes for ${String(account.display_name)}`} placeholder="Review notes" className="ink-1 rounded-full bg-white px-4 py-2 text-sm font-medium focus:shadow-[3px_3px_0_0_#2b31d8] focus:outline-none"/><button name="status" value="test_approved" className="ink hard-sm press-blue rounded-full bg-[#2b31d8] px-4 py-2 text-sm font-bold text-white"><ShieldCheck className="mr-2 inline size-4"/>Approve test</button><button name="status" value="rejected" className="ink-1 hard-sm press rounded-full bg-white px-4 py-2 text-sm font-bold text-[#d3372c]">Reject</button></form></div></section>)}</div>
    <section className="ink hard mt-8 rounded-[20px] bg-white p-6"><h2 className="text-xl font-extrabold">Review history</h2><div className="mt-4 space-y-3">{reviews.slice(0,20).map((review)=><div key={String(review.id)} className="ink-1 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#f7f7f4] p-4"><div><p className="font-bold">{String(review.display_name)}</p><p className="mt-1 text-xs font-medium text-[var(--muted)]">{new Date(String(review.requested_at)).toLocaleString()} · {String(review.mode)}</p></div><span className="ink-1 rounded-full bg-[#111214] px-3 py-1 text-xs font-bold text-white">{String(review.status)}</span></div>)}</div></section>
  </div>;
}
