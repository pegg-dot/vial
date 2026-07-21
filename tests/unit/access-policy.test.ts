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
    for (const path of ["/", "/market", "/products/bpc-157", "/compounds", "/vendors/helix", "/passports", "/labs", "/testing", "/methodology", "/developers", "/legal/privacy", "/search"]) {
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
    for (const path of ["/api/v1/health", "/api/v1/catalog", "/api/v1/alerts", "/api/openapi.json", "/api/v1/auth/login", "/api/public/v1/catalog", "/api/public/v1/export", "/api/public/v1/id/vial:compound:bpc-157", "/api/public/v1/reputation/vial:vendor:x"]) {
      const d = accessDecision(path, null);
      expect(d.allowed, `${path} should be public`).toBe(true);
    }
  });

  it("still enforces account-family ownership", () => {
    expect(accessDecision("/admin/users", session("customer")).allowed).toBe(false);
    expect(accessDecision("/admin/users", session("staff")).allowed).toBe(true);
    expect(accessDecision("/checkout", session("seller")).allowed).toBe(false);
    expect(accessDecision("/checkout", session("customer")).allowed).toBe(true);
  });
});
