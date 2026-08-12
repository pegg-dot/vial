import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { getPublicSignals } from "@/server/intelligence/repository";
import { filterRiskSignals } from "@/server/api-access/feeds";
import { toCsv } from "@/server/api-access/csv";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request, "feeds:read");
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const types = (params.get("type") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const minScore = params.get("minScore") ? Number(params.get("minScore")) : undefined;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 100);
  const format = (params.get("format") ?? "json").toLowerCase();

  const signals = await getPublicSignals(200);
  const filtered = filterRiskSignals(signals as { signalType: string; score: number }[], { types, minScore, limit });

  if (format === "csv") {
    const columns = ["id", "signalType", "entityType", "entityLabel", "title", "score", "confidence", "status"];
    const rows = (filtered as unknown as Record<string, unknown>[]).map((r) => Object.fromEntries(columns.map((c) => [c, r[c]])));
    return new NextResponse(toCsv(rows, columns), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="vialgrade-risk-feed.csv"', "cache-control": "no-store" } });
  }
  return NextResponse.json({ data: filtered, meta: { source: "published-risk-signals", count: filtered.length, filters: { types, minScore, limit }, version: "v1", readonly: true } }, { headers: { "cache-control": "no-store" } });
}
