import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { ensureEvidenceNetworkSeed } from "@/server/evidence-network/repository";
import { GET as verifyReport } from "@/app/api/v1/reports/[id]/verify/route";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SEED_FIXTURES = "true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
process.env.VIALGRADE_SESSION_SECRET = "report-verify-session-secret-at-least-32-chars";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "report-verify-privacy-secret-at-least-32-chars";

// /api/v1/reports/[id]/verify sits behind PUBLIC_API_PREFIX "/api/v1/reports/", so every row it can
// reach is a row an anonymous caller can read. It had no status filter at all, while every sibling
// read in server/evidence-network/repository.ts filters `status='issued'`.
//
// That means the endpoint whose entire purpose is to confirm a record is good would serve `draft`
// and `pending` reports — findings a laboratory has not finished reviewing — plus `superseded`
// reports (replaced by a corrected version) and `revoked` ones (withdrawn, often precisely because
// they were wrong). On a product whose premise is that nothing surfaces before review, that is a
// product-integrity failure as much as an access-control one: it is the site contradicting its own
// central claim, through its own verification API.

const request = (id: string) =>
  verifyReport(new Request(`https://vialgrade.test/api/v1/reports/${encodeURIComponent(id)}/verify`), {
    params: Promise.resolve({ id }),
  });

describe("public report verification only serves issued reports", () => {
  let issued: { id: string; report_number: string; laboratory_id: string; test_order_id: string; sample_id: string };

  beforeAll(async () => {
    await resetDatabaseForTests();
    globalThis.__vialEvidenceSeedPromise = undefined;
    await ensureEvidenceNetworkSeed();
    const db = await getDatabase();
    issued = (
      await db.query<typeof issued & Record<string, unknown>>(
        `SELECT id,report_number,laboratory_id,test_order_id,sample_id FROM laboratory_reports WHERE status='issued' LIMIT 1`,
      )
    ).rows[0];
    expect(issued, "fixture seed should provide at least one issued report").toBeTruthy();

    // One extra report per non-public status, hung off the same laboratory/order/sample so the joins
    // resolve and the only thing under test is the status filter.
    for (const [suffix, status] of [["PENDING", "pending"], ["DRAFT", "draft"], ["SUPERSEDED", "superseded"], ["REVOKED", "revoked"]] as const) {
      await db.query(
        `INSERT INTO laboratory_reports(id,laboratory_id,test_order_id,sample_id,report_number,version,status,public_summary,revocation_reason,revoked_at)
         VALUES($1,$2,$3,$4,$5,9,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
        [
          `lab-report:gate-${suffix.toLowerCase()}`,
          issued.laboratory_id,
          issued.test_order_id,
          issued.sample_id,
          `GATE-${suffix}-01`,
          status,
          `Unreviewed or withdrawn findings that must not be served publicly (${status}).`,
          status === "revoked" ? "Withdrawn during this test" : null,
          status === "revoked" ? new Date().toISOString() : null,
        ],
      );
    }
  });

  afterAll(async () => {
    await resetDatabaseForTests();
    globalThis.__vialEvidenceSeedPromise = undefined;
  });

  it("still serves a genuinely issued report", async () => {
    const response = await request(issued.report_number);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.report.status).toBe("issued");
    expect(body.custody).toBeTruthy();
  });

  for (const status of ["pending", "draft", "superseded", "revoked"] as const) {
    it(`does not serve a ${status} report looked up by report number`, async () => {
      const response = await request(`GATE-${status.toUpperCase()}-01`);
      expect(response.status).toBe(404);
      expect((await response.json()).error).toBe("Report not found");
    });

    it(`does not serve a ${status} report looked up by id`, async () => {
      // The id path is the one a missing pair of parentheses would leave open:
      // `WHERE lr.id=$1 OR lr.report_number=$1 AND lr.status='issued'` binds AND tighter than OR, so
      // the filter would apply only to the report-number branch and every row stay reachable by id.
      const response = await request(`lab-report:gate-${status}`);
      expect(response.status).toBe(404);
    });
  }

  it("never leaks an unreviewed summary through any lookup form", async () => {
    for (const id of ["GATE-PENDING-01", "lab-report:gate-pending", "GATE-REVOKED-01", "lab-report:gate-revoked"]) {
      const response = await request(id);
      const text = await response.text();
      expect(text, id).not.toContain("must not be served publicly");
    }
  });
});
