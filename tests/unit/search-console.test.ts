import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildServiceAccountAssertion, isSearchConsoleConfigured, summarizeSearchAnalytics } from "@/server/seo/search-console";

describe("service-account assertion", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("produces a JWT Google will accept: RS256-signed, right scope, right audience, 1h expiry", () => {
    const now = 1_760_000_000;
    const jwt = buildServiceAccountAssertion("svc@proj.iam.gserviceaccount.com", pem, now);
    const [h, c, sig] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims.iss).toBe("svc@proj.iam.gserviceaccount.com");
    expect(claims.scope).toBe("https://www.googleapis.com/auth/webmasters.readonly");
    expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
    expect(claims.exp - claims.iat).toBe(3600);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${c}`);
    expect(verifier.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });

  it("repairs the literal-\\n private keys that env vars arrive with", () => {
    const mangled = pem.replace(/\n/g, "\\n");
    const jwt = buildServiceAccountAssertion("svc@proj.iam.gserviceaccount.com", mangled, 1_760_000_000);
    const [h, c, sig] = jwt.split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${c}`);
    expect(verifier.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });
});

describe("summarizeSearchAnalytics", () => {
  it("reads totals from the dimensionless row and names the top queries", () => {
    const s = summarizeSearchAnalytics(
      [{ clicks: 42, impressions: 1900, ctr: 0.0221, position: 18.4 }],
      [
        { keys: ["bpc-157 price"], clicks: 12, impressions: 300, position: 6.1 },
        { keys: ["vialgrade"], clicks: 9, impressions: 40, position: 1.2 },
        { keys: [], clicks: 1, impressions: 5, position: 50 },
      ],
      "sc-domain:vialgrade.com",
    );
    expect(s.clicks).toBe(42);
    expect(s.impressions).toBe(1900);
    expect(s.topQueries).toHaveLength(2); // the keyless row is dropped, never rendered as ""
    expect(s.topQueries[0].query).toBe("bpc-157 price");
    expect(s.site).toBe("sc-domain:vialgrade.com");
  });

  it("an empty account reads as zeros, not NaN", () => {
    const s = summarizeSearchAnalytics([], [], "https://vialgrade.com/");
    expect(s.clicks).toBe(0);
    expect(s.impressions).toBe(0);
    expect(Number.isNaN(s.position)).toBe(false);
    expect(s.topQueries).toEqual([]);
  });
});

describe("configuration detection", () => {
  // The environment is CONTROLLED here, never assumed: the first Vercel build after the owner
  // added the real credentials carried them into the build's test run, this test (which assumed
  // a bare env) went red, and the deploy gate refused the deployment — the fix itself blocked
  // the owner from shipping the fix's own configuration.
  const KEYS = ["VIALGRADE_GSC_CLIENT_EMAIL", "VIALGRADE_GSC_PRIVATE_KEY"] as const;

  function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>, fn: () => void) {
    const saved = KEYS.map((k) => [k, process.env[k]] as const);
    try {
      for (const k of KEYS) delete process.env[k];
      for (const [k, v] of Object.entries(values)) process.env[k] = v;
      fn();
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  it("is off without both env vars, regardless of what the outer environment carries", () => {
    withEnv({}, () => expect(isSearchConsoleConfigured()).toBe(false));
    withEnv({ VIALGRADE_GSC_CLIENT_EMAIL: "svc@x.iam.gserviceaccount.com" }, () => expect(isSearchConsoleConfigured()).toBe(false));
    withEnv({ VIALGRADE_GSC_PRIVATE_KEY: "key" }, () => expect(isSearchConsoleConfigured()).toBe(false));
  });

  it("is on with both env vars present", () => {
    withEnv({ VIALGRADE_GSC_CLIENT_EMAIL: "svc@x.iam.gserviceaccount.com", VIALGRADE_GSC_PRIVATE_KEY: "key" }, () => {
      expect(isSearchConsoleConfigured()).toBe(true);
    });
  });
});
