import { NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { getBatchStandardRecord } from "@/server/evidence-network/repository";

export const dynamic = "force-dynamic";

// Public batch-history standard: the decomposed passport plus its append-only version
// history, resolvable by canonical vial:batch ID.
export async function GET(request: Request, { params }: { params: Promise<{ vialBatchId: string }> }) {
  const auth = await requireApiKey(request, "market:read");
  if (auth.response) return auth.response;
  const { vialBatchId } = await params;
  const record = await getBatchStandardRecord(decodeURIComponent(vialBatchId));
  if (!record) return NextResponse.json({ error: "Unknown batch VIAL ID" }, { status: 404 });
  return NextResponse.json(
    { data: record, meta: { standard: "vial-batch-history", version: "v1", readonly: true } },
    { headers: { "cache-control": "no-store" } },
  );
}
