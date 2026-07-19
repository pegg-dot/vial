"use server";
import { revalidatePath } from "next/cache";
import { requireLaboratoryPermission } from "@/server/auth/session";
import { getLaboratoryContext, accessionSample, appendCustodyEvent, issueLaboratoryReport, revokeLaboratoryReport } from "./repository";

async function context(permission: Parameters<typeof requireLaboratoryPermission>[0]) {
  const principal = await requireLaboratoryPermission(permission);
  const lab = await getLaboratoryContext(principal.email);
  if (!lab) throw new Error("Laboratory membership not found");
  return { principal, lab };
}
export async function accessionSampleAction(formData: FormData) {
  const { principal, lab } = await context("lab:samples:accession");
  await accessionSample({ laboratoryId: String(lab.lab.id), sampleId: String(formData.get("sampleId")), actorId: principal.id, condition: String(formData.get("condition") || "acceptable"), sealStatus: String(formData.get("sealStatus") || "intact"), location: String(formData.get("location") || "Controlled accessioning") });
  revalidatePath("/lab/samples"); revalidatePath("/lab/custody");
}
export async function appendCustodyEventAction(formData: FormData) {
  const { principal, lab } = await context("lab:custody:write");
  const sampleId = String(formData.get("sampleId"));
  const owned = lab.samples.some((sample: Record<string, unknown>) => String(sample.id) === sampleId);
  if (!owned) throw new Error("Sample not found");
  await appendCustodyEvent({ sampleId, eventType: String(formData.get("eventType") || "transferred"), actorType: "user", actorId: principal.id, location: String(formData.get("location") || "Laboratory"), metadata: { note: String(formData.get("note") || "") } });
  revalidatePath("/lab/custody");
}
export async function issueReportAction(formData: FormData) {
  const { principal, lab } = await context("lab:reports:issue");
  await issueLaboratoryReport({ laboratoryId: String(lab.lab.id), testOrderId: String(formData.get("testOrderId")), sampleId: String(formData.get("sampleId")), reportNumber: String(formData.get("reportNumber")), actorId: principal.id, summary: String(formData.get("summary") || "Structured analytical report.") });
  revalidatePath("/lab/reports"); revalidatePath("/passports");
}
export async function revokeReportAction(formData: FormData) {
  const { principal, lab } = await context("lab:reports:revoke");
  await revokeLaboratoryReport({ laboratoryId: String(lab.lab.id), reportId: String(formData.get("reportId")), actorId: principal.id, reason: String(formData.get("reason") || "Revoked by laboratory quality unit") });
  revalidatePath("/lab/reports"); revalidatePath("/passports");
}
