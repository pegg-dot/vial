import { NextResponse } from "next/server";
import { z } from "zod";
import { runVerification } from "@/server/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const Schema = z.object({ query: z.string().trim().min(1).max(200) });

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter something to check." }, { status: 400 });
  const result = await runVerification(parsed.data.query);
  return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
}
