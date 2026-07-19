import { NextRequest, NextResponse } from "next/server";
import { searchMarket } from "@/server/search/engine";
export async function GET(request:NextRequest){const query=request.nextUrl.searchParams.get("q")?.trim()??"";if(!query)return NextResponse.json({query,results:[]});const types=request.nextUrl.searchParams.getAll("type").filter(Boolean);const data=await searchMarket({query,types:types.length?types:undefined,limit:Math.min(30,Math.max(1,Number(request.nextUrl.searchParams.get("limit")??10)))});return NextResponse.json(data,{headers:{"Cache-Control":"private, max-age=30"}});}
