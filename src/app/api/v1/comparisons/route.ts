import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPrincipal } from "@/server/auth/principal";
import { createNamedComparison, getDefaultComparison, listComparisons, saveDefaultComparison } from "@/server/consumer-intelligence/repository";
const slugs=z.array(z.string().trim().min(1).max(120)).max(4);
export async function GET(){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;return NextResponse.json({current:await getDefaultComparison(a.principal.id),comparisons:await listComparisons(a.principal.id)},{headers:{"cache-control":"private, no-store"}})}
export async function PUT(request:Request){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;const parsed=z.object({listingSlugs:slugs}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid comparison"},{status:400});return NextResponse.json(await saveDefaultComparison(a.principal.id,parsed.data.listingSlugs))}
export async function POST(request:Request){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;const parsed=z.object({name:z.string().trim().min(2).max(80),listingSlugs:slugs,notes:z.record(z.string(),z.string().max(500)).optional()}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid comparison"},{status:400});return NextResponse.json(await createNamedComparison(a.principal.id,parsed.data),{status:201})}
