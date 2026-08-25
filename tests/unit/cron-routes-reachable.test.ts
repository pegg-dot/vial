import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

// Every cron route must be in PUBLIC_API_EXACT or it is dead on arrival.
//
// The perimeter denies by default and Vercel Cron sends no session cookie, so a cron route missing
// from that list is 401'd BEFORE its handler runs. It fails silently and identically to a route
// that does not exist: the schedule fires, the request 401s, nothing happens, and no surface says
// so. It had already happened once — the comment above the list says it "silently disabled
// continuous collection" — and it happened again immediately when the provenance sweep was added,
// three lines below that warning.
//
// A comment could not prevent it twice. This can.

const crons = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
  crons?: { path: string; schedule: string }[];
};
const policy = readFileSync(new URL("../../src/server/auth/access-policy.ts", import.meta.url), "utf8");

describe("every scheduled route can actually be reached", () => {
  it("has crons to check", () => {
    expect(crons.crons?.length ?? 0).toBeGreaterThan(0);
  });

  it.each((crons.crons ?? []).map((c) => [c.path, c.schedule]))(
    "%s is allowlisted in PUBLIC_API_EXACT",
    (path) => {
      expect(policy).toContain(`"${path}"`);
    },
  );

  // A path in vercel.json that has no route file is a cron firing into nothing.
  it.each((crons.crons ?? []).map((c) => [c.path]))("%s has a route handler on disk", (path) => {
    const file = new URL(`../../src/app${path}/route.ts`, import.meta.url);
    expect(existsSync(file)).toBe(true);
  });
});
