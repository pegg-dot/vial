import { requirePermission } from "@/server/auth/session";
import { approvedCommerceDashboard } from "@/server/commerce/activation";
import { commerceDashboard } from "@/server/commerce/repository";
import { updateListingActivationAction } from "../commerce-v5-actions";

function jsonList(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.join(", ") : value;
    } catch {
      return value;
    }
  }
  return "";
}

export default async function ActivationPage() {
  await requirePermission("commerce:read");
  const [approved, commerce] = await Promise.all([approvedCommerceDashboard(), commerceDashboard()]);
  const eligibility = commerce.eligibility as Array<Record<string, unknown>>;
  const decisions = approved.decisions as Array<Record<string, unknown>>;

  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#2b31d8]">Policy engine</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">SKU activation matrix</h1>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
        Activation is versioned by seller, SKU, customer type, jurisdiction, processor mode, legal state, evidence, and merchant model. Production approval cannot be recorded while VialGrade is in sandbox or test mode.
      </p>

      <section className="mt-8 space-y-4">
        {eligibility.map((row) => (
          <form key={String(row.listing_id)} action={updateListingActivationAction} className="ink hard rounded-[20px] bg-white p-6">
            <input type="hidden" name="listingId" value={String(row.listing_id)} />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">{String(row.name)}</h2>
                <p className="mt-1 text-xs font-medium text-[var(--muted)]">{String(row.display_name)} · {String(row.slug)}</p>
              </div>
              <select name="state" aria-label={`Commerce state for ${String(row.name)}`} defaultValue={String(row.state)} className="ink-1 rounded-full bg-white px-3 py-2 text-sm font-medium focus:shadow-[3px_3px_0_0_#2b31d8] focus:outline-none">
                <option value="checkout_sandbox">checkout sandbox</option>
                <option value="processor_review">processor review</option>
                <option value="commerce_suspended">suspended</option>
                <option value="prohibited">prohibited</option>
                <option value="commerce_approved">commerce approved</option>
              </select>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium">Processor review<input name="processorReviewStatus" defaultValue={String(row.processor_review_status)} className="ink-1 mt-2 w-full rounded-[10px] bg-white px-3 py-2 focus:shadow-[3px_3px_0_0_#2b31d8] focus:outline-none" /></label>
              <label className="text-sm font-medium">Legal review<input name="legalReviewStatus" defaultValue={String(row.legal_review_status)} className="ink-1 mt-2 w-full rounded-[10px] bg-white px-3 py-2 focus:shadow-[3px_3px_0_0_#2b31d8] focus:outline-none" /></label>
              <label className="text-sm font-medium">Customer types<input name="allowedCustomerTypes" defaultValue={jsonList(row.allowed_customer_types)} className="ink-1 mt-2 w-full rounded-[10px] bg-white px-3 py-2 focus:shadow-[3px_3px_0_0_#2b31d8] focus:outline-none" /></label>
              <label className="text-sm font-medium">Jurisdictions<input name="allowedJurisdictions" defaultValue={jsonList(row.allowed_jurisdictions)} className="ink-1 mt-2 w-full rounded-[10px] bg-white px-3 py-2 focus:shadow-[3px_3px_0_0_#2b31d8] focus:outline-none" /></label>
            </div>
            <button className="ink hard-sm press-blue mt-5 rounded-full bg-[#2b31d8] px-4 py-2 text-sm font-bold text-white">Save activation state</button>
          </form>
        ))}
      </section>

      <section className="ink hard mt-8 rounded-[20px] bg-white p-6">
        <h2 className="text-xl font-extrabold">Recent decisions</h2>
        <div className="mt-4 space-y-3">
          {decisions.slice(0, 30).map((decision) => (
            <div key={String(decision.id)} className="ink-1 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#f7f7f4] p-4">
              <div>
                <p className="font-bold">{String(decision.subject_type)} · {String(decision.subject_id).slice(0, 60)}</p>
                <p className="mt-1 text-xs font-medium text-[var(--muted)]">{String(decision.policy_version)} · {String(decision.jurisdiction)} · {new Date(String(decision.created_at)).toLocaleString()}</p>
              </div>
              <span className={`ink-1 rounded-full px-3 py-1 text-xs font-extrabold ${decision.decision === "allow" ? "bg-[#e6fbf4] text-[#0e8f80]" : decision.decision === "deny" ? "bg-[#fff1f0] text-[#d3372c]" : "bg-[#fff4e0] text-[#b26a00]"}`}>{String(decision.decision)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
