import { beforeEach, describe, expect, it } from "vitest";
import type { QueryResultRow } from "pg";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { countingDay, countingDaySql } from "@/server/analytics/counting-day";
import { visitorHash } from "@/server/outbound/attribution";

const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  await resetDatabaseForTests();
});

// The counting day is defined ONCE and consumed twice: in JavaScript by the visitor hash, and in
// SQL by every daily bucket. If those two ever disagree about where a day starts, the daily chart
// and the reader count silently describe different things. This test is the seam that prevents it.
describe("one definition of a counting day", () => {
  const instants = [
    "2026-08-20T07:59:00Z", // 03:59 EDT — still the 19th
    "2026-08-20T08:01:00Z", // 04:01 EDT — now the 20th
    "2026-08-21T00:30:00Z", // 20:30 EDT — still the 20th, though UTC has rolled over
    "2026-01-15T08:59:00Z", // 03:59 EST — still the 14th (winter offset differs)
    "2026-01-15T09:01:00Z", // 04:01 EST — now the 15th
  ];

  it("the JavaScript day and the SQL day never disagree", async () => {
    const db = await getDatabase();
    for (const iso of instants) {
      const row = (
        await db.query<QueryResultRow & { day: string }>(
          `SELECT ${countingDaySql("$1::timestamptz")} AS day`,
          [iso],
        )
      ).rows[0]!;
      expect(row.day, iso).toBe(countingDay(new Date(iso)));
    }
  });

  it("puts an evening's reading on one day instead of splitting it at 8pm", () => {
    // The same person reading either side of midnight UTC, which is 8pm Eastern.
    const before = visitorHash("70.1.2.3", BROWSER, new Date("2026-08-20T23:30:00Z"));
    const after = visitorHash("70.1.2.3", BROWSER, new Date("2026-08-21T00:30:00Z"));
    expect(after).toBe(before);
  });

  it("still starts a new day once the reader has actually slept", () => {
    const lateNight = visitorHash("70.1.2.3", BROWSER, new Date("2026-08-21T07:59:00Z")); // 03:59 EDT
    const morning = visitorHash("70.1.2.3", BROWSER, new Date("2026-08-21T08:01:00Z")); // 04:01 EDT
    expect(morning).not.toBe(lateNight);
  });

  it("handles the winter offset, not a hardcoded one", () => {
    // 4am boundary must track DST: in January it lands at 09:00 UTC, not 08:00.
    expect(countingDay(new Date("2026-01-15T08:59:00Z"))).toBe("2026-01-14");
    expect(countingDay(new Date("2026-01-15T09:01:00Z"))).toBe("2026-01-15");
  });
});
