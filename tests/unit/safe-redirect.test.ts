import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/server/auth/safe-redirect";

// The post-login redirect target. The previous implementation was
//
//     v.startsWith("/") && !v.startsWith("//") ? v : fallback
//
// which asks "does the string look like a path", not "does this stay on our site". The gap between
// those two questions is an open redirect: a browser normalizes `\` to `/` inside a URL, so
// `/\evil.com` satisfies the check and then resolves to `//evil.com`.
//
// The consequence is the reason this is the highest-severity item in the batch. The victim
// authenticates against the genuine VialGrade — right domain, right certificate, session cookie
// actually set — and is then delivered to an attacker's page carrying the conviction that they are
// inside the site they just signed in to. That is the exact set-up a credential-harvesting or
// payout-redirection follow-up needs.

const FALLBACK = "/account";

describe("safeRedirectPath — post-login open redirect", () => {
  it("rejects the backslash bypass that defeated the old startsWith check", () => {
    // The headline case. `/\evil.com` passes "starts with / and not //" and lands off-site.
    expect(safeRedirectPath("/\\evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("/\\/evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("/\\\\evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("\\/evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("\\\\evil.com", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeRedirectPath("//evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("///evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("https://evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("http://evil.com/account", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("//evil.com/account?ok=1", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects whitespace- and control-character-smuggled authorities", () => {
    // The URL parser strips tabs, newlines and leading whitespace before resolving, so a check that
    // runs on the raw string sees something different from what the browser will act on.
    expect(safeRedirectPath("/\t/evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("\t//evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("\n//evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("  //evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("/\r\n/evil.com", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects non-http schemes and userinfo tricks", () => {
    expect(safeRedirectPath("javascript:alert(1)", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("data:text/html,<script>alert(1)</script>", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("https://vialgrade.app@evil.com", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("//vialgrade.app@evil.com", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects empty, whitespace and non-path values rather than silently sending them to /", () => {
    expect(safeRedirectPath("", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("   ", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("account", FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("../admin", FALLBACK)).toBe(FALLBACK);
  });

  it("still allows the legitimate same-site paths the feature exists for", () => {
    expect(safeRedirectPath("/legitimate/path", FALLBACK)).toBe("/legitimate/path");
    expect(safeRedirectPath("/account/security", FALLBACK)).toBe("/account/security");
    expect(safeRedirectPath("/admin", "/admin")).toBe("/admin");
    expect(safeRedirectPath("/market?goal=recovery", FALLBACK)).toBe("/market?goal=recovery");
    expect(safeRedirectPath("/compounds/bpc-157#evidence", FALLBACK)).toBe("/compounds/bpc-157#evidence");
    expect(safeRedirectPath("/", FALLBACK)).toBe("/");
  });

  it("returns the parser's re-serialization, never the caller's raw string", () => {
    // Even when the origin check passes, nothing the caller typed reaches the Location header
    // verbatim — so a smuggled control character cannot ride along on an otherwise-valid path.
    expect(safeRedirectPath("/account\n/x", FALLBACK)).not.toContain("\n");
    expect(safeRedirectPath("/account\r\nSet-Cookie: a=b", FALLBACK)).not.toContain("\n");
  });

  it("bites: the old implementation fails these cases", () => {
    // Documents precisely what regressed, so this file cannot quietly become a tautology.
    const old = (v: string, f: string) => (v.startsWith("/") && !v.startsWith("//") ? v : f);
    expect(old("/\\evil.com", FALLBACK)).toBe("/\\evil.com"); // old: allowed off-site
    expect(safeRedirectPath("/\\evil.com", FALLBACK)).toBe(FALLBACK); // new: rejected
  });
});
