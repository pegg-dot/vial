import { Panel, primaryButton, SellerPageHeader, StatusPill } from "@/components/seller/seller-ui";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext } from "@/server/seller/ops";
import { saveOnboardingStepAction } from "../actions";

export default async function SellerSettingsPage() {
  const principal = await requireSellerPermission("seller:profile:read");
  const context = await getSellerContext(principal.email);
  if (!context) return null;
  const profile = (context.profile ?? {}) as Record<string, unknown>;
  return <>
    <SellerPageHeader title="Settings" description="Maintain public identity, operational contacts, fulfillment promises, and policy status." action={<StatusPill status={String(profile.onboarding_status ?? "in_progress")} />} />
    <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <Panel title="Business profile">
        <form action={saveOnboardingStepAction} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="step" value="business" /><input type="hidden" name="complete" value="true" />
          <label className="text-sm font-medium">Legal name<input className="field mt-2" name="legalName" defaultValue={String(profile.legal_name ?? "")} required /></label>
          <label className="text-sm font-medium">Display name<input className="field mt-2" name="displayName" defaultValue={String(profile.display_name ?? "")} required /></label>
          <label className="text-sm font-medium sm:col-span-2">Website<input className="field mt-2" name="websiteUrl" type="url" defaultValue={String(profile.website_url ?? "")} required /></label>
          <input type="hidden" name="countryCode" value={String(profile.country_code ?? "US")} /><button className={`${primaryButton} sm:w-fit`}>Save profile</button>
        </form>
      </Panel>
      <Panel title="Operations">
        <form action={saveOnboardingStepAction} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="step" value="operations" /><input type="hidden" name="complete" value="true" />
          <label className="text-sm font-medium sm:col-span-2">Support email<input className="field mt-2" name="supportEmail" type="email" defaultValue={String(profile.support_email ?? "")} required /></label>
          <label className="text-sm font-medium">Fulfillment SLA<select className="field mt-2" name="fulfillmentSlaHours" defaultValue={String(profile.fulfillment_sla_hours ?? 48)}><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option></select></label>
          <input type="hidden" name="originCountry" value="US" /><input type="hidden" name="originRegion" value="FL" /><input type="hidden" name="originCity" value="Miami" />
          <label className="text-sm font-medium sm:col-span-2">Returns policy<textarea className="field mt-2 min-h-28" name="returnsPolicy" defaultValue={String(profile.returns_policy ?? "")} /></label>
          <button className={`${primaryButton} sm:w-fit`}>Save operations</button>
        </form>
      </Panel>
    </div>
  </>;
}
