import { AlertTriangle, Banknote, CheckCircle2, CircleDollarSign, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { Panel, primaryButton, secondaryButton, SellerPageHeader, StatCard, StatusPill } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext } from "@/server/seller/ops";
import { getSellerPaymentWorkspace } from "@/server/commerce/activation";
import { createPaymentAccountAction, requestUnderwritingAction, startPaymentOnboardingAction, syncPaymentAccountAction } from "../actions";

function list(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
  }
  return [];
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

export default async function SellerPaymentsPage() {
  const principal = await requireSellerPermission("seller:finance:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const workspace = await getSellerPaymentWorkspace(context.sellerId);
  const account = workspace.account as Record<string, unknown> | null;
  const due = list(account?.requirements_currently_due);
  const reserves = workspace.reserves as Array<Record<string, unknown>>;
  const heldReserve = reserves.filter((row) => row.status === "held").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const transferred = (workspace.transfers as Array<Record<string, unknown>>).filter((row) => row.status === "succeeded").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const latestReview = (workspace.underwriting as Array<Record<string, unknown>>)[0];

  return <>
    <SellerPageHeader title="Payments" description="Processor readiness, underwriting, capabilities, reserves, and settlement state. Live activation remains independently gated." />
    <div className="mt-7 grid gap-4 sm:grid-cols-4">
      <StatCard label="Commerce mode" value={String(account?.mode ?? "not configured")} tone="dark" />
      <StatCard label="Charges" value={account?.charges_enabled ? "Enabled" : "Blocked"} tone={account?.charges_enabled ? "violet" : "default"} />
      <StatCard label="Transferred" value={money(transferred)} />
      <StatCard label="Reserve held" value={money(heldReserve)} tone="violet" />
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Panel title="Connected payment account" action={<StatusPill status={String(account?.underwriting_status ?? "not_submitted")} />}>
        {account ? <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {[ ["Provider", account.provider], ["Account", account.provider_account_id], ["Merchant model", account.merchant_of_record], ["Configuration", account.account_configuration], ["Payouts", account.payouts_enabled ? "enabled" : "blocked"], ["Transfers", account.transfers_enabled ? "enabled" : "blocked"] ].map(([label, value]) => <div key={String(label)} className="ink-1 rounded-[14px] bg-[#f7f7f4] p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">{String(label)}</p><p className="mt-2 break-all text-sm font-extrabold">{String(value ?? "—")}</p></div>)}
          </div>
          {due.length > 0 ? <div className="ink-1 rounded-[14px] bg-[#fff4e0] p-4 text-sm text-[#b26a00]"><div className="flex items-center gap-2 font-extrabold"><AlertTriangle className="size-4" />Outstanding requirements</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{due.map((item) => <li key={item}>{item}</li>)}</ul></div> : <div className="ink-1 flex items-center gap-2 rounded-[14px] bg-[#e6fbf4] p-4 text-sm font-medium text-[#0e8f80]"><CheckCircle2 className="size-4" />No currently due provider requirements.</div>}
          <div className="flex flex-wrap gap-3">
            <form action={startPaymentOnboardingAction}><button className={primaryButton}><ExternalLink className="mr-2 inline size-4" />Open provider onboarding</button></form>
            <form action={syncPaymentAccountAction}><button className={secondaryButton}><RefreshCw className="mr-2 inline size-4" />Refresh capabilities</button></form>
          </div>
        </div> : <div className="rounded-[16px] border-[1.5px] border-dashed border-[#111214] p-6 text-center"><CircleDollarSign className="mx-auto size-7 text-[var(--muted)]" /><p className="mt-3 font-extrabold">No processor account</p><p className="mt-2 text-sm font-medium text-[var(--muted)]">Create the sandbox or test account boundary before beginning hosted onboarding.</p><form action={createPaymentAccountAction} className="mt-5"><button className={primaryButton}>Create payment account</button></form></div>}
      </Panel>

      <Panel title="Underwriting package" action={<StatusPill status={String(latestReview?.status ?? "not_submitted")} />}>
        <div className="ink-1 rounded-[14px] bg-[#f0edff] p-4 text-sm text-[#6d5dfc]"><div className="flex items-center gap-2 font-extrabold"><ShieldCheck className="size-4" />Approval is seller and catalog specific</div><p className="mt-2 text-xs leading-5 text-[#6d5dfc]/80">Payment capabilities alone do not activate listings. VialGrade also evaluates legal review, evidence, jurisdiction, customer type, seller standing, and the merchant-of-record model.</p></div>
        <form action={requestUnderwritingAction} className="mt-5 space-y-4">
          <label className="block text-sm font-medium">Requested jurisdictions<input name="jurisdictions" defaultValue="US-SANDBOX" className="field mt-2" /></label>
          <label className="block text-sm font-medium">Notes<textarea name="notes" rows={3} placeholder="Describe the catalog and operating model for review." className="field mt-2" /></label>
          <button disabled={!account} className={primaryButton}><Banknote className="mr-2 inline size-4" />Request underwriting review</button>
        </form>
      </Panel>
    </div>

    <Panel title="Recent activation decisions" className="mt-6">
      <div className="space-y-3">{(workspace.decisions as Array<Record<string, unknown>>).slice(0, 8).map((decision) => <div key={String(decision.id)} className="ink-1 flex flex-wrap items-center justify-between gap-3 rounded-[14px] p-4"><div><p className="font-bold capitalize">{String(decision.subject_type)} decision</p><p className="mt-1 text-xs font-medium text-[var(--muted)]">{String(decision.policy_version)} · {new Date(String(decision.created_at)).toLocaleString()}</p></div><StatusPill status={String(decision.decision)} /></div>)}{workspace.decisions.length === 0 && <p className="text-sm font-medium text-[var(--muted)]">No checkout activation decisions have been recorded.</p>}</div>
    </Panel>
  </>;
}
