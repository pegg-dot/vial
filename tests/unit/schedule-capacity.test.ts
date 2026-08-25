import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import knownVendors from "@/server/verify/known-vendors.json";
import { ticksPerDay, dailyDemand, dailyCapacity, headroom, TICK_MAX_TARGETS, REFRESH_DEFAULT_INTERVAL_MINUTES, REFRESH_SCHEMA_INTERVAL_MINUTES } from "@/server/collect/schedule-capacity";

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

  // Positive control. The check is worth nothing unless the schedule it was written against fails
  // it — the daily cron really was the production configuration, and this is what it scores.
  it("rejects the once-a-day schedule this replaced", () => {
    const c = counts();
    expect(dailyCapacity("30 4 * * *")).toBeLessThan(dailyDemand(c));
    expect(headroom("30 4 * * *", c)).toBeLessThan(0.2);
  });

  it("counts ticks from a cron expression, and refuses shapes it cannot read", () => {
    expect(ticksPerDay("0 * * * *")).toBe(24);
    expect(ticksPerDay("30 4 * * *")).toBe(1);
    expect(ticksPerDay("*/15 * * * *")).toBe(96);
    expect(ticksPerDay("0 4,16 * * *")).toBe(2);
    expect(() => ticksPerDay("0 4 * * 1")).toThrow(/unsupported/);
    expect(() => ticksPerDay("0 4 * *")).toThrow(/5 fields/);
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
