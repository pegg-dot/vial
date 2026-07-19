import { describe, expect, it } from "vitest";
import { computeSnapshotDiff } from "@/server/refresh/diff";
import { isPublicAddress, validateFetchUrl } from "@/server/refresh/safe-fetch";

describe("controlled refresh safety", () => {
  it("rejects private, loopback, link-local, documentation, and multicast addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.4.5", "192.168.1.2", "169.254.1.1", "192.0.2.2", "224.0.0.1", "::1", "fd00::1", "fe80::1", "2001:db8::1"]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("enforces scheme, credentials, hostname, port, and resolved-network controls", async () => {
    await expect(validateFetchUrl("ftp://example.com/file", ["example.com"])).rejects.toMatchObject({ code: "unsupported-protocol" });
    await expect(validateFetchUrl("https://user:pass@example.com/file", ["example.com"])).rejects.toMatchObject({ code: "credentials-forbidden" });
    await expect(validateFetchUrl("https://example.com:8443/file", ["example.com"])).rejects.toMatchObject({ code: "port-forbidden" });
    await expect(validateFetchUrl("https://example.com/file", ["other.example"])).rejects.toMatchObject({ code: "hostname-forbidden" });
    await expect(validateFetchUrl("http://127.0.0.1/", ["127.0.0.1"])).rejects.toMatchObject({ code: "private-address" });
  });

  it("creates a compact immutable snapshot diff", () => {
    const result = computeSnapshotDiff("Price: $54\nIn stock", "Price: $49\nLow stock\nBatch: NEW-1");
    expect(result.changed).toBe(true);
    expect(result.addedLines).toBe(3);
    expect(result.removedLines).toBe(2);
    expect(result.summary.addedPreview).toContain("Batch: NEW-1");
  });
});
