import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSellerPermission } from "@/server/auth/principal";
import { getDatabase } from "@/server/db/client";
import { createSellerApiToken, getSellerContext } from "@/server/seller/ops";
const schema=z.object({name:z.string().min(1).max(80),scopes:z.array(z.enum(["seller:read","catalog:read","catalog:propose","evidence:read","evidence:propose"])).min(1)});
export async function GET(){const auth=await requireApiSellerPermission("seller:tokens:manage");if(auth.response)return auth.response;const context=await getSellerContext(auth.principal.email);if(!context)return NextResponse.json({error:"Seller workspace not found"},{status:404});const db=await getDatabase();const rows=await db.query(`SELECT id,name,token_prefix,scopes,last_used_at,expires_at,revoked_at,created_at FROM seller_api_tokens WHERE seller_id=$1 ORDER BY created_at DESC`,[context.sellerId]);return NextResponse.json({tokens:rows.rows});}
export async function POST(request:Request){const auth=await requireApiSellerPermission("seller:tokens:manage");if(auth.response)return auth.response;const context=await getSellerContext(auth.principal.email);if(!context)return NextResponse.json({error:"Seller workspace not found"},{status:404});const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid token request",details:parsed.error.flatten()},{status:400});return NextResponse.json(await createSellerApiToken({sellerId:context.sellerId,actorId:auth.principal.id,...parsed.data}),{status:201});}
