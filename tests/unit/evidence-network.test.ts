import { describe, expect, it } from "vitest";
import { accessDecision } from "@/server/auth/access-policy";
import { principalHasLaboratoryPermission } from "@/server/auth/laboratory-permissions";
import { decodeSessionEnvelope, encodeSessionEnvelope } from "@/server/auth/session-envelope";
import type { Principal } from "@/server/auth/types";

const now = Date.now();
const envelope = {
  version: 1 as const,
  sessionId: "session:lab:1234567890abcdef",
  userId: "user:lab:test",
  accountType: "laboratory" as const,
  roles: ["laboratory_owner" as const],
  issuedAt: now,
  expiresAt: now + 60_000,
};

describe("VIAL 6 laboratory security contracts", () => {
  // The /lab workspace was retired from the product (moved to src/retired/) and this test used to
  // assert it was ungated, so a visitor got a clean 404 instead of a login redirect telling them
  // something was still there. That trade turned out to be unaffordable: `isPublic()` runs before
  // the account-family rules in accessDecision, so listing /lab as retired made the laboratory role
  // gate below it unreachable dead code. Harmless while no route exists — and silently wrong the
  // moment one is restored, which is the worst possible time for a gate to be decorative.
  //
  // The original comment here said "if /lab is ever un-retired, this test must go back to asserting
  // it is protected". It is asserting that now, unconditionally, so the gate cannot be reintroduced
  // in a disarmed state.
  it("keeps the laboratory routes role-gated whether or not a route exists behind them", () => {
    expect(accessDecision("/lab/reports", envelope).protected).toBe(true);
    expect(accessDecision("/lab/reports", envelope).allowed).toBe(true);
    expect(accessDecision("/lab", null).protected).toBe(true);
    expect(accessDecision("/lab", null).allowed).toBe(false);
  });

  it("keeps the public evidence surfaces public, and still gates the live private ones", () => {
    expect(accessDecision("/labs", null).protected).toBe(false);
    expect(accessDecision("/passports/hx-bpc-2607", null).protected).toBe(false);
    // /admin is still a real, protected surface — retirement must not have loosened it.
    expect(accessDecision("/admin", null).protected).toBe(true);
    expect(accessDecision("/account", null).protected).toBe(true);
  });

  it("round-trips a laboratory session through the signed envelope", () => {
    process.env.VIALGRADE_SESSION_SECRET = "laboratory-session-test-secret-at-least-32";
    const encoded = encodeSessionEnvelope(envelope);
    expect(decodeSessionEnvelope(encoded, now)?.accountType).toBe("laboratory");
    expect(decodeSessionEnvelope(`${encoded}tampered`, now)).toBeNull();
  });

  it("keeps laboratory permissions role-scoped", () => {
    const owner: Principal = { id: "owner", email: "owner@test", displayName: "Owner", accountType: "laboratory", roles: ["laboratory_owner"], status: "active", sessionId: "s", expiresAt: now + 1000 };
    const analyst: Principal = { ...owner, id: "analyst", roles: ["laboratory_analyst"] };
    const accessioner: Principal = { ...owner, id: "accession", roles: ["laboratory_accessioning"] };
    expect(principalHasLaboratoryPermission(owner, "lab:reports:revoke")).toBe(true);
    expect(principalHasLaboratoryPermission(analyst, "lab:results:write")).toBe(true);
    expect(principalHasLaboratoryPermission(analyst, "lab:reports:issue")).toBe(false);
    expect(principalHasLaboratoryPermission(accessioner, "lab:samples:accession")).toBe(true);
    expect(principalHasLaboratoryPermission(accessioner, "lab:results:write")).toBe(false);
  });
});
