// Apply the vendor merges once, in every database that boots.
//
// Seven vendor rows were duplicates of six real businesses, and one — `admin-rayshine-peptide`,
// display name `admin@rayshine-peptide` — was an email address parsed into a directory entry:
// graded, counted in the headline vendor total, and browsable as a company page. Every duplicate
// inflates the vendor count the site publishes across its surfaces.
//
// Written as a migration rather than a script for the reason this whole audit kept surfacing: a
// remediation nobody runs is a remediation that never happens. Three separate defects repaired
// today were correct code sitting on top of stale rows, because the fix lived in a script that had
// to be invoked by hand against the right database.
//
// The planner is conservative by construction and this was verified against a copy of the real
// store before shipping: 95 vendors to 89, idempotent (a second plan proposes nothing), and every
// evidence table preserved exactly — listings, lab tests, reviews, flags, status, offers, ratings,
// regulatory actions. The single deliberate exception is `vendor_links`, where a link BETWEEN two
// rows that just became the same vendor is a self-link carrying no information.
//
// `sahepeptides` was deliberately NOT merged into `sh-peptide` despite a shared-source link between
// them. A shared source is not proof of shared ownership, and a wrong merge destroys a real
// distinction that is far harder to undo than a missed one.
import type { SqlConnection } from "./client";
import { planVendorMerges, applyVendorMerges } from "../vendors/merge";

export async function mergeDuplicateVendors(db: SqlConnection): Promise<void> {
  try {
    const plan = await planVendorMerges(db);
    if (plan.clusters.length === 0 && plan.malformedNames.length === 0 && plan.residue.length === 0) return;
    await applyVendorMerges(db, plan, { apply: true });
  } catch (error) {
    // Never take a boot down over directory hygiene. A duplicate vendor is a cosmetic problem; an
    // application that will not start is not. The next boot retries.
    console.error("[vendor-merge] skipped:", error);
  }
}
