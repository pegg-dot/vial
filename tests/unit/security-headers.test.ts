import { afterEach, describe, expect, it, vi } from "vitest";

// The response headers next.config.ts attaches to every route.
//
// Two defects here. HSTS was absent: Vercel supplies one on *.vercel.app, but that is Vercel
// asserting it for Vercel's domain — a custom apex asserts nothing, so the first request of every
// session on the real domain stays downgradeable. And the CSP granted script, frame and connect
// access to Stripe origins, plus `payment=(self "https://js.stripe.com")`, on a site that takes no
// payment: /cart and /checkout are permanent redirects to /market, and the only component that
// loads js.stripe.com is reachable solely from components/checkout-client.tsx, which no route
// imports. An execution grant to a third-party origin nothing loads is attack surface with a
// plausible-looking excuse attached — the kind of allowance an audit skims past.

async function headersFor(siteUrl: string): Promise<Record<string, string>> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  const loaded = await import("../../next.config");
  const headersFn = loaded.default.headers;
  if (!headersFn) throw new Error("next.config.ts exports no headers()");
  const rules = await headersFn();
  const entry = rules[0];
  if (!entry) throw new Error("next.config.ts headers() returned no rules");
  return Object.fromEntries(entry.headers.map((header) => [header.key, header.value]));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("security headers", () => {
  it("asserts HSTS on an https canonical origin", async () => {
    const headers = await headersFor("https://vialgrade.app");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
  });

  it("omits HSTS when the canonical origin is plain http", async () => {
    // A browser ignores HSTS received over http anyway; emitting it from the local/e2e server would
    // be a header pretending to be a control.
    const headers = await headersFor("http://localhost:3000");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("grants no Stripe origin in the CSP", async () => {
    for (const site of ["https://vialgrade.app", "http://localhost:3000"]) {
      const csp = (await headersFor(site))["Content-Security-Policy"] ?? "";
      expect(csp, site).not.toContain("stripe");
      expect(csp, site).not.toContain("js.stripe.com");
      expect(csp, site).not.toContain("api.stripe.com");
      expect(csp, site).not.toContain("hooks.stripe.com");
    }
  });

  it("denies the Payment Request API outright", async () => {
    const headers = await headersFor("https://vialgrade.app");
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
    expect(headers["Permissions-Policy"]).not.toContain("stripe");
  });

  it("keeps the controls that were already there", async () => {
    // Guards against "fixing" the CSP by loosening it.
    const headers = await headersFor("https://vialgrade.app");
    const csp = headers["Content-Security-Policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });
});
