import { NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { ensureEvidenceNetworkSeed } from "@/server/evidence-network/repository";
import { getRegistryRecord, decodeVialId } from "@/server/registry/repository";

export const dynamic = "force-dynamic";

// Public resolver for a canonical VIAL ID. The evidence spine seeds lazily, so ensure it
// is present before resolving lab/batch identifiers.
export async function GET(request: Request, { params }: { params: Promise<{ vialId: string }> }) {
  const auth = await requireApiKey(request, "identity:read");
  if (auth.response) return auth.response;
  await ensureEvidenceNetworkSeed();
  const { vialId } = await params;
  const record = await getRegistryRecord(decodeVialId(vialId));
  if (!record) return NextResponse.json({ error: "Unknown VIAL ID" }, { status: 404 });
  return NextResponse.json(
    { data: record, meta: { standard: "vial-registry", version: "v1", readonly: true } },
    { headers: { "cache-control": "no-store" } },
  );
}
