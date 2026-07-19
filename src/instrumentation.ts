import { getEnvironment } from "@/server/config/env";
export async function register(){if(process.env.NEXT_RUNTIME!=="edge")getEnvironment()}
