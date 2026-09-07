import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import knownVendors from "@/server/verify/known-vendors.json";
import { CADENCE_MINUTES, TARGET_DEADLINE_MS } from "@/server/collect/scheduler";
import { ticksPerDay, dailyDemand, dailyCapacity, headroom, TICK_MAX_TARGETS, REFRESH_DEFAULT_INTERVAL_MINUTES, REFRESH_SCHEMA_INTERVAL_MINUTES, perUnitBudgetMs, TICK_BUDGET_MS, TICK_CONCURRENCY } from "@/server/collect/schedule-capacity";

// CADENCE_MINUTES declares that a headless catalogue is re-read every six hours. Until 2026-08-24
// the cron firing the collection tick ran ONCE A DAY and claimed eight targets, against 99 targets
// of demand — so the real cycle was twelve days, not six hours. Every run was green. The freshness
// was a twelfth of what the code said, and nothing anywhere would have said so.
//
// This reads the actual cron out of vercel.json rather than restating it, so the check moves when
// the schedule moves.

interface Vendor { slug?: string; domain?: string; redFlag?: boolean; productsJsonWorks?: boolean; wooWorks?: boolean; rscWorks?: boolean }

function counts() {
  const raw = knownVendors as unknown;
  const list = (Array.isArray(raw) ? raw : ((raw as { vendors?: unknown[] }).vendors ?? [])) as Vendor[];
  const legit = list.filter((v) => v?.slug && v?.domain && !v.redFlag);
  return {
    collected: legit.length,
    withCatalog: legit.filter((v) => v.productsJsonWorks || v.wooWorks || v.rscWorks).length,
  };
}

function collectCron(): string {
  const cfg = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
  const cron = cfg.crons.find((c) => c.path.endsWith("/collect"));
  if (!cron) throw new Error("no collect cron in vercel.json");
  return cron.schedule;
}

describe("the collection schedule can serve the cadences it declares", () => {
  it("has capacity for a full day of declared demand", () => {
    const c = counts();
    expect(c.collected).toBeGreaterThan(0);
    expect(c.withCatalog).toBeGreaterThan(0);
    expect(dailyCapacity(collectCron())).toBeGreaterThanOrEqual(dailyDemand(c));
  });

  // A schedule that exactly meets demand starves the moment one target fails and backs off, or one
  // vendor is added. Requiring real headroom is the difference between "keeps up today" and "keeps
  // up". This is the assertion that goes red when the vendor list grows past what the cron serves.
  it("keeps meaningful headroom, not a hairline pass", () => {
    expect(headroom(collectCron(), counts())).toBeGreaterThan(1.5);
  });

  // Counting targets is only half the promise. On one run a day the tick has to reach the whole
  // fleet inside a single function lifetime, so the other half is whether the budget affords the
  // time at the configured concurrency. Red when the vendor list outgrows one nightly run, rather
  // than the tick quietly stopping on its budget with every run still green.
  it("affords each target enough wall-clock to actually run", () => {
    const perTarget = perUnitBudgetMs(dailyDemand(counts()) * 1.5, TICK_BUDGET_MS, TICK_CONCURRENCY);
    expect(perTarget).toBeGreaterThan(TARGET_DEADLINE_MS / 4);
  });

  // Positive controls. The checks above are worth nothing unless arrangements that genuinely
  // cannot do the job score as failures.
  //
  // The schedule is daily again as of 2026-09-07, so "daily" on its own is no longer the thing
  // that fails — the tick size is. Eight targets a run was correct at 48 runs a day and is a
  // sixth of one day's demand; that pairing is the 2026-08-24 starvation exactly.
  it("rejects the old tick size under the current daily cron", () => {
    const c = counts();
    expect(dailyCapacity(collectCron(), 8)).toBeLessThan(dailyDemand(c));
    expect(headroom(collectCron(), c, 8)).toBeLessThan(0.2);
  });

  it("rejects a tick size the budget cannot actually reach", () => {
    // One target at a time is the arrangement this replaced: at 87 target-runs of demand a
    // sequential tick affords each one about two seconds, well under a storefront round trip.
    expect(perUnitBudgetMs(dailyDemand(counts()) * 1.5, TICK_BUDGET_MS, 1)).toBeLessThan(TARGET_DEADLINE_MS / 4);
  });

  it("counts ticks from a cron expression, and refuses shapes it cannot read", () => {
    expect(ticksPerDay("0 * * * *")).toBe(24);
    expect(ticksPerDay("30 4 * * *")).toBe(1);
    expect(ticksPerDay("*/15 * * * *")).toBe(96);
    expect(ticksPerDay("0 4,16 * * *")).toBe(2);
    expect(() => ticksPerDay("0 4 * * 1")).toThrow(/unsupported/);
    expect(() => ticksPerDay("0 4 * *")).toThrow(/5 fields/);
  });

  // Every market-wide kind must be counted, or adding one silently eats headroom the arithmetic
  // still reports as free. With no vendors at all the demand is exactly the market kinds:
  // enforcement daily, news twice daily, the Janoshik feed daily, its browser capture daily.
  it("counts every market-wide collector, including both Janoshik kinds", () => {
    // All four sit at the daily floor now: no cadence may be shorter than the cron that drains it.
    expect(dailyDemand({ withCatalog: 0, collected: 0 })).toBe(1 + 1 + 1 + 1);
  });

  // The cadences are a promise the schedule has to keep. One shorter than the cron interval is not
  // a faster read, it is a target sitting due until the next run under a label that claims
  // otherwise — and dailyDemand counts straight off these numbers, so a cadence that lies here
  // makes every assertion in this file lie with it.
  it("declares no cadence shorter than the cron that drains it", () => {
    const minutesBetweenRuns = (24 * 60) / ticksPerDay(collectCron());
    for (const [kind, cadence] of Object.entries(CADENCE_MINUTES)) {
      expect(cadence, `${kind} is faster than the cron`).toBeGreaterThanOrEqual(minutesBetweenRuns);
    }
  });

  it("keeps the tick size the route uses and the one it scores identical", () => {
    const route = readFileSync(new URL("../../src/app/api/internal/cron/collect/route.ts", import.meta.url), "utf8");
    expect(route).toContain("maxTargets: TICK_MAX_TARGETS");
    expect(TICK_MAX_TARGETS).toBeGreaterThan(0);
  });
});

// The two default intervals differ on purpose: the registration default applies to sources
// registered by hand, the schema default to anything inserted without one. The difference halves
// how many policies a given sweep can serve, so anyone "tidying" them into agreement is changing
// capacity and should have to notice. (The old daily-sweep ceiling this file used to assert is
// gone — the provenance sweep moved to its own hourly cron and is covered by
// tests/unit/provenance-enrolment.test.ts.)
describe("the refresh interval defaults stay distinct on purpose", () => {
  it("keeps the schema default and the registration default different", () => {
    expect(REFRESH_SCHEMA_INTERVAL_MINUTES).not.toBe(REFRESH_DEFAULT_INTERVAL_MINUTES);
    const schema = readFileSync(new URL("../../src/server/db/schema.ts", import.meta.url), "utf8");
    expect(schema).toContain(`interval_minutes INTEGER NOT NULL DEFAULT ${REFRESH_SCHEMA_INTERVAL_MINUTES}`);
    const live = readFileSync(new URL("../../src/server/ingest/live-sources.ts", import.meta.url), "utf8");
    expect(live).toContain(`intervalMinutes ?? ${REFRESH_DEFAULT_INTERVAL_MINUTES}`);
  });
});
