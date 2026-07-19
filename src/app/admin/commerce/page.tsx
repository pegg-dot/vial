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
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-600">Commerce control plane</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.05em]">Approved commerce architecture</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-black/50">VIAL separates processor capability, seller underwriting, SKU approval, customer eligibility, jurisdiction, tax liability, fraud, merchant model, settlement, and activation.</p></div><span className={`rounded-full px-4 py-2 text-sm font-semibold ${approved.mode === "live" ? "bg-red-100 text-red-700" : "bg-violet-100 text-violet-700"}`}>{String(approved.provider)} · {String(approved.mode)}</span></div>

    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[
      ["Provider accounts", accounts.length],
      ["Approved sandbox SKUs", eligibility.filter((row) => row.state === "checkout_sandbox").length],
      ["Payment intents", paymentIntents.length],
      ["Orders", orders.length],
      ["Gross sandbox volume", money(gross)],
    ].map(([label, value]) => <div key={String(label)} className="rounded-[22px] border border-black/[.07] bg-white p-5"><p className="text-xs text-black/40">{String(label)}</p><p className="mt-2 text-2xl font-semibold">{String(value)}</p></div>)}</div>

    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">{[
      ["/admin/underwriting", "Underwriting", "Seller capabilities and risk", ShieldCheck],
      ["/admin/activation", "Activation", "SKU and jurisdiction policy", SlidersHorizontal],
      ["/admin/provider-events", "Provider events", "Signed webhook inbox", Webhook],
      ["/admin/settlements", "Settlements", "Transfers and reserves", Landmark],
      ["/admin/finance", "Ledger", "Immutable financial history", CreditCard],
    ].map(([href, title, description, Icon]) => <Link key={String(href)} href={String(href)} className="rounded-[24px] border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"><Icon className="size-5 text-violet-600"/><p className="mt-4 font-semibold">{String(title)}</p><p className="mt-1 text-xs leading-5 text-black/45">{String(description)}</p></Link>)}</div>

    <section className="mt-8 rounded-[28px] border border-black/[.07] bg-white p-6"><h2 className="text-xl font-semibold">Provider account state</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs text-black/40"><tr><th className="pb-3">Seller</th><th>Mode</th><th>Underwriting</th><th>Charges</th><th>Payouts</th><th>Transfers</th><th>Risk tier</th><th>Account</th></tr></thead><tbody>{accounts.map((account) => <tr key={String(account.id)} className="border-t"><td className="py-4 font-semibold">{String(account.display_name)}</td><td>{String(account.mode)}</td><td>{String(account.underwriting_status)}</td><td>{account.charges_enabled ? "Enabled" : "Blocked"}</td><td>{account.payouts_enabled ? "Enabled" : "Blocked"}</td><td>{account.transfers_enabled ? "Enabled" : "Blocked"}</td><td>{String(account.risk_tier)}</td><td className="font-mono text-xs">{String(account.provider_account_id)}</td></tr>)}</tbody></table></div></section>

    <div className="mt-8 grid gap-6 xl:grid-cols-2"><section className="rounded-[28px] border bg-white p-6"><h2 className="text-xl font-semibold">Tax liability records</h2><div className="mt-4 space-y-3">{tax.slice(0,8).map((row)=><div key={String(row.id)} className="flex items-center justify-between rounded-2xl bg-black/[.03] p-4"><div><p className="font-semibold">{String(row.jurisdiction)}</p><p className="text-xs text-black/40">Liable party: {String(row.liable_party)} · {String(row.provider)}</p></div><span className="font-semibold">{money(row.tax_amount)}</span></div>)}{tax.length===0&&<p className="text-sm text-black/45">No V5 tax transactions yet.</p>}</div></section><section className="rounded-[28px] border bg-white p-6"><h2 className="text-xl font-semibold">Fraud decisions</h2><div className="mt-4 space-y-3">{fraud.slice(0,8).map((row)=><div key={String(row.id)} className="flex items-center justify-between rounded-2xl bg-black/[.03] p-4"><div><p className="font-semibold capitalize">{String(row.outcome)}</p><p className="text-xs text-black/40">{String(row.provider)} · {String(row.rule_version)}</p></div><span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">score {String(row.score)}</span></div>)}{fraud.length===0&&<p className="text-sm text-black/45">No V5 fraud decisions yet.</p>}</div></section></div>
  </div>;
}
