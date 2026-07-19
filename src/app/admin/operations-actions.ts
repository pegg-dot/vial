"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runSourceIngestion } from "@/server/agents/pipeline";
import { requirePermission } from "@/server/auth/session";
import { runIntelligenceSweep } from "@/server/intelligence/scanner";
import { setOpportunityStatus, type OpportunitySignal } from "@/server/intelligence/repository";
import { advanceFixture, createRefreshJob, toggleSourcePolicy } from "@/server/refresh/repository";
import { processRefreshJob, runRefreshSweep } from "@/server/refresh/scheduler";
import { reviewClaim, type ReviewDecision } from "@/server/review/repository";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function message(error: unknown) {
  return encodeURIComponent(error instanceof Error ? error.message : "The operation could not be completed");
}

function refreshAll() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}

export async function ingestSourceAction(formData: FormData) {
  const session = await requirePermission("catalog:write");
  try {
    const result = await runSourceIngestion({
      sourceType: text(formData, "sourceType") as "vendor-page" | "lab-report" | "policy" | "regulatory" | "manual-note",
      canonicalLocation: text(formData, "canonicalLocation"),
      label: text(formData, "label"),
      targetListingSlug: text(formData, "targetListingSlug"),
      rawContent: String(formData.get("rawContent") ?? ""),
      contentType: text(formData, "contentType") as "text/plain" | "text/html" | "application/json" | "application/ld+json",
      parserProfile: text(formData, "parserProfile") as "generic" | "jsonld" | "document" | "catalog",
      actor: `staff:${session.role}`,
      captureMode: "manual",
    });
    refreshAll();
    redirect(`/admin/review?ingested=${result.proposedClaims}&run=${encodeURIComponent(result.runId)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/ingest?error=${message(error)}`);
  }
}

export async function reviewClaimAction(formData: FormData) {
  const session = await requirePermission("review:decide");
  const claimId = text(formData, "claimId");
  const decision = text(formData, "decision") as ReviewDecision;
  if (!claimId || !["approve", "reject"].includes(decision)) redirect("/admin/review?error=Invalid%20review%20request");
  try {
    const result = await reviewClaim({ claimId, decision, notes: text(formData, "notes"), actor: `staff:${session.role}`, role: session.role });
    refreshAll();
    redirect(result.status === "published" ? `/admin/publications?published=${encodeURIComponent(claimId)}` : `/admin/review?rejected=${encodeURIComponent(claimId)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/review?error=${message(error)}`);
  }
}

export async function runSourceRefreshAction(formData: FormData) {
  const session = await requirePermission("catalog:write");
  const policyId = text(formData, "policyId");
  try {
    const jobId = await createRefreshJob({ policyId, triggerType: "manual", createdBy: `staff:${session.role}`, priority: 20 });
    const result = await processRefreshJob(jobId);
    refreshAll();
    redirect(`/admin/sources?ran=${encodeURIComponent(jobId)}&status=${encodeURIComponent(result.status)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/sources?error=${message(error)}`);
  }
}

export async function advanceAndRefreshFixtureAction(formData: FormData) {
  const session = await requirePermission("admin:manage");
  const policyId = text(formData, "policyId");
  try {
    const advanced = await advanceFixture(policyId, `staff:${session.role}`);
    const result = await processRefreshJob(advanced.jobId);
    refreshAll();
    redirect(`/admin/sources?advanced=${advanced.nextVersion}&status=${encodeURIComponent(result.status)}&trace=${encodeURIComponent(advanced.rootEventId)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/sources?error=${message(error)}`);
  }
}

export async function toggleSourcePolicyAction(formData: FormData) {
  const session = await requirePermission("admin:manage");
  const policyId = text(formData, "policyId");
  const enabled = text(formData, "enabled") === "true";
  try {
    await toggleSourcePolicy(policyId, enabled, `staff:${session.role}`);
    refreshAll();
    redirect(`/admin/sources?policy=${enabled ? "enabled" : "paused"}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/sources?error=${message(error)}`);
  }
}

export async function runRefreshSweepAction() {
  const session = await requirePermission("admin:manage");
  try {
    const refresh = await runRefreshSweep(20);
    const intelligence = await runIntelligenceSweep(`staff:${session.role}`);
    refreshAll();
    redirect(`/admin/sources?sweep=${refresh.processed}&signals=${intelligence.emitted}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/sources?error=${message(error)}`);
  }
}

export async function runIntelligenceSweepAction() {
  const session = await requirePermission("catalog:write");
  try {
    const result = await runIntelligenceSweep(`staff:${session.role}`);
    refreshAll();
    redirect(`/admin/opportunities?sweep=${result.emitted}&evaluated=${result.evaluated}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/opportunities?error=${message(error)}`);
  }
}

export async function updateOpportunityStatusAction(formData: FormData) {
  await requirePermission("catalog:write");
  const id = text(formData, "id");
  const status = text(formData, "status") as OpportunitySignal["status"];
  if (!id || !["open", "watching", "resolved", "dismissed"].includes(status)) redirect("/admin/opportunities?error=Invalid%20signal%20update");
  await setOpportunityStatus({ id, status, note: text(formData, "note") });
  refreshAll();
  redirect(`/admin/opportunities?updated=${encodeURIComponent(id)}`);
}
