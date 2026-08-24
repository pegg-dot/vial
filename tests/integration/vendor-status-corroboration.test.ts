import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordVendorStatus, getVendorStatus } from "@/server/verify/vendor-status";

// The corroboration counter had no test driving the WRITER. tests/unit/verify.test.ts hand-feeds
// consecutiveFailures straight into composeVerdict, which proves the gate reads it and proves
// nothing about whether anything ever sets it correctly.
//
// It did not. The INSERT omitted consecutive_failures from its column list, so a brand-new row took
// the schema default of 0 on a probe that had just FAILED. Only ON CONFLICT incremented. The
// `deadRuns >= 2` gate therefore needed THREE failures, while the sentence it publishes reads "a
// storefront still gone after 2 checks" — off by one, and misstating its own evidence.

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  await resetDatabaseForTests();
});

const probe = (status: string) => ({ status: status as never, httpCode: null, redirectHost: null, detail: "" });

describe("counting consecutive failed probes", () => {
  it("counts the very first failure as one, not zero", async () => {
    const db = await getDatabase();
    await recordVendorStatus(db, "gone-shop", probe("offline"));
    expect((await getVendorStatus(db, "gone-shop"))?.consecutiveFailures).toBe(1);
  });

  // The number the verdict gate reads, and the number its sentence prints, must be the same thing.
  it("reaches the two-check threshold on the second failure", async () => {
    const db = await getDatabase();
    await recordVendorStatus(db, "gone-shop", probe("offline"));
    await recordVendorStatus(db, "gone-shop", probe("offline"));
    expect((await getVendorStatus(db, "gone-shop"))?.consecutiveFailures).toBe(2);
  });

  it("resets the moment a storefront answers again", async () => {
    const db = await getDatabase();
    await recordVendorStatus(db, "flaky-shop", probe("offline"));
    await recordVendorStatus(db, "flaky-shop", probe("offline"));
    await recordVendorStatus(db, "flaky-shop", probe("operating"));
    expect((await getVendorStatus(db, "flaky-shop"))?.consecutiveFailures).toBe(0);
  });

  // Bot protection is not absence. Letting it accumulate is what once sank live vendors as defunct.
  it("never accumulates on a storefront that merely blocks bots", async () => {
    const db = await getDatabase();
    await recordVendorStatus(db, "walled-shop", probe("blocked"));
    await recordVendorStatus(db, "walled-shop", probe("blocked"));
    expect((await getVendorStatus(db, "walled-shop"))?.consecutiveFailures).toBe(0);
  });

  it("starts an operating storefront at zero", async () => {
    const db = await getDatabase();
    await recordVendorStatus(db, "live-shop", probe("operating"));
    expect((await getVendorStatus(db, "live-shop"))?.consecutiveFailures).toBe(0);
  });
});
