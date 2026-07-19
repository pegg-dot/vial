import { NextRequest, NextResponse } from "next/server";
import { getAlertsForListingSlugs } from "@/server/intelligence/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const slugs = (request.nextUrl.searchParams.get("slugs") ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .slice(0, 50);
  const alerts = await getAlertsForListingSlugs(slugs, 75);
  return NextResponse.json({ alerts, generatedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
