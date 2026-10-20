import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function makeRequest(origin: string, host = "127.0.0.1:39571") {
  return new NextRequest("http://localhost:39571/api/research/analyst", {
    method: "POST",
    headers: {
      host,
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      topicId: "publication-matching", audience: "researcher",
      question: "", consent: true,
    }),
  });
}

describe("local preview origin rewrite in global perimeter", () => {
  beforeEach(() => {
    vi.stubEnv("VIALGRADE_LOCAL_PREVIEW", "true");
    vi.stubEnv("VIALGRADE_PUBLIC_EVIDENCE_ONLY", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("allows only an exact 127.0.0.1 browser Origin matching the loopback Host on this preview", () => {
    const res = proxy(makeRequest("http://127.0.0.1:39571"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("still rejects cross-origin, mismatched port, malicious Host and nonlocal fallback", () => {
    expect(proxy(makeRequest("https://evil.example")).status).toBe(403);
    expect(proxy(makeRequest("http://127.0.0.1:39572")).status).toBe(403);
    expect(proxy(makeRequest("http://127.0.0.1:39571", "attacker.example:39571")).status).toBe(403);
    vi.stubEnv("VIALGRADE_LOCAL_PREVIEW", "false");
    expect(proxy(makeRequest("http://127.0.0.1:39571")).status).toBe(403);
    vi.stubEnv("VIALGRADE_LOCAL_PREVIEW", "true");
    vi.stubEnv("VIALGRADE_PUBLIC_EVIDENCE_ONLY", "false");
    expect(proxy(makeRequest("http://127.0.0.1:39571")).status).toBe(403);
  });
});
