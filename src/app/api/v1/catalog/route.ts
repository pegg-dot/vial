import { NextResponse } from "next/server";
import { getCatalogSnapshot } from "@/server/catalog/repository";
// Served from the CDN for 15 minutes. The catalog behind it changes once a day when the collect
// cron runs, and every client tab polls this route, so "no-store" meant every poll from every tab
// reached the origin and read the database. stale-while-revalidate keeps it instant afterwards.
export const dynamic = "force-dynamic";
export async function GET(){const catalog=await getCatalogSnapshot();return NextResponse.json({data:catalog,meta:{source:"published-catalog-projection",commerceEnabled:false}},{headers:{"Cache-Control":"public, s-maxage=900, stale-while-revalidate=3600"}})}
