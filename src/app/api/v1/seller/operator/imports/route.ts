import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSellerBearerScope } from "@/server/auth/seller-token";
import { runCatalogImport } from "@/server/seller/ops";
const row=z.object({externalId:z.string().optional(),title:z.string().min(1),description:z.string().optional(),sku:z.string().optional(),price:z.number().nonnegative().optional(),inventory:z.number().int().nonnegative().optional(),tags:z.array(z.string()).optional()});
const schema=z.object({provider:z.enum(["shopify","woocommerce","csv","website"]),rows:z.array(row).min(1).max(500)});
export async function POST(request:Request){const gate=await requireSellerBearerScope(request,"catalog:propose");if(gate.response)return gate.response;const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid import payload",details:parsed.error.flatten()},{status:400});const result=await runCatalogImport({sellerId:gate.auth!.sellerId,provider:parsed.data.provider,rows:parsed.data.rows,actorId:`api:${gate.auth!.tokenId}`});return NextResponse.json({approvalRequired:true,...result},{status:201});}
