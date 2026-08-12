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

  const identity: EvidenceDimension =
    s === "batch-verified" ? { label: "Identity — independent test", status: "established", detail: "An independent lab confirmed the exact cited batch for this vendor." }
    : s === "verified" ? { label: "Identity — independent test", status: "established", detail: "An independent lab record backs this vendor's testing for this compound." }
    : s === "low-purity" ? { label: "Identity — independent test", status: "established", detail: "An independent record exists, though measured purity came in below the usual claim." }
    : s === "unbacked" ? { label: "Identity — independent test", status: "partial", detail: "The vendor advertises third-party testing, but no independent record confirms it yet." }
    : s === "mismatch" ? { label: "Identity — independent test", status: "partial", detail: "The cited certificate resolves to a different manufacturer — treat with caution." }
    : { label: "Identity — independent test", status: "unknown", detail: "No independent third-party COA is advertised or on record for this listing." };

  const purity: EvidenceDimension = coa.independentPurity != null
    ? { label: "Measured purity (HPLC)", status: "established", detail: `Independently measured ${coa.independentPurity.toFixed(2)}%. ${PURITY_PROVENANCE_SHORT}` }
    : { label: "Measured purity (HPLC)", status: "unknown", detail: "No independent purity figure is on record for this listing." };

  const batch: EvidenceDimension = s === "batch-verified"
    ? { label: "Batch traceability", status: "established", detail: "The exact batch cited on this listing resolves to an independent lab record." }
    : { label: "Batch traceability", status: "unknown", detail: "No specific batch on this listing has been matched to an independent record." };

  const sterility: EvidenceDimension = { label: "Sterility & endotoxin", status: "not-tested", detail: "A purity COA does not measure sterility or endotoxins — no such test is on record." };
  const dose: EvidenceDimension = { label: "Dose / fill accuracy", status: "unknown", detail: "VialGrade does not independently measure vial fill or delivered dose." };

  return [identity, purity, batch, sterility, dose];
}
