import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { getCatalogSnapshot } from "@/server/catalog/repository";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request, "market:read");
  if (auth.response) return auth.response;
  const catalog = await getCatalogSnapshot();
  return NextResponse.json({ data: catalog, meta: { source: "published-catalog-projection", version: "v1", readonly: true } }, { headers: { "cache-control": "no-store" } });
}
