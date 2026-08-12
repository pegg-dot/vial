import { afterEach,describe,expect,it } from "vitest";
import { getEnvironment,resetEnvironmentForTests } from "@/server/config/env";
const env=process.env as Record<string,string|undefined>;
const keys=["NODE_ENV","NEXT_PUBLIC_SITE_URL","DATABASE_URL","VIALGRADE_SESSION_SECRET","VIALGRADE_PRIVACY_HASH_SECRET","VIALGRADE_PGLITE_MEMORY","VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS"] as const;
const saved=Object.fromEntries(keys.map(k=>[k,env[k]]));
afterEach(()=>{for(const k of keys){const v=saved[k];if(v===undefined)delete env[k];else env[k]=v}resetEnvironmentForTests()});
describe("production environment contract",()=>{
 it("fails closed without production secrets and database",()=>{env.NODE_ENV="production";env.NEXT_PUBLIC_SITE_URL="https://vialgrade.example";delete env.DATABASE_URL;delete env.VIALGRADE_SESSION_SECRET;delete env.VIALGRADE_PRIVACY_HASH_SECRET;resetEnvironmentForTests();expect(()=>getEnvironment()).toThrow("Missing production environment variables")});
 it("accepts a complete production contract",()=>{Object.assign(env,{NODE_ENV:"production",NEXT_PUBLIC_SITE_URL:"https://vialgrade.example",DATABASE_URL:"postgres://user:pass@db.example/vial",VIALGRADE_SESSION_SECRET:"a".repeat(32),VIALGRADE_PRIVACY_HASH_SECRET:"b".repeat(32)});resetEnvironmentForTests();expect(getEnvironment().DATABASE_URL).toContain("postgres")});
 it("limits the embedded production escape hatch to memory on loopback",()=>{Object.assign(env,{NODE_ENV:"production",NEXT_PUBLIC_SITE_URL:"http://localhost:3000",VIALGRADE_PGLITE_MEMORY:"true",VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS:"true",VIALGRADE_SESSION_SECRET:"a".repeat(32),VIALGRADE_PRIVACY_HASH_SECRET:"b".repeat(32)});delete env.DATABASE_URL;resetEnvironmentForTests();expect(getEnvironment().VIALGRADE_PGLITE_MEMORY).toBe(true)});
});
