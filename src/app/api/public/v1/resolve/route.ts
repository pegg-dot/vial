import { NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { ensureEvidenceNetworkSeed } from "@/server/evidence-network/repository";
import { resolveToRegistry, type RegistryEntityType } from "@/server/registry/repository";

export const dynamic = "force-dynamic";

const TYPES: RegistryEntityType[] = ["compound", "vendor", "product", "lab", "batch", "source"];

// Maps a real-world label to a canonical VIAL ID — the public entry point to the
// resolution flywheel.
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "identity:read");
  if (auth.response) return auth.response;
  await ensureEvidenceNetworkSeed();
  const url = new URL(request.url);
  const label = url.searchParams.get("label")?.trim();
  if (!label) return NextResponse.json({ error: "A `label` query parameter is required" }, { status: 400 });
  const typeParam = url.searchParams.get("type");
  const type = typeParam && TYPES.includes(typeParam as RegistryEntityType) ? (typeParam as RegistryEntityType) : undefined;
  const resolution = await resolveToRegistry(label, type);
  return NextResponse.json(
    { data: resolution, meta: { standard: "vial-registry", version: "v1", readonly: true } },
    { headers: { "cache-control": "no-store" } },
  );
}
