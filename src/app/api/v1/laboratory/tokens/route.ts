import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiLaboratoryPermission } from "@/server/auth/principal";
import { createLaboratoryApiToken, getLaboratoryContext } from "@/server/evidence-network/repository";
const input=z.object({label:z.string().min(2),scopes:z.array(z.string()).min(1).max(10)});
export async function POST(request:Request){const gate=await requireApiLaboratoryPermission("lab:tokens:manage");if(gate.response)return gate.response;const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid token request",issues:parsed.error.flatten()},{status:400});const c=await getLaboratoryContext(gate.principal.email);if(!c)return NextResponse.json({error:"Laboratory membership not found"},{status:404});return NextResponse.json(await createLaboratoryApiToken({laboratoryId:String(c.lab.id),actorId:gate.principal.id,...parsed.data}),{status:201})}
