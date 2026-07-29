import { ArrowRight, Building2, FileCheck2, PlugZap, ShieldCheck, ShoppingBag } from "lucide-react";
import { Panel, primaryButton, ReadinessRow, secondaryButton, SellerPageHeader, StatusPill } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { matchSellerBusiness } from "@/server/seller/matching";
import { getSellerContext } from "@/server/seller/ops";
import { saveOnboardingStepAction } from "../actions";

export default async function SellerOnboardingPage() {
  const principal = await requireSellerPermission("seller:profile:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const profile = (context.profile ?? {}) as Record<string, unknown>;
  const readiness = context.readiness as { completion_percent?: unknown; overall_state?: unknown; dimensions?: unknown; blockers?: unknown; warnings?: unknown } | null;
  const dimensions = Array.isArray(readiness?.dimensions) ? readiness.dimensions as Array<{ key: string; label: string; score: number; status: string; detail: string }> : [];
  const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers as string[] : [];
  const stepMap = new Map(context.steps.map((row) => [String((row as { step_key?: unknown }).step_key), row as { status?: string }]));
  const businessCandidates = await matchSellerBusiness({ name: String(profile.display_name ?? ""), websiteUrl: String(profile.website_url ?? "") });
  const connectedCatalog = context.integrations.some((row) => ["shopify", "woocommerce", "csv", "website"].includes(String((row as Record<string, unknown>).provider)) && ["connected", "sandbox_ready"].includes(String((row as Record<string, unknown>).status)));
  const paymentReady = context.integrations.some((row) => String((row as Record<string, unknown>).provider) === "stripe_connect" && ["connected", "sandbox_ready"].includes(String((row as Record<string, unknown>).status)));
  return <>
    <SellerPageHeader title="Self-serve onboarding" description="Connect the systems you already use, let VIAL propose canonical matches, then submit one traceable package for review." action={<div className="text-right"><p className="text-4xl font-extrabold tracking-[-.05em]">{Number(readiness?.completion_percent ?? 0)}%</p><p className="text-xs font-medium text-[var(--muted)]">{String(readiness?.overall_state ?? "blocked").replaceAll("_", " ")}</p></div>} />
    <div className="mt-7 grid gap-6 xl:grid-cols-[.68fr_1.32fr]">
      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Panel title="Readiness map" description="Eight separate dimensions. Completing one cannot mask another.">{dimensions.map(({ key, ...item }) => <ReadinessRow key={key} {...item} />)}</Panel>
        {blockers.length > 0 && <Panel title="Before you submit"><ol className="space-y-2">{blockers.map((item, index) => <li key={item} className="flex gap-3 text-sm leading-6 text-[var(--muted)]"><span className="font-extrabold text-[#6d5dfc]">{index + 1}</span>{item}</li>)}</ol></Panel>}
      </div>
      <div className="space-y-6">
        <Panel title="1. Business identity" action={<StatusPill status={stepMap.get("business")?.status ?? "not_started"} />}>
          <form action={saveOnboardingStepAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="step" value="business" /><input type="hidden" name="complete" value="true" />
            <label className="text-sm font-medium">Legal name<input className="field mt-2" name="legalName" defaultValue={String(profile.legal_name ?? "")} required /></label>
            <label className="text-sm font-medium">Display name<input className="field mt-2" name="displayName" defaultValue={String(profile.display_name ?? "")} required /></label>
            <label className="text-sm font-medium sm:col-span-2">Website<input className="field mt-2" name="websiteUrl" type="url" defaultValue={String(profile.website_url ?? "")} required /></label>
            <label className="text-sm font-medium">Country<select className="field mt-2" name="countryCode" defaultValue={String(profile.country_code ?? "US")}><option value="US">United States</option><option value="CA">Canada</option><option value="GB">United Kingdom</option></select></label>
            <div className="flex items-end"><button className={primaryButton}>Save identity</button></div>
          </form>
          {businessCandidates[0] && <div className="ink-1 mt-5 flex items-start gap-3 rounded-[14px] bg-[#f0edff] p-4"><Building2 className="mt-0.5 size-4 text-[#6d5dfc]" /><div><p className="text-sm font-extrabold text-[#6d5dfc]">Possible existing VIAL profile: {businessCandidates[0].name}</p><p className="mt-1 text-xs leading-5 text-[#6d5dfc]/70">{businessCandidates[0].reasons.join(" · ")}. This is a match proposal, not an automatic claim.</p></div></div>}
        </Panel>

        <Panel title="2. Operations" action={<StatusPill status={stepMap.get("operations")?.status ?? "not_started"} />}>
          <form action={saveOnboardingStepAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="step" value="operations" /><input type="hidden" name="complete" value="true" />
            <label className="text-sm font-medium sm:col-span-2">Support email<input className="field mt-2" name="supportEmail" type="email" defaultValue={String(profile.support_email ?? "")} required /></label>
            <label className="text-sm font-medium">Origin city<input className="field mt-2" name="originCity" defaultValue="Miami" /></label><label className="text-sm font-medium">Origin region<input className="field mt-2" name="originRegion" defaultValue="FL" /></label><input type="hidden" name="originCountry" value="US" />
            <label className="text-sm font-medium">Fulfillment SLA<select className="field mt-2" name="fulfillmentSlaHours" defaultValue={String(profile.fulfillment_sla_hours ?? 48)}><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option></select></label>
            <label className="text-sm font-medium sm:col-span-2">Returns policy<textarea className="field mt-2 min-h-28" name="returnsPolicy" defaultValue={String(profile.returns_policy ?? "")} required /></label>
            <button className={`${primaryButton} sm:col-span-2 sm:w-fit`}>Save operations</button>
          </form>
        </Panel>

        <Panel title="3. Connect your systems" action={<StatusPill status={connectedCatalog ? "complete" : stepMap.get("connect")?.status ?? "not_started"} />}>
          <div className="grid gap-3 sm:grid-cols-2"><div className="ink-1 rounded-[14px] bg-[#fafaf7] p-4"><PlugZap className="size-4" /><p className="mt-5 font-extrabold">Store and inventory</p><p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">Shopify OAuth, WooCommerce credentials, CSV, or website discovery.</p></div><div className="ink-1 rounded-[14px] bg-[#fafaf7] p-4"><ShieldCheck className="size-4" /><p className="mt-5 font-extrabold">Processor onboarding</p><p className="mt-1 text-xs font-medium leading-5 text-[var(--muted)]">Hosted or embedded provider onboarding keeps identity requirements current.</p></div></div>
          <a href="/seller/integrations" className={`${primaryButton} mt-5`}>Manage connections <ArrowRight className="ml-2 size-4" /></a>
        </Panel>

        <Panel title="4. Review catalog matches" action={<StatusPill status={stepMap.get("catalog")?.status ?? (context.products.length ? "attention" : "not_started")} />}>
          <div className="flex items-center gap-4"><div className="ink-1 grid size-11 place-items-center rounded-[14px] bg-[#f0edff] text-[#6d5dfc]"><ShoppingBag className="size-5" /></div><div><p className="font-extrabold">{context.products.length} products in your seller catalog</p><p className="text-xs font-medium text-[var(--muted)]">{context.products.filter((row) => Number((row as Record<string, unknown>).match_confidence ?? 0) >= .9).length} have high-confidence canonical matches.</p></div></div>
          <div className="mt-5 flex gap-3"><a href="/seller/imports" className={primaryButton}>Review imports</a><a href="/seller/catalog" className={secondaryButton}>Open catalog</a></div>
        </Panel>

        <Panel title="5. Link batch evidence" action={<StatusPill status={stepMap.get("evidence")?.status ?? (context.documents.length ? "attention" : "not_started")} />}>
          <div className="flex items-center gap-4"><div className="ink-1 grid size-11 place-items-center rounded-[14px] bg-[#e6fbf4] text-[#0e8f80]"><FileCheck2 className="size-5" /></div><div><p className="font-extrabold">{context.documents.length} documents · {context.evidenceLinks.length} proposed relationships</p><p className="text-xs font-medium text-[var(--muted)]">Document authenticity, batch linkage, and physical-product testing remain separate dimensions.</p></div></div>
          <a href="/seller/evidence" className={`${primaryButton} mt-5`}>Manage evidence</a>
        </Panel>

        <Panel title="6. Payment readiness" action={<StatusPill status={paymentReady ? "complete" : stepMap.get("payments")?.status ?? "not_started"} />}>
          <p className="text-sm font-medium leading-6 text-[var(--muted)]">The sandbox connector models hosted or embedded connected-account onboarding. Production activation still requires processor underwriting for the actual seller and catalog.</p>
          <a href="/seller/integrations" className={`${secondaryButton} mt-5`}>Open Stripe Connect setup</a>
        </Panel>

        <Panel title="7. Seller agreement" action={<StatusPill status={stepMap.get("agreement")?.status ?? (profile.terms_accepted_at ? "complete" : "not_started")} />}>
          <form action={saveOnboardingStepAction}><input type="hidden" name="step" value="agreement" /><input type="hidden" name="complete" value="true" /><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="acknowledged" className="mt-1" required /><span>I accept the current fictional sandbox seller agreement and evidence-integrity rules.</span></label><button className={`${primaryButton} mt-5`}>Accept agreement</button></form>
        </Panel>

        <Panel title="8. Submit for review" action={<StatusPill status={stepMap.get("review")?.status ?? "not_started"} />}>
          <p className="text-sm font-medium leading-6 text-[var(--muted)]">VIAL packages identity, operations, connector state, catalog mappings, evidence relationships, payment requirements, team ownership, and accepted terms into one traceable review package.</p>
          <form action={saveOnboardingStepAction} className="mt-5"><input type="hidden" name="step" value="review" /><input type="hidden" name="complete" value="true" /><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="acknowledged" className="mt-1" required /><span>I confirm the sandbox package is accurate and understand production activation requires external approval.</span></label><button disabled={blockers.length > 0} className={`${primaryButton} mt-5`}>Submit review package</button>{blockers.length > 0 && <p className="mt-3 text-xs font-medium text-[#b26a00]">Resolve the readiness blockers listed on the left before submission.</p>}</form>
        </Panel>
      </div>
    </div>
  </>;
}
