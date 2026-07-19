import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiLaboratoryPermission } from "@/server/auth/principal";
import { getLaboratoryContext, revokeLaboratoryReport } from "@/server/evidence-network/repository";
const input=z.object({reason:z.string().min(5)});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const gate=await requireApiLaboratoryPermission("lab:reports:revoke");if(gate.response)return gate.response;const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Reason required"},{status:400});const c=await getLaboratoryContext(gate.principal.email);if(!c)return NextResponse.json({error:"Laboratory membership not found"},{status:404});const {id}=await params;try{return NextResponse.json(await revokeLaboratoryReport({laboratoryId:String(c.lab.id),reportId:id,actorId:gate.principal.id,reason:parsed.data.reason}))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Revocation failed"},{status:409})}}
