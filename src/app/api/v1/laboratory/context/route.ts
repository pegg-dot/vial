import { NextResponse } from "next/server";
import { requireApiPrincipal } from "@/server/auth/principal";
import { getLaboratoryContext } from "@/server/evidence-network/repository";
export async function GET(){const gate=await requireApiPrincipal({accountTypes:["laboratory"]});if(gate.response)return gate.response;const context=await getLaboratoryContext(gate.principal.email);if(!context)return NextResponse.json({error:"Laboratory membership not found"},{status:404});return NextResponse.json({laboratory:context.lab,membership:context.membership,onboarding:context.onboarding,counts:{orders:context.orders.length,samples:context.samples.length,methods:context.methods.length,reports:context.reports.length}})}
