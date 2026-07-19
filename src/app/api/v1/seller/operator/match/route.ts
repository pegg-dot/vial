import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSellerBearerScope } from "@/server/auth/seller-token";
import { matchSellerProduct } from "@/server/seller/matching";
const schema=z.object({title:z.string().min(1),description:z.string().optional(),sku:z.string().optional(),tags:z.array(z.string()).optional()});
export async function POST(request:Request){const gate=await requireSellerBearerScope(request,"catalog:read");if(gate.response)return gate.response;const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid payload"},{status:400});return NextResponse.json(await matchSellerProduct(parsed.data));}
