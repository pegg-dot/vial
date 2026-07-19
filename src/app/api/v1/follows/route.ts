import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPrincipal } from "@/server/auth/principal";
import { listFollows, setFollow } from "@/server/consumer-intelligence/repository";
const schema=z.object({entityType:z.enum(["compound","vendor","listing"]),entitySlug:z.string().trim().min(1).max(120),followed:z.boolean()});
export async function GET(){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;return NextResponse.json({follows:await listFollows(a.principal.id)},{headers:{"cache-control":"private, no-store"}})}
export async function PUT(request:Request){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid follow request"},{status:400});return NextResponse.json({follows:await setFollow(a.principal.id,parsed.data.entityType,parsed.data.entitySlug,parsed.data.followed)})}
