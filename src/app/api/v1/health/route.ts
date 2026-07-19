import { NextResponse } from "next/server";
import { getAdminMetrics } from "@/server/review/repository";
export const dynamic = "force-dynamic";
export async function GET(){try{const metrics=await getAdminMetrics();return NextResponse.json({status:"ok",database:"reachable",workflow:{pendingClaims:metrics.pendingClaims,activeRuns:metrics.activeRuns},time:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}})}catch(error){return NextResponse.json({status:"degraded",database:"unreachable",error:error instanceof Error?error.message:"Unknown database error",time:new Date().toISOString()},{status:503})}}
