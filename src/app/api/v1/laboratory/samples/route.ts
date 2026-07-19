import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiLaboratoryPermission } from "@/server/auth/principal";
import { accessionSample, getLaboratoryContext } from "@/server/evidence-network/repository";
const input=z.object({sampleId:z.string().min(1),condition:z.string().min(1),sealStatus:z.string().min(1),location:z.string().min(1)});
export async function GET(){const gate=await requireApiLaboratoryPermission("lab:samples:read");if(gate.response)return gate.response;const c=await getLaboratoryContext(gate.principal.email);return NextResponse.json({samples:c?.samples??[]})}
export async function POST(request:Request){const gate=await requireApiLaboratoryPermission("lab:samples:accession");if(gate.response)return gate.response;const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid sample accession",issues:parsed.error.flatten()},{status:400});const c=await getLaboratoryContext(gate.principal.email);if(!c)return NextResponse.json({error:"Laboratory membership not found"},{status:404});try{return NextResponse.json(await accessionSample({laboratoryId:String(c.lab.id),actorId:gate.principal.id,...parsed.data}))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Accession failed"},{status:409})}}
