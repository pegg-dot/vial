import Link from "next/link";
import { CreditCard, Landmark, ShieldCheck, SlidersHorizontal, Webhook } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { commerceDashboard } from "@/server/commerce/repository";
import { approvedCommerceDashboard } from "@/server/commerce/activation";

const money = (value: unknown) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));

export default async function AdminCommercePage() {
  await requirePermission("commerce:read");
  const [legacy, approved] = await Promise.all([commerceDashboard(), approvedCommerceDashboard()]);
  const eligibility = legacy.eligibility as Array<Record<string, unknown>>;
  const orders = legacy.orders as Array<Record<string, unknown>>;
  const accounts = approved.accounts as Array<Record<string, unknown>>;
  const paymentIntents = approved.paymentIntents as Array<Record<string, unknown>>;
  const tax = approved.tax as Array<Record<string, unknown>>;
  const fraud = approved.fraud as Array<Record<string, unknown>>;
  const gross = orders.reduce((sum, order) => sum + Number(order.grand_total ?? 0), 0);

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Commerce control plane</p><h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">Approved commerce architecture</h1><p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">VIAL separates processor capability, seller underwriting, SKU approval, customer eligibility, jurisdiction, tax liability, fraud, merchant model, settlement, and activation.</p></div><span className={`ink-1 rounded-full px-4 py-2 text-sm font-extrabold ${approved.mode === "live" ? "bg-[#fff1f0] text-[#d3372c]" : "bg-[#e9eaff] text-[#2b31d8]"}`}>{String(approved.provider)} · {String(approved.mode)}</span></div>

    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[
      ["Provider accounts", accounts.length],
      ["Approved sandbox SKUs", eligibility.filter((row) => row.state === "checkout_sandbox").length],
      ["Payment intents", paymentIntents.length],
      ["Orders", orders.length],
      ["Gross sandbox volume", money(gross)],
    ].map(([label, value]) => <div key={String(label)} className="ink hard rounded-[18px] bg-white p-5"><p className="text-xs font-bold text-[var(--muted)]">{String(label)}</p><p className="mt-2 text-2xl font-extrabold">{String(value)}</p></div>)}</div>

    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">{[
      ["/admin/underwriting", "Underwriting", "Seller capabilities and risk", ShieldCheck],
      ["/admin/activation", "Activation", "SKU and jurisdiction policy", SlidersHorizontal],
      ["/admin/provider-events", "Provider events", "Signed webhook inbox", Webhook],
      ["/admin/settlements", "Settlements", "Transfers and reserves", Landmark],
      ["/admin/finance", "Ledger", "Immutable financial history", CreditCard],
    ].map(([href, title, description, Icon]) => <Link key={String(href)} href={String(href)} className="ink hard press rounded-[18px] bg-white p-5"><Icon className="size-5 text-[#2b31d8]"/><p className="mt-4 font-bold">{String(title)}</p><p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">{String(description)}</p></Link>)}</div>

    <section className="ink hard mt-8 rounded-[20px] bg-white p-6"><h2 className="text-xl font-extrabold">Provider account state</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs font-extrabold uppercase tracking-[.06em] text-[var(--muted)]"><tr><th className="pb-3">Seller</th><th>Mode</th><th>Underwriting</th><th>Charges</th><th>Payouts</th><th>Transfers</th><th>Risk tier</th><th>Account</th></tr></thead><tbody>{accounts.map((account) => <tr key={String(account.id)} className="border-t border-[#111214]/10"><td className="py-4 font-bold">{String(account.display_name)}</td><td>{String(account.mode)}</td><td>{String(account.underwriting_status)}</td><td>{account.charges_enabled ? "Enabled" : "Blocked"}</td><td>{account.payouts_enabled ? "Enabled" : "Blocked"}</td><td>{account.transfers_enabled ? "Enabled" : "Blocked"}</td><td>{String(account.risk_tier)}</td><td className="font-mono text-xs">{String(account.provider_account_id)}</td></tr>)}</tbody></table></div></section>

    <div className="mt-8 grid gap-6 xl:grid-cols-2"><section className="ink hard rounded-[20px] bg-white p-6"><h2 className="text-xl font-extrabold">Tax liability records</h2><div className="mt-4 space-y-3">{tax.slice(0,8).map((row)=><div key={String(row.id)} className="ink-1 flex items-center justify-between rounded-[12px] bg-[#f7f7f4] p-4"><div><p className="font-bold">{String(row.jurisdiction)}</p><p className="text-xs font-medium text-[var(--muted)]">Liable party: {String(row.liable_party)} · {String(row.provider)}</p></div><span className="font-bold">{money(row.tax_amount)}</span></div>)}{tax.length===0&&<p className="text-sm font-medium text-[var(--muted)]">No V5 tax transactions yet.</p>}</div></section><section className="ink hard rounded-[20px] bg-white p-6"><h2 className="text-xl font-extrabold">Fraud decisions</h2><div className="mt-4 space-y-3">{fraud.slice(0,8).map((row)=><div key={String(row.id)} className="ink-1 flex items-center justify-between rounded-[12px] bg-[#f7f7f4] p-4"><div><p className="font-bold capitalize">{String(row.outcome)}</p><p className="text-xs font-medium text-[var(--muted)]">{String(row.provider)} · {String(row.rule_version)}</p></div><span className="ink-1 rounded-full bg-[#111214] px-3 py-1 text-xs font-bold text-white">score {String(row.score)}</span></div>)}{fraud.length===0&&<p className="text-sm font-medium text-[var(--muted)]">No V5 fraud decisions yet.</p>}</div></section></div>
  </div>;
}
