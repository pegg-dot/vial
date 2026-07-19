import { NextResponse } from "next/server";
import { requireLaboratoryBearerScope } from "@/server/auth/laboratory-token";
import { getDatabase } from "@/server/db/client";
export async function GET(request:Request){const gate=await requireLaboratoryBearerScope(request,"lab:read");if(gate.response)return gate.response;const db=await getDatabase();const rows=await db.query(`SELECT id,method_code,name,version,technique,analytes,matrices,dimensions,validation_status,accreditation_covered FROM laboratory_methods WHERE laboratory_id=$1 ORDER BY technique,name`,[gate.auth!.laboratoryId]);return NextResponse.json({methods:rows.rows})}
