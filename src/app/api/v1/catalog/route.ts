import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { toCatalogLite } from "@/lib/catalog-lite";
// Served from the CDN for 15 minutes. The catalog behind it changes once a day when the collect
// cron runs, and every client tab polls this route, so "no-store" meant every poll from every tab
// reached the origin and read the database. stale-while-revalidate keeps it instant afterwards.
//
// `?shape=lite` returns the projection the browser actually consumes — the fields the search
// overlay, compare dock and market card read, and nothing else. That is what MarketplaceProvider
// polls, so an open tab no longer re-downloads every price history and evidence dimension four
// times an hour. The default stays the full snapshot: this route is listed in the OpenAPI
// document, and quietly narrowing an already-published response shape would break anyone reading
// it. Callers opt in.
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const catalog = await getCatalogSnapshot();
  const lite = request.nextUrl.searchParams.get("shape") === "lite";
  return NextResponse.json(
    { data: lite ? toCatalogLite(catalog) : catalog, meta: { source: "published-catalog-projection", shape: lite ? "lite" : "full", commerceEnabled: false } },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
  );
}
