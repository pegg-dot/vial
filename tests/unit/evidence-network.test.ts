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
  it("protects the full laboratory route family centrally", () => {
    expect(accessDecision("/lab/reports", envelope)).toEqual({ protected: true, allowed: true, loginPath: "/login" });
    expect(accessDecision("/lab/reports", { ...envelope, accountType: "customer", roles: ["customer"] })).toEqual({ protected: true, allowed: false, loginPath: "/login" });
    expect(accessDecision("/labs", null).protected).toBe(false);
    expect(accessDecision("/passports/hx-bpc-2607", null).protected).toBe(false);
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
