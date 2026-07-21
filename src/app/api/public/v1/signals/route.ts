import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { getPublicSignals } from "@/server/intelligence/repository";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request, "signals:read");
  if (auth.response) return auth.response;
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 25) || 25, 1), 100);
  const signals = await getPublicSignals(limit);
  return NextResponse.json({ data: signals, meta: { source: "published-opportunity-signals", version: "v1", readonly: true } }, { headers: { "cache-control": "no-store" } });
}
