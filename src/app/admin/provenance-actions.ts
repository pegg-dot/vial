"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth/session";
import { runSourceIngestion } from "@/server/agents/pipeline";
import { reviewClaim } from "@/server/review/repository";
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
