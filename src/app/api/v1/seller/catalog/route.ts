import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSellerPermission } from "@/server/auth/principal";
import { createSellerProduct, getSellerContext } from "@/server/seller/ops";

const schema = z.object({ title: z.string().min(1).max(180), description: z.string().max(4000).optional(), compoundEntityId: z.string().nullable().optional(), quantityLabel: z.string().min(1), sku: z.string().max(80).optional(), price: z.number().nonnegative(), inventory: z.number().int().nonnegative() });
export async function GET() { const auth=await requireApiSellerPermission("seller:catalog:read"); if(auth.response)return auth.response; const context=await getSellerContext(auth.principal.email); return context?NextResponse.json({products:context.products,batches:context.batches}):NextResponse.json({error:"Seller workspace not found"},{status:404}); }
export async function POST(request:Request){const auth=await requireApiSellerPermission("seller:catalog:write");if(auth.response)return auth.response;const context=await getSellerContext(auth.principal.email);if(!context)return NextResponse.json({error:"Seller workspace not found"},{status:404});const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid product payload",details:parsed.error.flatten()},{status:400});const id=await createSellerProduct({sellerId:context.sellerId,actorId:auth.principal.id,...parsed.data});return NextResponse.json({id},{status:201});}
