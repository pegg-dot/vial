import { NextResponse } from "next/server";
import { requireLaboratoryBearerScope } from "@/server/auth/laboratory-token";
import { submitEvidenceProposal } from "@/server/evidence-network/repository";
import { decodeVialId } from "@/server/registry/repository";

export const dynamic = "force-dynamic";

// External evidence submission against a canonical VIAL ID — the two-sided flywheel.
// Authenticated by a laboratory API token (vlab_…) with the evidence:propose scope,
// proposal-only: the submission lands in the human review queue and can never publish or
// approve evidence.
export async function POST(request: Request, { params }: { params: Promise<{ vialId: string }> }) {
  const gate = await requireLaboratoryBearerScope(request, "evidence:propose");
  if (gate.response) return gate.response;
  let body: { proposalType?: unknown; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { vialId } = await params;
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? (body.payload as Record<string, unknown>) : {};
  const result = await submitEvidenceProposal({ laboratoryId: gate.auth!.laboratoryId, tokenId: gate.auth!.tokenId, vialId: decodeVialId(vialId), proposalType: String(body.proposalType ?? ""), payload });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code });
  return NextResponse.json(
    { data: { id: result.id, status: result.status }, meta: { standard: "vial-registry", proposalOnly: true, note: "Submitted for human review — not published." } },
    { status: 201 },
  );
}
