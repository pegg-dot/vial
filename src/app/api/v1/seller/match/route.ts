import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSellerPermission } from "@/server/auth/principal";
import { matchSellerProduct } from "@/server/seller/matching";
const schema=z.object({title:z.string().min(1),description:z.string().optional(),sku:z.string().optional(),tags:z.array(z.string()).optional()});
export async function POST(request:Request){const auth=await requireApiSellerPermission("seller:catalog:read");if(auth.response)return auth.response;const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid match payload"},{status:400});return NextResponse.json(await matchSellerProduct(parsed.data));}
