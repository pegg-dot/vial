import { NextResponse } from "next/server";
import { buildComparison } from "@/server/compare/build";

// Public: assemble a deep comparison for a set of listing slugs (the compare selections live in
// the browser). Read-only over public catalog + published signals.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const slugs = Array.isArray(body?.slugs) ? body.slugs.filter((s: unknown): s is string => typeof s === "string").slice(0, 4) : [];
  if (slugs.length === 0) return NextResponse.json({ entries: [] });
  const result = await buildComparison(slugs);
  return NextResponse.json(result, { headers: { "cache-control": "private, max-age=30" } });
}
