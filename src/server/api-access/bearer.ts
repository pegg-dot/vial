import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { resolveApiKey, type ApiScope, type ResolvedApiKey } from "./keys";

export interface ApiAccess {
  keyId: string;
  ownerId: string;
  scopes: ApiScope[];
}

// Guard for the public programmatic API. Bearer-authenticated (not session), scope-
// checked, and rate-limited per key. Returns a ready JSON error response on any failure.
export async function requireApiKey(request: Request, scope?: ApiScope): Promise<{ access: ApiAccess; response: null } | { access: null; response: NextResponse }> {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return { access: null, response: NextResponse.json({ error: "Bearer API key required" }, { status: 401 }) };
  }
  const resolved: ResolvedApiKey | null = await resolveApiKey(token);
  if (!resolved) {
    return { access: null, response: NextResponse.json({ error: "Invalid, revoked, or expired API key" }, { status: 401 }) };
  }
  if (scope && !resolved.scopes.includes(scope)) {
    return { access: null, response: NextResponse.json({ error: `This key lacks the required scope: ${scope}` }, { status: 403 }) };
  }
  const limit = await consumeRateLimit({ bucket: "public-api", key: resolved.id, limit: 120, windowSeconds: 60 });
  if (!limit.allowed) {
    return { access: null, response: NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "retry-after": "60" } }) };
  }
  return { access: { keyId: resolved.id, ownerId: resolved.ownerId, scopes: resolved.scopes }, response: null };
}
