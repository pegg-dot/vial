import type { EvidenceDimension } from "@/lib/types";
import type { CoaCrossCheck } from "./coa-cross-check";
import { PURITY_PROVENANCE_SHORT } from "@/lib/provenance-copy";

// Build the per-listing "What we could verify" matrix from the SAME cross-check the buy box runs, so
// every evidence surface on a product page reads ONE truth. Live listings used to render an
// always-empty `evidence` column ("No independent lab evidence located yet") that flatly contradicted
// the COA panel directly above it — a vendor with a matched independent test showed "no evidence."
// Each row answers a different question; sterility and dose are honestly "unknown/not-tested" because
// a purity COA does not measure them (the section's own copy promises we show that separately).
export function deriveEvidenceDimensions(coa: CoaCrossCheck): EvidenceDimension[] {
  const s = coa.status;

  // Labels stay short and the details stay document-scoped: each row says what record exists (or
  // doesn't) — never a clinical inventory of what a buyer might do with the vial.
  const identity: EvidenceDimension =
    s === "batch-verified" ? { label: "Identity", status: "established", detail: "An independent lab confirmed the exact cited batch for this vendor." }
    : s === "verified" ? { label: "Identity", status: "established", detail: "An independent lab record backs this vendor's testing for this compound." }
    : s === "low-purity" ? { label: "Identity", status: "established", detail: "An independent record exists, though measured purity came in below the usual claim." }
    : s === "unbacked" ? { label: "Identity", status: "partial", detail: "The vendor advertises third-party testing; no independent record confirms it yet." }
    : s === "mismatch" ? { label: "Identity", status: "partial", detail: "The cited certificate resolves to a different manufacturer — treat with caution." }
    : { label: "Identity", status: "unknown", detail: "No independent test on record for this listing." };

  const purity: EvidenceDimension = coa.independentPurity != null
    ? { label: "Measured purity", status: "established", detail: `Independently measured ${coa.independentPurity.toFixed(2)}%. ${PURITY_PROVENANCE_SHORT}` }
    : { label: "Measured purity", status: "unknown", detail: "No independent purity measurement on record." };

  const batch: EvidenceDimension = s === "batch-verified"
    ? { label: "Batch traceability", status: "established", detail: "The exact batch cited on this listing resolves to an independent lab record." }
    : { label: "Batch traceability", status: "unknown", detail: "No batch on this listing matches an independent record." };

  const sterility: EvidenceDimension = { label: "Sterility", status: "not-tested", detail: "A purity certificate doesn't measure this — no such test on record." };
  const dose: EvidenceDimension = { label: "Dose accuracy", status: "unknown", detail: "Not something VialGrade measures — no test on record." };

  return [identity, purity, batch, sterility, dose];
}
