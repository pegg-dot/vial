import { NextResponse } from "next/server";
import { requireLaboratoryBearerScope } from "@/server/auth/laboratory-token";
import { getDatabase } from "@/server/db/client";
export async function GET(request:Request){const gate=await requireLaboratoryBearerScope(request,"lab:read");if(gate.response)return gate.response;const db=await getDatabase();const rows=await db.query(`SELECT id,order_number,status,priority,declared_batch_code,requested_dimensions,due_at,created_at FROM laboratory_test_orders WHERE laboratory_id=$1 ORDER BY created_at DESC`,[gate.auth!.laboratoryId]);return NextResponse.json({orders:rows.rows})}
