import { NextResponse } from "next/server";
import { getCatalogSnapshot } from "@/server/catalog/repository";
export const dynamic = "force-dynamic";
export async function GET(){const catalog=await getCatalogSnapshot();return NextResponse.json({data:catalog,meta:{source:"published-catalog-projection",commerceEnabled:false}},{headers:{"Cache-Control":"no-store"}})}
