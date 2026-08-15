import { NextResponse } from "next/server";
import { checkReadiness } from "@/server/health/readiness";
export const dynamic="force-dynamic";
// The body carries no driver detail: `checkReadiness` logs the raw error server-side and returns a
// fixed vocabulary ("reachable"/"unreachable"). This endpoint is unauthenticated by design, so a
// leaked "connect ECONNREFUSED 10.0.0.4:5432 (role vialgrade)" would hand a scanner the topology.
export async function GET(){const readiness=await checkReadiness();return NextResponse.json(readiness,{status:readiness.status==="ready"?200:503,headers:{"Cache-Control":"no-store"}})}
