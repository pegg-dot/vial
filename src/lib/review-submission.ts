// One review-queue form, four gestures: approve one, reject one, approve the checked set,
// reject the checked set. The page renders a single <form> (per-card forms nested inside a bulk
// form would be invalid HTML), so every button routes here and this parser decides — pure and
// unit-tested, because the difference between "approve this one" and "approve everything checked"
// is not a place for ambiguity.

export type ReviewSubmission =
  | { mode: "single"; claimId: string; decision: "approve" | "reject" }
  | { mode: "bulk"; claimIds: string[]; decision: "approve" | "reject" }
  | { mode: "error"; reason: string };

interface FormDataLike {
  get(name: string): unknown;
  getAll(name: string): unknown[];
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function parseReviewSubmission(formData: FormDataLike): ReviewSubmission {
  // A per-card button always wins over the checkbox state — clicking "Approve and publish" on one
  // card must never silently act on other rows that happen to be checked.
  const approveOne = str(formData.get("approveOne"));
  if (approveOne) return { mode: "single", claimId: approveOne, decision: "approve" };
  const rejectOne = str(formData.get("rejectOne"));
  if (rejectOne) return { mode: "single", claimId: rejectOne, decision: "reject" };

  const bulk = str(formData.get("bulk"));
  if (bulk === "approve" || bulk === "reject") {
    const claimIds = [...new Set(formData.getAll("selected").map(str).filter(Boolean))];
    if (claimIds.length === 0) return { mode: "error", reason: "Nothing selected — tick the checkbox on each claim first." };
    return { mode: "bulk", claimIds, decision: bulk };
  }

  // Backwards compatibility with the original per-card form fields.
  const claimId = str(formData.get("claimId"));
  const decision = str(formData.get("decision"));
  if (claimId && (decision === "approve" || decision === "reject")) return { mode: "single", claimId, decision };

  return { mode: "error", reason: "missing" };
}
