import { NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { getReputationRecord } from "@/server/reputation/repository";
import { decodeVialId } from "@/server/registry/repository";

export const dynamic = "force-dynamic";

// Public reputation standard: a decomposable, provenance-linked record for a vendor or
// laboratory — never a composite score.
export async function GET(request: Request, { params }: { params: Promise<{ vialId: string }> }) {
  const auth = await requireApiKey(request, "reputation:read");
  if (auth.response) return auth.response;
  const { vialId } = await params;
  const record = await getReputationRecord(decodeVialId(vialId));
  if (!record) return NextResponse.json({ error: "Unknown VIAL ID for reputation" }, { status: 404 });
  return NextResponse.json(
    { data: record, meta: { standard: "vial-reputation", version: "v1", readonly: true, note: "Decomposed dimensions, not a composite score." } },
    { headers: { "cache-control": "no-store" } },
  );
}
