import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPrincipal } from "@/server/auth/principal";
import { listDecisionEvents, recordDecisionEvent } from "@/server/consumer-intelligence/repository";
const schema=z.object({eventType:z.enum(["listing_viewed","listing_saved","listing_removed","comparison_created","comparison_updated","evidence_opened","saved_search_run","followed","unfollowed","stack_saved","stack_removed"]),subjectType:z.enum(["listing","compound","vendor","saved_search","comparison","stack"]),subjectId:z.string().trim().min(1).max(160),metadata:z.record(z.string(),z.unknown()).optional()});
export async function GET(){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;return NextResponse.json({events:await listDecisionEvents(a.principal.id,100)},{headers:{"cache-control":"private, no-store"}})}
export async function POST(request:Request){const a=await requireApiPrincipal({accountTypes:["customer","seller"]});if(a.response)return a.response;const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid decision event"},{status:400});return NextResponse.json({id:await recordDecisionEvent(a.principal.id,parsed.data)},{status:201})}
