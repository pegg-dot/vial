import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/server/db/client";
import { ensureInternalOpsSeed, listRows, runScenario } from "@/server/internal-ops/repository";
describe("internal marketplace operations",()=>{beforeEach(async()=>{const db=await getDatabase();await db.query("DELETE FROM scenario_runs")});it("seeds operations and records a simulation",async()=>{await ensureInternalOpsSeed();expect((await listRows("internal_users")).length).toBeGreaterThanOrEqual(4);expect((await listRows("support_cases")).length).toBeGreaterThanOrEqual(3);const result=await runScenario("seller_suspension");expect(result.outputs.payoutHold).toBe(true);expect((await listRows("scenario_runs"))).toHaveLength(1)})});
