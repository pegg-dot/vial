import { NextResponse } from "next/server";
import { requireApiSellerPermission } from "@/server/auth/principal";
import { getSellerContext, revokeSellerApiToken } from "@/server/seller/ops";
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){const auth=await requireApiSellerPermission("seller:tokens:manage");if(auth.response)return auth.response;const context=await getSellerContext(auth.principal.email);if(!context)return NextResponse.json({error:"Seller workspace not found"},{status:404});const {id}=await params;return NextResponse.json({revoked:await revokeSellerApiToken({sellerId:context.sellerId,tokenId:id})});}
