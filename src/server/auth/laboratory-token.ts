import { NextResponse } from "next/server";
import { authenticateLaboratoryApiToken } from "@/server/evidence-network/repository";

export async function requireLaboratoryBearerScope(request: Request, scope: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return { auth: null, response: NextResponse.json({ error: "Bearer token required" }, { status: 401 }) };
  const auth = await authenticateLaboratoryApiToken(token);
  if (!auth) return { auth: null, response: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }) };
  if (!auth.scopes.includes(scope)) return { auth: null, response: NextResponse.json({ error: `Scope ${scope} required` }, { status: 403 }) };
  return { auth, response: null };
}
