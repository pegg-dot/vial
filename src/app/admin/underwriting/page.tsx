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
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-600">Approved commerce</p>
    <h1 className="mt-2 text-4xl font-semibold tracking-[-.05em]">Seller underwriting</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">Processor capability is necessary but not sufficient. VIAL separately records seller underwriting, due requirements, risk tier, catalog scope, jurisdictions, and expiration.</p>
    <div className="mt-7 grid gap-4 sm:grid-cols-4">{[["Provider",dashboard.provider],["Mode",dashboard.mode],["Accounts",accounts.length],["Live enabled",dashboard.liveEnabled?"Yes":"No"]].map(([label,value])=><div key={String(label)} className="rounded-[22px] border border-black/[.07] bg-white p-5"><p className="text-xs text-black/40">{String(label)}</p><p className="mt-2 text-2xl font-semibold capitalize">{String(value)}</p></div>)}</div>
    <div className="mt-8 space-y-4">{accounts.map((account)=><section key={String(account.id)} className="rounded-[28px] border border-black/[.07] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{String(account.display_name)}</h2><p className="mt-1 font-mono text-xs text-black/40">{String(account.provider_account_id)}</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{String(account.underwriting_status)}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-4">{[["Charges",account.charges_enabled],["Payouts",account.payouts_enabled],["Transfers",account.transfers_enabled],["Details",account.details_submitted]].map(([label,value])=><div key={String(label)} className="rounded-2xl bg-black/[.035] p-4"><p className="text-[10px] uppercase tracking-wide text-black/35">{String(label)}</p><p className="mt-2 font-semibold">{value?"Enabled":"Blocked"}</p></div>)}</div>{list(account.requirements_currently_due).length>0&&<div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Due: {list(account.requirements_currently_due).join(", ")}</div>}<div className="mt-5 flex flex-wrap gap-3"><form action={syncProviderAccountAdminAction}><input type="hidden" name="sellerId" value={String(account.seller_id)}/><button className="rounded-full border px-4 py-2 text-sm font-semibold"><RefreshCw className="mr-2 inline size-4"/>Sync</button></form><form action={decideUnderwritingAction} className="flex flex-wrap gap-2"><input type="hidden" name="sellerId" value={String(account.seller_id)}/><input name="notes" aria-label={`Underwriting notes for ${String(account.display_name)}`} placeholder="Review notes" className="rounded-full border px-4 py-2 text-sm"/><button name="status" value="test_approved" className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"><ShieldCheck className="mr-2 inline size-4"/>Approve test</button><button name="status" value="rejected" className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Reject</button></form></div></section>)}</div>
    <section className="mt-8 rounded-[28px] border border-black/[.07] bg-white p-6"><h2 className="text-xl font-semibold">Review history</h2><div className="mt-4 space-y-3">{reviews.slice(0,20).map((review)=><div key={String(review.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/[.03] p-4"><div><p className="font-semibold">{String(review.display_name)}</p><p className="mt-1 text-xs text-black/40">{new Date(String(review.requested_at)).toLocaleString()} · {String(review.mode)}</p></div><span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">{String(review.status)}</span></div>)}</div></section>
  </div>;
}
