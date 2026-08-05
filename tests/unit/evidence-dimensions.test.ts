import { describe, expect, it } from "vitest";
import { deriveEvidenceDimensions } from "@/server/verify/evidence-dimensions";
import type { CoaCrossCheck } from "@/server/verify/coa-cross-check";

const base = (over: Partial<CoaCrossCheck>): CoaCrossCheck =>
  ({ status: "no-claim", headline: "", detail: "", signals: [], ...over } as CoaCrossCheck);

describe("deriveEvidenceDimensions — the 'What we could verify' matrix reads the REAL cross-check", () => {
  it("a verified vendor shows an ESTABLISHED identity — never 'no evidence' while the buy box says tested", () => {
    const dims = deriveEvidenceDimensions(base({ status: "verified", independentPurity: 99.9 }));
    const identity = dims.find((d) => d.label.startsWith("Identity"))!;
    const purity = dims.find((d) => d.label.startsWith("Measured purity"))!;
    expect(identity.status).toBe("established");
    expect(purity.status).toBe("established");
    expect(purity.detail).toContain("99.90%");
  });

  it("batch-verified establishes batch traceability; other statuses leave it unknown", () => {
    expect(deriveEvidenceDimensions(base({ status: "batch-verified" })).find((d) => d.label === "Batch traceability")!.status).toBe("established");
    expect(deriveEvidenceDimensions(base({ status: "verified" })).find((d) => d.label === "Batch traceability")!.status).toBe("unknown");
  });

  it("an unbacked testing claim is PARTIAL, and a cert mismatch is PARTIAL — not falsely established", () => {
    expect(deriveEvidenceDimensions(base({ status: "unbacked" })).find((d) => d.label.startsWith("Identity"))!.status).toBe("partial");
    expect(deriveEvidenceDimensions(base({ status: "mismatch" })).find((d) => d.label.startsWith("Identity"))!.status).toBe("partial");
  });

  it("a no-claim listing shows every axis honestly unknown/not-tested — never a green 'established'", () => {
    const dims = deriveEvidenceDimensions(base({ status: "no-claim" }));
    expect(dims.find((d) => d.label.startsWith("Identity"))!.status).toBe("unknown");
    expect(dims.find((d) => d.label.startsWith("Measured purity"))!.status).toBe("unknown");
    expect(dims.some((d) => d.status === "established")).toBe(false);
  });

  it("sterility and dose are ALWAYS honest gaps — a purity COA doesn't measure them", () => {
    const dims = deriveEvidenceDimensions(base({ status: "batch-verified", independentPurity: 99.9 }));
    expect(dims.find((d) => d.label.startsWith("Sterility"))!.status).toBe("not-tested");
    expect(dims.find((d) => d.label.startsWith("Dose"))!.status).toBe("unknown");
  });
});
