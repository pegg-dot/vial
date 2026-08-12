import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticateCredentials } from "@/server/auth/authenticate";
import { decodeSessionEnvelope } from "@/server/auth/session-envelope";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { getPrincipalBySession } from "@/server/auth/repository";
import { getWatchlistSlugs, setWatchlistItem } from "@/server/account/repository";
import { getSellerWorkspace } from "@/server/seller/repository";

process.env.VIALGRADE_PGLITE_MEMORY="true";process.env.VIALGRADE_SEED_FIXTURES="true";process.env.VIALGRADE_SEED_DEMO_ACCOUNTS="true";process.env.VIALGRADE_SESSION_SECRET="integration-session-secret-at-least-32-characters";process.env.VIALGRADE_PRIVACY_HASH_SECRET="integration-privacy-secret-at-least-32-characters";
const context={requestId:"auth-integration",ipHash:"integration-ip",userAgentHash:"integration-agent"};
describe("production identity and tenant foundation",()=>{
 beforeAll(async()=>{await resetDatabaseForTests();await getDatabase()});
 afterAll(async()=>{await resetDatabaseForTests()});
 it("authenticates each seeded account into a durable signed session",async()=>{
  for(const [email,password,type] of [["nora@example.test","VialGradeDemoCustomer!2026","customer"],["marcus@helixtest.test","VialGradeDemoSeller!2026","seller"],["maya@vialgrade.test","VialGradeDemoReviewer!2026","staff"],["jon@vialgrade.test","VialGradeDemoAdmin!2026","staff"]] as const){const result=await authenticateCredentials({email,password,requiredAccountType:type},context);expect(result.ok,email).toBe(true);if(!result.ok)continue;const envelope=decodeSessionEnvelope(result.cookieValue);expect(envelope?.accountType).toBe(type);expect((await getPrincipalBySession(result.sessionId))?.email).toBe(email)}
 });
 it("rejects incorrect credentials and account-family mismatch",async()=>{expect((await authenticateCredentials({email:"nora@example.test",password:"wrong"},context)).ok).toBe(false);expect((await authenticateCredentials({email:"nora@example.test",password:"VialGradeDemoCustomer!2026",requiredAccountType:"staff"},context)).ok).toBe(false)});
 it("isolates database watchlists and seller workspaces",async()=>{await setWatchlistItem("user:customer:nora","helix-bpc-157-10mg",true);expect(await getWatchlistSlugs("user:customer:nora")).toContain("helix-bpc-157-10mg");expect(await getWatchlistSlugs("user:seller:marcus")).not.toContain("helix-bpc-157-10mg");const seller=await getSellerWorkspace("marcus@helixtest.test");expect(seller?.sellerId).toBeTruthy();expect(await getSellerWorkspace("nora@example.test")).toBeNull();expect(seller?.catalog.every(row=>String((row as {seller_id:unknown}).seller_id)===seller.sellerId)).toBe(true)});
});
