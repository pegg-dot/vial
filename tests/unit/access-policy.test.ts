import { describe, expect, it } from "vitest";
import { accessDecision } from "@/server/auth/access-policy";
import type { SessionEnvelope } from "@/server/auth/session-envelope";

const now = Date.now();
function session(accountType: SessionEnvelope["accountType"]): SessionEnvelope {
  return { version: 1, sessionId: "session-x", userId: "user-x", accountType, roles: [] as never[], issuedAt: now, expiresAt: now + 60_000 };
}

describe("deny-by-default access policy", () => {
  it("protects an unknown page route for anonymous visitors", () => {
    // The 0.7 bug class: a sensitive route nobody remembered to allowlist must NOT be public.
    const d = accessDecision("/internal-export", null);
    expect(d.protected).toBe(true);
    expect(d.allowed).toBe(false);
  });

  it("lets any authenticated user past the perimeter for an unknown route (per-page guard enforces specifics)", () => {
    const d = accessDecision("/internal-export", session("customer"));
    expect(d.protected).toBe(true);
    expect(d.allowed).toBe(true);
  });

  it("protects an unknown API route for anonymous callers", () => {
    const d = accessDecision("/api/v1/secret-new", null);
    expect(d.protected).toBe(true);
    expect(d.allowed).toBe(false);
  });

  it("keeps public catalog routes open to anonymous visitors", () => {
    for (const path of ["/", "/market", "/products/bpc-157", "/compounds", "/vendors/helix", "/stacks", "/stacks/wolverine", "/passports", "/labs", "/testing", "/methodology", "/grades", "/reference-standard", "/developers", "/legal/privacy", "/search"]) {
      const d = accessDecision(path, null);
      expect(d.allowed, `${path} should be public`).toBe(true);
    }
  });

  it("keeps well-known + PWA paths open (crawlers, service worker, manifest, offline shell)", () => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/sw.js", "/offline"]) {
      expect(accessDecision(path, null).allowed, `${path} should be public`).toBe(true);
    }
  });

  it("keeps public API routes open to anonymous callers", () => {
    for (const path of ["/api/v1/health", "/api/v1/catalog", "/api/v1/alerts", "/api/openapi.json", "/api/v1/auth/login", "/api/public/v1/catalog", "/api/public/v1/export", "/api/public/v1/id/vialgrade:compound:bpc-157", "/api/public/v1/reputation/vialgrade:vendor:x"]) {
      const d = accessDecision(path, null);
      expect(d.allowed, `${path} should be public`).toBe(true);
    }
  });

  it("still enforces account-family ownership", () => {
    expect(accessDecision("/admin/users", session("customer")).allowed).toBe(false);
    expect(accessDecision("/admin/users", session("staff")).allowed).toBe(true);
    expect(accessDecision("/for-you", session("seller")).allowed).toBe(false);
    expect(accessDecision("/for-you", session("customer")).allowed).toBe(true);
  });

  // The /seller and /lab role gates in accessDecision were unreachable dead code: both prefixes were
  // listed in RETIRED_PREFIX, isPublic() is consulted first, so every one of these paths returned
  // { protected: false, allowed: true } before the role checks below were ever evaluated.
  //
  // Not exploitable while the routes are absent — but that is what makes it a trap rather than a bug.
  // It is armed, silent, and disarms itself only in the direction of "less safe": the day someone
  // restores a src/app/seller/** page it is served to anonymous visitors, with a role check sitting
  // in this very file looking exactly like it is doing the work. Gates whose correctness depends on
  // a route staying deleted are not gates. These tests hold whether or not the routes exist.
  describe("role gates for retired-but-gated prefixes are reachable", () => {
    for (const path of ["/seller", "/seller/catalog", "/seller/developer/tokens"]) {
      it(`${path} is seller-gated, not public`, () => {
        expect(accessDecision(path, null).protected, "anonymous must not pass").toBe(true);
        expect(accessDecision(path, null).allowed).toBe(false);
        expect(accessDecision(path, session("customer")).allowed, "a customer is not a seller").toBe(false);
        expect(accessDecision(path, session("laboratory")).allowed).toBe(false);
        expect(accessDecision(path, session("seller")).allowed).toBe(true);
        expect(accessDecision(path, session("staff")).allowed).toBe(true);
      });
    }

    for (const path of ["/lab", "/lab/reports", "/lab/developer/tokens"]) {
      it(`${path} is laboratory-gated, not public`, () => {
        expect(accessDecision(path, null).protected, "anonymous must not pass").toBe(true);
        expect(accessDecision(path, null).allowed).toBe(false);
        expect(accessDecision(path, session("customer")).allowed).toBe(false);
        expect(accessDecision(path, session("seller")).allowed).toBe(false);
        expect(accessDecision(path, session("laboratory")).allowed).toBe(true);
        expect(accessDecision(path, session("staff")).allowed).toBe(true);
      });
    }

    it("keeps /labs public — it is a real public directory, not the retired /lab", () => {
      // The prefix collision this whole area is about. /labs must not get swept up by the fix.
      expect(accessDecision("/labs", null).allowed).toBe(true);
      expect(accessDecision("/labs/aperture-analytical", null).allowed).toBe(true);
    });

    it("keeps genuinely retired, ungated prefixes returning a clean 404 instead of a login redirect", () => {
      // These have no role gate below them, so letting them through the perimeter costs nothing and
      // avoids telling a visitor that something still exists behind a login wall.
      for (const path of ["/terminal", "/terminal/anything", "/operations", "/updates", "/developers", "/sell"]) {
        expect(accessDecision(path, null).allowed, `${path} should still be perimeter-public`).toBe(true);
      }
    });
  });
});
