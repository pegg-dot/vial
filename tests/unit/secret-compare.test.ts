import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { secretMatches } from "@/server/auth/secret-compare";

// The two internal cron routes compared CRON_SECRET with `===` while every other secret comparison
// in the codebase — session envelope HMACs, seller API tokens, partner HMAC postbacks, the mock
// webhook signature, password verification — uses timingSafeEqual.
//
// Honest severity note, recorded here rather than quietly implied: remotely measuring `===`
// short-circuit timing across the internet, against a route that then does seconds of database and
// network work, is not a practical attack. The value of the fix is consistency. The cost of the
// inconsistency is that a reader asking "how does this codebase compare secrets" gets two answers,
// and the weaker one lives on an unauthenticated, perimeter-public route — which is precisely the
// place the next person copies from.
//
// Because the fix is behaviourally identical, no black-box test can distinguish it. So this file
// tests the helper's correctness *and* asserts the routes actually route through it — a source-level
// assertion, in the same spirit as tests/unit/affiliate-disclosure.test.ts.

const routeSource = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../src/app/api/internal/cron/${relative}`, import.meta.url)), "utf8");

describe("secretMatches", () => {
  it("accepts only an exact match", () => {
    expect(secretMatches("Bearer s3cret", "Bearer s3cret")).toBe(true);
    expect(secretMatches("Bearer s3crey", "Bearer s3cret")).toBe(false);
    expect(secretMatches("bearer s3cret", "Bearer s3cret")).toBe(false);
  });

  it("rejects length mismatches without throwing", () => {
    // timingSafeEqual throws on unequal lengths; the guard has to come first.
    expect(() => secretMatches("short", "a much longer secret")).not.toThrow();
    expect(secretMatches("short", "a much longer secret")).toBe(false);
    expect(secretMatches("a much longer secret", "short")).toBe(false);
    expect(secretMatches("Bearer s3cret ", "Bearer s3cret")).toBe(false);
  });

  it("rejects absent input rather than matching an empty expectation", () => {
    expect(secretMatches(null, "Bearer s3cret")).toBe(false);
    expect(secretMatches(undefined, "Bearer s3cret")).toBe(false);
    expect(secretMatches("", "Bearer s3cret")).toBe(false);
    expect(secretMatches("", "")).toBe(false);
    expect(secretMatches("anything", "")).toBe(false);
  });

  it("handles multibyte input without a length-vs-bytes mismatch", () => {
    expect(secretMatches("Bearer ✓secret", "Bearer ✓secret")).toBe(true);
    expect(secretMatches("Bearer ✗secret", "Bearer ✓secret")).toBe(false);
  });
});

describe("cron routes compare their secret the same way the rest of the codebase does", () => {
  for (const route of ["collect/route.ts", "refresh/route.ts"]) {
    it(`${route} routes the authorization header through secretMatches`, () => {
      const source = routeSource(route);
      expect(source).toContain("secretMatches");
      // The exact shape that was there before, and must not come back.
      expect(source).not.toMatch(/headers\.get\(\s*["']authorization["']\s*\)\s*===/);
    });
  }
});
