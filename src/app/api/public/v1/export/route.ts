import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/server/api-access/bearer";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { getPublicSignals } from "@/server/intelligence/repository";
import { toCsv } from "@/server/api-access/csv";

export const dynamic = "force-dynamic";
const ROW_CAP = 1000;

// Only primitive fields are exported — nested arrays/objects (price history, accents,
// evidence sub-records) are dropped so an export is a clean, flat, tabular projection.
function primitiveColumns(rows: Record<string, unknown>[]): string[] {
  const columns = new Set<string>();
  for (const row of rows.slice(0, 50)) {
    for (const [key, value] of Object.entries(row)) {
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) columns.add(key);
    }
  }
  return [...columns];
}

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request, "export:read");
  if (auth.response) return auth.response;

  const params = new URL(request.url).searchParams;
  const dataset = (params.get("dataset") ?? "catalog").toLowerCase();
  const format = (params.get("format") ?? "json").toLowerCase();
  if (!["catalog", "signals"].includes(dataset)) return NextResponse.json({ error: "dataset must be catalog or signals" }, { status: 400 });
  if (!["json", "csv"].includes(format)) return NextResponse.json({ error: "format must be json or csv" }, { status: 400 });

  const rows: Record<string, unknown>[] = dataset === "signals"
    ? (await getPublicSignals(ROW_CAP)) as unknown as Record<string, unknown>[]
    : ((await getCatalogSnapshot()).products as unknown as Record<string, unknown>[]).slice(0, ROW_CAP);

  if (format === "csv") {
    const columns = primitiveColumns(rows);
    const csv = toCsv(rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c]]))), columns);
    return new NextResponse(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="vial-${dataset}.csv"`, "cache-control": "no-store" },
    });
  }
  return NextResponse.json({ data: rows, meta: { dataset, count: rows.length, cap: ROW_CAP, version: "v1", readonly: true } }, { headers: { "cache-control": "no-store" } });
}
