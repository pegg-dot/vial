"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth/session";
import { runSourceIngestion } from "@/server/agents/pipeline";
import { parseReviewSubmission } from "@/lib/review-submission";
import { reviewClaim } from "@/server/review/repository";
import { advanceFixture } from "@/server/refresh/repository";
import { processRefreshJob } from "@/server/refresh/scheduler";
import { CATALOG_CACHE_TAG } from "@/server/catalog/repository";

// The two writes behind snapshot → review → publish.
//
// Both the pipeline and the review repository have existed and worked the whole time; what was
// deleted was any way to call them. source_snapshots, evidence_claims, review_decisions and
// publication_events sat empty while 552 sources were registered, because the surface that put a
// human in the loop went away with commit 298e7ce. These actions put it back.
//
// Staff-only, checked here and not only by the proxy: an action is a POST endpoint like any other,
// and defence in depth is the rule the static audit enforces for exactly this reason.

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function captureAndExtractAction(formData: FormData) {
  const { principal } = await requireStaff();

  const rawContent = text(formData, "rawContent");
  const targetListingSlug = text(formData, "targetListingSlug");
  const canonicalLocation = text(formData, "canonicalLocation");
  const label = text(formData, "label");

  if (!rawContent || !targetListingSlug || !canonicalLocation || !label) {
    redirect("/admin/ingest?error=missing");
  }

  // Content type is sniffed rather than asked for. Whoever is pasting a captured page should not
  // have to classify it, and getting it wrong changes which parser runs.
  const looksHtml = /^\s*<|<html|<div|<script/i.test(rawContent);
  const looksJson = /^\s*[[{]/.test(rawContent);

  try {
    const result = await runSourceIngestion({
      sourceType: "vendor-page",
      canonicalLocation,
      label,
      targetListingSlug,
      rawContent,
      contentType: looksJson ? "application/json" : looksHtml ? "text/html" : "text/plain",
      parserProfile: looksJson ? "jsonld" : "generic",
      actor: principal.email,
      workflow: "source-ingestion",
      captureMode: "manual",
    });
    revalidatePath("/admin/review");
    // The proposal count travels in the URL so the review queue can say what this capture did,
    // rather than the reviewer having to guess which of the pending claims just arrived.
    redirect(`/admin/review?proposed=${result.proposedClaims}&run=${encodeURIComponent(result.runId)}${result.duplicateSnapshot ? "&duplicate=1" : ""}`);
  } catch (error) {
    // redirect() throws by design — never swallow it into the error branch.
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw error;
    redirect(`/admin/ingest?error=${encodeURIComponent(error instanceof Error ? error.message.slice(0, 160) : "ingestion failed")}`);
  }
}

/**
 * The review queue's single form action: one button per card ("approveOne"/"rejectOne") or a
 * checked set with a bulk button. Bulk is a LOOP over the same reviewClaim path — each claim
 * keeps its own transaction and its own publication receipt, exactly as if clicked one by one;
 * a mid-loop failure stops there and the redirect reports how far it got.
 */
export async function reviewQueueAction(formData: FormData) {
  const { principal, role } = await requireStaff();
  const submission = parseReviewSubmission(formData);
  if (submission.mode === "error") redirect(`/admin/review?error=${encodeURIComponent(submission.reason)}`);

  const ids = submission.mode === "single" ? [submission.claimId] : submission.claimIds;
  const decision = submission.decision;
  let done = 0;
  try {
    for (const claimId of ids) {
      await reviewClaim({ claimId, decision, actor: principal.email, role });
      done += 1;
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw error;
    if (done > 0) { revalidateTag(CATALOG_CACHE_TAG, "max"); revalidatePath("/admin/review"); revalidatePath("/admin/publications"); }
    const message = error instanceof Error ? error.message.slice(0, 120) : "review failed";
    redirect(`/admin/review?${decision === "approve" ? "published" : "declined"}=${done}&error=${encodeURIComponent(`${message} — ${done} of ${ids.length} processed before the failure`)}`);
  }
  // A published claim changes what a buyer sees, so the catalogue cache is stale the moment the
  // transaction commits — not whenever the revalidate window happens to expire.
  if (decision === "approve") revalidateTag(CATALOG_CACHE_TAG, "max");
  revalidatePath("/admin/review");
  revalidatePath("/admin/publications");
  // A SINGLE approval keeps its original destination — the publication ledger, receipt in hand
  // (the admin-workflow e2e pins this deliberately). A BULK decision returns to the queue, where
  // the rest of the batch still waits.
  if (submission.mode === "single") {
    redirect(decision === "approve" ? "/admin/publications?published=1" : "/admin/review?rejected=1");
  }
  redirect(decision === "approve" ? `/admin/review?published=${done}` : `/admin/review?declined=${done}`);
}

export async function reviewClaimAction(formData: FormData) {
  const { principal, role } = await requireStaff();

  const claimId = text(formData, "claimId");
  const decision = text(formData, "decision") === "approve" ? "approve" : "reject";
  if (!claimId) redirect("/admin/review?error=missing");

  try {
    await reviewClaim({ claimId, decision, notes: text(formData, "notes") || undefined, actor: principal.email, role });
    // A published claim changes what a buyer sees, so the catalogue cache is stale the moment the
    // transaction commits — not whenever the revalidate window happens to expire.
    revalidateTag(CATALOG_CACHE_TAG, "max");
    revalidatePath("/admin/review");
    revalidatePath("/admin/publications");
    redirect(decision === "approve" ? "/admin/publications?published=1" : "/admin/review?rejected=1");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw error;
    redirect(`/admin/review?error=${encodeURIComponent(error instanceof Error ? error.message.slice(0, 160) : "review failed")}`);
  }
}

/**
 * Advance a controlled fixture to its next version and immediately run the refresh it triggers.
 *
 * The two halves belong together. `advanceFixture` moves the source and emits
 * `source.fixture.advanced` as a ROOT event; `processRefreshJob` fetches, snapshots, diffs and
 * proposes claims under that same root. Leaving them apart would mean advancing a source and
 * waiting on a sweep to notice — which is exactly the lag that made the whole pipeline feel
 * theoretical.
 *
 * Everything that follows is linked to that one root, which is what makes a published price
 * traceable back through the refresh to the version of the source that changed it.
 */
export async function advanceAndTraceAction(formData: FormData) {
  const { principal } = await requireStaff();
  const policyId = text(formData, "policyId");
  if (!policyId) redirect("/admin/sources?error=missing");

  try {
    const { jobId } = await advanceFixture(policyId, principal.email);
    const result = await processRefreshJob(jobId);
    revalidatePath("/admin/sources");
    revalidatePath("/admin/review");
    // A refresh can legitimately end in "not-modified" — the source did not change — which carries
    // no claim count. Reporting that honestly matters more than always having a number to show.
    const claims = result && "proposedClaims" in result ? result.proposedClaims : 0;
    redirect(`/admin/sources?refreshed=1&claims=${claims}&status=${encodeURIComponent(result?.status ?? "completed")}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw error;
    redirect(`/admin/sources?error=${encodeURIComponent(error instanceof Error ? error.message.slice(0, 160) : "refresh failed")}`);
  }
}
