import { NextResponse } from "next/server";
import { requireLaboratoryBearerScope } from "@/server/auth/laboratory-token";
import { submitEvidenceProposal } from "@/server/evidence-network/repository";
import { decodeRegistryId } from "@/server/registry/repository";

export const dynamic = "force-dynamic";

// External evidence submission against a canonical VialGrade ID — the two-sided flywheel.
// Authenticated by a laboratory API token (vlab_…) with the evidence:propose scope,
// proposal-only: the submission lands in the human review queue and can never publish or
// approve evidence.
export async function POST(request: Request, { params }: { params: Promise<{ registryId: string }> }) {
  const gate = await requireLaboratoryBearerScope(request, "evidence:propose");
  if (gate.response) return gate.response;
  let body: { proposalType?: unknown; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { registryId } = await params;
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? (body.payload as Record<string, unknown>) : {};
  const result = await submitEvidenceProposal({ laboratoryId: gate.auth!.laboratoryId, tokenId: gate.auth!.tokenId, registryId: decodeRegistryId(registryId), proposalType: String(body.proposalType ?? ""), payload });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code });
  return NextResponse.json(
    { data: { id: result.id, status: result.status }, meta: { standard: "vialgrade-registry", proposalOnly: true, note: "Submitted for human review — not published." } },
    { status: 201 },
  );
}
