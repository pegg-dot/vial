import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiLaboratoryPermission } from "@/server/auth/principal";
import { getLaboratoryContext, issueLaboratoryReport } from "@/server/evidence-network/repository";
const input=z.object({testOrderId:z.string().min(1),sampleId:z.string().min(1),reportNumber:z.string().min(3),summary:z.string().min(3)});
export async function GET(){const gate=await requireApiLaboratoryPermission("lab:orders:read");if(gate.response)return gate.response;const c=await getLaboratoryContext(gate.principal.email);return NextResponse.json({reports:c?.reports??[]})}
export async function POST(request:Request){const gate=await requireApiLaboratoryPermission("lab:reports:issue");if(gate.response)return gate.response;const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid report",issues:parsed.error.flatten()},{status:400});const c=await getLaboratoryContext(gate.principal.email);if(!c)return NextResponse.json({error:"Laboratory membership not found"},{status:404});try{return NextResponse.json(await issueLaboratoryReport({laboratoryId:String(c.lab.id),actorId:gate.principal.id,...parsed.data}),{status:201})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Report issue failed"},{status:409})}}
