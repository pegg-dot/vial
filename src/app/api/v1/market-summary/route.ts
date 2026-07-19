import { NextResponse } from "next/server";
import { requireApiPrincipal } from "@/server/auth/principal";
import { listMarketChangeSummaries } from "@/server/consumer-intelligence/repository";
import { generateMarketChangeSummary } from "@/server/consumer-intelligence/service";
export async function GET(){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;return NextResponse.json({summaries:await listMarketChangeSummaries(a.principal.id,10)},{headers:{"cache-control":"private, no-store"}})}
export async function POST(){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;return NextResponse.json({summary:await generateMarketChangeSummary(a.principal.id)})}
