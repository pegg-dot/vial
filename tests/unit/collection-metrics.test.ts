import { describe, expect, it } from "vitest";
import { isKeepingUp, describeWait, LATENESS_DEGRADED, type CollectionMetrics } from "@/server/collect/metrics";

// /status had a card for the refresh engine and none for the collectors. So when the collectors ran
// at 8% of their declared cadence — a twelve-day cycle against a six-hour promise — the page said
// "All systems operational" and was not lying by its own definition: every tick had succeeded.
//
// The measurement that matters is lateness against each target's OWN cadence. A 30-day domain-age
// lookup a day late is fine. A 6-hour catalogue a day late is four cadences behind and the
// catalogue on the site is stale.

const m = (over: Partial<CollectionMetrics> = {}): CollectionMetrics => ({
  enabled: 99, disabled: 0, overdue: 0, oldestOverdueMinutes: null, worstLateness: null, failing: 0, ...over,
});

describe("knowing whether the collection queue is keeping up", () => {
  it("is keeping up when nothing is overdue", () => {
    expect(isKeepingUp(m())).toBe(true);
  });

  // Normal for a queue that spreads work across ticks — being picked up a cadence later is the
  // design, not a fault.
  it("tolerates a target that is under one cadence late", () => {
    expect(isKeepingUp(m({ overdue: 12, worstLateness: 0.8 }))).toBe(true);
    expect(isKeepingUp(m({ overdue: 12, worstLateness: 2.4 }))).toBe(true);
  });

  // This is the state production was actually in: a 6-hour cadence served every ~12 days is about
  // 48 cadences late, and every run green throughout.
  it("reports behind when a target is several cadences late", () => {
    expect(isKeepingUp(m({ overdue: 91, worstLateness: 48 }))).toBe(false);
    expect(isKeepingUp(m({ overdue: 5, worstLateness: LATENESS_DEGRADED }))).toBe(false);
  });

  // Lateness is per-target and relative. A slow-cadence target waiting a long time in absolute
  // terms must not raise an alarm, or the page cries wolf and stops being read.
  it("does not call a slow-cadence target late for waiting a long time", () => {
    // A 30-day domain-age lookup, one day past due: a big number of minutes, 0.03 cadences.
    expect(isKeepingUp(m({ overdue: 1, oldestOverdueMinutes: 1440, worstLateness: 1440 / (30 * 24 * 60) }))).toBe(true);
  });

  it("describes a wait in units a person can judge", () => {
    expect(describeWait(45)).toBe("45m");
    expect(describeWait(240)).toBe("4h");
    expect(describeWait(60 * 24 * 12)).toBe("12d");
  });
});

// Caught on the very first render of the Collectors card, which showed "0 enabled · Every source is
// within its schedule". Technically true and completely wrong: a queue with nothing in it is
// trivially never late, so the most serious state the card can report was rendering as the calmest.
// The status page's own doctrine already names this — "0 queued during an outage is a lie with the
// confident shape of a measurement" — and the card had walked straight into it.
describe("zero collectors is the worst state, not the calmest", () => {
  it("does not call an empty queue healthy", () => {
    expect(isKeepingUp(m({ enabled: 0, overdue: 0 }))).toBe(false);
  });

  it("still reports healthy when there are collectors and none are late", () => {
    expect(isKeepingUp(m({ enabled: 1, overdue: 0 }))).toBe(true);
  });
});

// "Behind" has two causes with opposite prognoses and the card could not tell them apart: a merely
// slow queue drains on its own, a queue of failing targets never will. The refresh card was given a
// failure count for exactly this reason; the collector card was not, and a backlog that grew for
// hours during one session could not be attributed without database access.
describe("a backlog is attributable", () => {
  it("carries a failure count alongside the wait", () => {
    expect(m({ overdue: 36, failing: 12 }).failing).toBe(12);
    expect(m({ overdue: 36 }).failing).toBe(0);
  });

  it("does not confuse failing with overdue", () => {
    // A target can be failing and not yet due again, or due and never attempted. They are
    // independent, and collapsing them would make the new number as unreadable as the old one.
    const draining = m({ overdue: 36, failing: 0 });
    const stuck = m({ overdue: 36, failing: 36 });
    expect(draining.overdue).toBe(stuck.overdue);
    expect(draining.failing).not.toBe(stuck.failing);
  });
});
