import { NextResponse } from "next/server";
import { authenticateSellerApiToken } from "@/server/seller/ops";

export async function requireSellerBearerScope(request: Request, scope: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return { auth: null, response: NextResponse.json({ error: "Bearer token required" }, { status: 401 }) };
  const auth = await authenticateSellerApiToken(token);
  if (!auth) return { auth: null, response: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }) };
  if (!auth.scopes.includes(scope)) return { auth: null, response: NextResponse.json({ error: `Scope ${scope} required` }, { status: 403 }) };
  return { auth, response: null };
}
