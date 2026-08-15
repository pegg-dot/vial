import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/server/auth/secret-compare";
import { runCollectionTick } from "@/server/collect/scheduler";
import { isLiveIngestApproved } from "@/server/ingest/live-sources";
import { revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/catalog/repository";

export const dynamic = "force-dynamic";
// Pro allows 300s. The tick's own budget stops it well before this; the ceiling is only here so a
// single pathological host cannot take the function down with it.
export const maxDuration = 120;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[cron/collect] CRON_SECRET is not set — continuous collection is DISABLED.");
      return false;
    }
    return true;
  }
  // Vercel Cron signs its own invocations with this header; a manual curl can use it too.
  return secretMatches(request.headers.get("authorization"), `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetching third-party storefronts is an explicit, approved act — never a silent default.
  if (!isLiveIngestApproved()) {
    return NextResponse.json(
      { skipped: "live ingest not approved", hint: "set VIALGRADE_LIVE_INGEST_APPROVED=true" },
      { status: 200 },
    );
  }

  const result = await runCollectionTick({ budgetMs: 45_000, maxTargets: 8 });
  // The catalog is served from cache because the root layout reads it on every request. This is the
  // moment it actually changed, so mark it stale now rather than serving old prices until the
  // revalidate window expires. "max" is stale-while-revalidate: the next visitor gets the cached
  // copy instantly and the refresh happens behind them, so invalidating never causes a stampede of
  // blocking full-catalog reads — which is the cost this whole change exists to avoid.
  revalidateTag(CATALOG_CACHE_TAG, "max");
  return NextResponse.json({ ...result, completedAt: new Date().toISOString() });
}
