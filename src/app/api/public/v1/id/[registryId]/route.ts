import { NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { ensureEvidenceNetworkSeed } from "@/server/evidence-network/repository";
import { getRegistryRecord, decodeRegistryId } from "@/server/registry/repository";

export const dynamic = "force-dynamic";

// Public resolver for a canonical VialGrade ID. The evidence spine seeds lazily, so ensure it
// is present before resolving lab/batch identifiers.
export async function GET(request: Request, { params }: { params: Promise<{ registryId: string }> }) {
  const auth = await requireApiKey(request, "identity:read");
  if (auth.response) return auth.response;
  await ensureEvidenceNetworkSeed();
  const { registryId } = await params;
  const record = await getRegistryRecord(decodeRegistryId(registryId));
  if (!record) return NextResponse.json({ error: "Unknown VialGrade ID" }, { status: 404 });
  return NextResponse.json(
    { data: record, meta: { standard: "vialgrade-registry", version: "v1", readonly: true } },
    { headers: { "cache-control": "no-store" } },
  );
}
