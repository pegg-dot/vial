import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPrincipal } from "@/server/auth/principal";
import { listUserNotifications, updateNotificationStatus } from "@/server/consumer-intelligence/repository";
import { syncWatchlistNotifications } from "@/server/consumer-intelligence/service";
export async function GET(request:NextRequest){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;if(request.nextUrl.searchParams.get("sync")==="true")await syncWatchlistNotifications(a.principal.id);return NextResponse.json({notifications:await listUserNotifications(a.principal.id,{status:request.nextUrl.searchParams.get("status")??undefined,limit:100})},{headers:{"cache-control":"private, no-store"}})}
export async function PATCH(request:Request){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;const parsed=z.object({id:z.string().min(1),status:z.enum(["read","unread","dismissed"])}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid notification update"},{status:400});return NextResponse.json({updated:await updateNotificationStatus(a.principal.id,parsed.data.id,parsed.data.status)})}
