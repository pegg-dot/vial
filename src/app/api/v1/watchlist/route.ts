import { NextResponse } from "next/server";
import { requireApiPrincipal } from "@/server/auth/principal";
import { getSavedStackSlugs, getWatchlistSlugs, setWatchlistItem } from "@/server/account/repository";
import { isStackKey, stackSlugFromKey } from "@/lib/saved-stacks";
import { stackBySlug } from "@/lib/stacks";

// Saved listings and saved stacks share one store (see src/lib/saved-stacks.ts); the response
// hands them back already split so no client has to know the key scheme. `slugs` keeps its
// meaning — listing slugs only — for anyone who read it before `stacks` existed.
async function payload(userId: string) {
  const [slugs, stacks] = await Promise.all([getWatchlistSlugs(userId), getSavedStackSlugs(userId)]);
  return { slugs, stacks };
}

export async function GET() {
  const a = await requireApiPrincipal();
  if (a.response) return a.response;
  return NextResponse.json(await payload(a.principal.id));
}

export async function PUT(req: Request) {
  const a = await requireApiPrincipal();
  if (a.response) return a.response;
  const b = await req.json().catch(() => null) as { slug?: unknown; watched?: unknown } | null;
  const slug = String(b?.slug ?? "").trim();
  if (!slug || slug.length > 160) return NextResponse.json({ error: "Invalid watchlist request" }, { status: 400 });
  // A stack key must name a stack we actually publish — the store has no other guard on it.
  if (isStackKey(slug) && !stackBySlug(stackSlugFromKey(slug))) return NextResponse.json({ error: "Unknown stack" }, { status: 400 });
  await setWatchlistItem(a.principal.id, slug, Boolean(b?.watched));
  return NextResponse.json(await payload(a.principal.id));
}
