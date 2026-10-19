import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/intelligence/research-ai-agent", () => ({
  runResearchAiAgent: vi.fn(async () => ({
    kind: "model-proposed-not-expert-reviewed",
    subject: "pexiganan",
    topicId: "publication-matching",
    audience: "researcher",
    model: "mock-test",
    sourceSnapshot: "2026-10-19",
    scope: "limited",
    modelSummary: "Model-proposed summary, not a verified source conclusion.",
    findings: [],
    potentialConflicts: [],
    gaps: [],
    nextSources: [],
    evidenceToolCalls: 1,
    boundaries: ["Provisional"],
  })),
}));

import { createHmac } from "node:crypto";
import { POST } from "@/app/api/research/analyst/route";
import { issueResearchAiPilotToken } from "@/server/intelligence/research-ai-config";
import { runResearchAiAgent } from "@/server/intelligence/research-ai-agent";
import { accessDecision } from "@/server/auth/access-policy";
import { publicReleaseAction } from "@/lib/public-research-release";

const origin = "http://127.0.0.1:39571";
const payload = {
  topicId: "publication-matching",
  audience: "researcher",
  question: "Which trial does the derived paper report?",
  consent: true,
};
const makeRequest = (body: string, headers: Record<string, string> = {}) =>
  new Request(origin + "/api/research/analyst", {
    method: "POST",
    headers: {
      origin, "content-type": "application/json",
      "x-vialgrade-research-ai-token": issueResearchAiPilotToken() ?? "",
      ...headers,
    },
    body,
  });

