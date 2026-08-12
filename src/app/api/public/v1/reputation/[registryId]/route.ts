import { NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { getReputationRecord } from "@/server/reputation/repository";
import { decodeRegistryId } from "@/server/registry/repository";

export const dynamic = "force-dynamic";

// Public reputation standard: a decomposable, provenance-linked record for a vendor or
// laboratory — never a composite score.
export async function GET(request: Request, { params }: { params: Promise<{ registryId: string }> }) {
  const auth = await requireApiKey(request, "reputation:read");
  if (auth.response) return auth.response;
  const { registryId } = await params;
  const record = await getReputationRecord(decodeRegistryId(registryId));
  if (!record) return NextResponse.json({ error: "Unknown VialGrade ID for reputation" }, { status: 404 });
  return NextResponse.json(
    { data: record, meta: { standard: "vialgrade-reputation", version: "v1", readonly: true, note: "Decomposed dimensions, not a composite score." } },
    { headers: { "cache-control": "no-store" } },
  );
}
