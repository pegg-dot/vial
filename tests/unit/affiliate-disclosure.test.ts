import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AFFILIATE_RULES } from "@/server/outbound/affiliate";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("evidence-only commerce hold", () => {
  it("has no live affiliate deals", () => {
    expect(Object.keys(AFFILIATE_RULES)).toHaveLength(0);
  });
  it("does not link to vendor checkout in listing actions", () => {
    const source = readSource("../../src/components/product-actions.tsx");
    expect(source).not.toContain("/go?l=");
    expect(source).not.toMatch(/<a[^>]+href=/);
  });
  it("keeps the legacy redirect route closed", () => {
    const source = readSource("../../src/app/go/route.ts");
    expect(source).toContain("status: 410");
    expect(source).not.toContain("NextResponse.redirect");
  });
  it("blocks public transaction and conversion endpoints at the proxy", () => {
    const source = readSource("../../src/proxy.ts");
    expect(source).toContain("isPausedTransactionEndpoint(path)");
    const pause = readSource("../../src/lib/commerce-pause.ts");
    expect(pause).toContain('"/api/v1/commerce/checkout"');
    expect(pause).toContain('"/go"');
    expect(source).not.toContain('path.startsWith("/api/v1/commerce/")');
    expect(source).toContain("status:410");
  });
});