beforeEach(() => {
  vi.stubEnv("VIALGRADE_LOCAL_PREVIEW", "true");
  vi.stubEnv("VIALGRADE_PUBLIC_EVIDENCE_ONLY", "true");
  vi.stubEnv("VIALGRADE_RESEARCH_AI_ENABLED", "true");
  vi.stubEnv("AI_GATEWAY_API_KEY", "example-mock-key-never-valid");
  vi.mocked(runResearchAiAgent).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("anonymous localhost model route perimeter", () => {
  it("is not available on any non-local release and does not accept blanket API prefixes", () => {
    expect(accessDecision("/api/research/analyst", null).allowed).toBe(true);
    expect(accessDecision("/api/research/other", null).allowed).toBe(false);
    expect(publicReleaseAction("/api/research/analyst", "POST", true)).toBeNull();
    expect(publicReleaseAction("/api/research/analyst", "GET", true)).toBe("gone");
    expect(publicReleaseAction("/api/research/other", "POST", true)).toBe("gone");
    vi.stubEnv("VIALGRADE_LOCAL_PREVIEW", "false");
    expect(accessDecision("/api/research/analyst", null).allowed).toBe(false);
    expect(publicReleaseAction("/api/research/analyst", "POST", true)).toBe("gone");
  });

  it("refuses credentials/opt-in absence BEFORE parsing a question or using the model", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const res = await POST(makeRequest(JSON.stringify(payload)));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("model_not_connected");
    expect(runResearchAiAgent).not.toHaveBeenCalled();
  });

  it("does not accept cross-origin or origin-less requests", async () => {
    expect((await POST(makeRequest(JSON.stringify(payload), { origin: "https://hostile.example" }))).status).toBe(403);
    expect((await POST(makeRequest(JSON.stringify(payload), { origin: "" }))).status).toBe(403);
    expect(runResearchAiAgent).not.toHaveBeenCalled();
  });

  it("rejects missing, tampered, expired or future authorization tokens before model execution", async () => {
    const valid = issueResearchAiPilotToken();
    expect(valid).toMatch(/^\d{10}\.[0-9a-f]{24}\.[0-9a-f]{64}$/);
    const body = JSON.stringify(payload);
    const missing = await POST(makeRequest(body, { "x-vialgrade-research-ai-token": "" }));
    expect(missing.status).toBe(401);
    expect((await missing.json()).code).toBe("local_token_required");
    const tampered = await POST(makeRequest(body, { "x-vialgrade-research-ai-token": valid!.slice(0, -1) + (valid!.endsWith("0") ? "1" : "0") }));
    expect(tampered.status).toBe(401);
    const [ts, nonce] = valid!.split(".");
    const expired = Number(ts) - 1805;
    const future = Number(ts) + 200;
    const sign = (stamp: number) => {
      const prefix = String(stamp) + "." + nonce;
      const sig = createHmac("sha256", "example-mock-key-never-valid")
        .update("vialgrade-ai-local-v1:" + prefix).digest("hex");
      return prefix + "." + sig;
    };
    expect((await POST(makeRequest(body, { "x-vialgrade-research-ai-token": sign(expired) }))).status).toBe(401);
    expect((await POST(makeRequest(body, { "x-vialgrade-research-ai-token": sign(future) }))).status).toBe(401);
    expect(runResearchAiAgent).not.toHaveBeenCalled();
  });

  it("accepts a legitimate 127.0.0.1 Origin when Next normalizes the internal request URL to localhost", async () => {
    const requestWithNormalizedUrl = new Request("http://localhost:39571/api/research/analyst", {
      method: "POST",
      headers: {
        host: "127.0.0.1:39571",
        origin: "http://127.0.0.1:39571",
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
        "x-vialgrade-research-ai-token": issueResearchAiPilotToken()!,
      },
      body: JSON.stringify(payload),
    });
    const reply = await POST(requestWithNormalizedUrl);
    expect(reply.status).toBe(200);
    expect(runResearchAiAgent).toHaveBeenCalledTimes(1);

    vi.mocked(runResearchAiAgent).mockClear();
    const maliciousOrigin = new Request("http://localhost:39571/api/research/analyst", {
      method: "POST",
      headers: {
        host: "127.0.0.1:39571",
        origin: "https://evil.example",
        "content-type": "application/json",
        "x-vialgrade-research-ai-token": issueResearchAiPilotToken()!,
      },
      body: JSON.stringify(payload),
    });
    expect((await POST(maliciousOrigin)).status).toBe(403);
    expect(runResearchAiAgent).not.toHaveBeenCalled();
  });

  it("requires JSON and explicit informed consent", async () => {
    expect((await POST(makeRequest("anything", { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(makeRequest("{invalid}"))).status).toBe(400);
    expect((await POST(makeRequest(JSON.stringify({ ...payload, consent: false })))).status).toBe(400);
    expect((await POST(makeRequest(JSON.stringify({ ...payload, extra: "surprise" })))).status).toBe(400);
    expect(runResearchAiAgent).not.toHaveBeenCalled();
  });

  it("rejects unrelated molecules, lab design, large bodies and purchases", async () => {
    for (const question of ["Where can I buy Pexiganan vials?", "Design a new peptide", "What is the latest semaglutide trial?"]) {
      const res = await POST(makeRequest(JSON.stringify({ ...payload, question })));
      expect(res.status, question).toBe(422);
    }
    const large = await POST(makeRequest(JSON.stringify({ ...payload, question: "a".repeat(5000) })));
    expect(large.status).toBe(413);
    expect(runResearchAiAgent).not.toHaveBeenCalled();
  });

  it("returns bounded, no-store structured results for an explicitly consented request", async () => {
    const res = await POST(makeRequest(JSON.stringify(payload)));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect((await res.json()).kind).toBe("model-proposed-not-expert-reviewed");
    expect(runResearchAiAgent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runResearchAiAgent).mock.calls[0][0]).toEqual(payload);
  });

  it("never reveals raw provider errors to the client", async () => {
    vi.mocked(runResearchAiAgent).mockRejectedValueOnce(new Error("secret-key should not appear in a client error"));
    const res = await POST(makeRequest(JSON.stringify(payload)));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("secret-key");
  });
});
