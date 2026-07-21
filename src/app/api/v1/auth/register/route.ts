import { NextResponse } from "next/server";
import { z } from "zod";
import { registerCustomer } from "@/server/auth/register";
import { requestContextFromHeaders } from "@/server/auth/request-context";
import { SESSION_COOKIE } from "@/server/auth/session-envelope";

const Schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(1024),
  displayName: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid sign-up request" }, { status: 400 });

  const result = await registerCustomer(parsed.data, requestContextFromHeaders(req.headers));
  if (!result.ok) {
    const res = NextResponse.json({ error: result.reason }, { status: result.status });
    if (result.retryAfterSeconds) res.headers.set("retry-after", String(result.retryAfterSeconds));
    return res;
  }

  const res = NextResponse.json({ authenticated: true, user: result.principal, expiresAt: result.expiresAt.toISOString() });
  res.cookies.set(SESSION_COOKIE, result.cookieValue, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: result.maxAge });
  res.headers.set("cache-control", "private, no-store");
  return res;
}
