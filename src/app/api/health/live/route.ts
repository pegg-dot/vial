import { NextResponse } from "next/server";
import { getEnvironment } from "@/server/config/env";
export const dynamic="force-dynamic";
export function GET(){const env=getEnvironment();return NextResponse.json({status:"ok",service:"vial",release:env.VIALGRADE_RELEASE,build:env.VIALGRADE_BUILD_SHA,time:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}})}
