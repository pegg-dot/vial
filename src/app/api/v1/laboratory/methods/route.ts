import { NextResponse } from "next/server";
import { requireApiLaboratoryPermission } from "@/server/auth/principal";
import { getLaboratoryContext } from "@/server/evidence-network/repository";
export async function GET(){const gate=await requireApiLaboratoryPermission("lab:methods:read");if(gate.response)return gate.response;const c=await getLaboratoryContext(gate.principal.email);return NextResponse.json({methods:c?.methods??[]})}
