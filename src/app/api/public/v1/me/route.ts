import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ data: { keyId: auth.access.keyId, ownerId: auth.access.ownerId, scopes: auth.access.scopes }, meta: { version: "v1" } }, { headers: { "cache-control": "no-store" } });
}
