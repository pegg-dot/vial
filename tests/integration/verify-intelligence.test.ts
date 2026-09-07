// Caching, the demand log, certificate reachability, and reading a COA out of a PDF.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, resetDatabaseForTests, type SqlConnection } from "@/server/db/client";
import { withProbeCache, pruneProbeCache } from "@/server/verify/probe-cache";
import { recordVerifyQuery, listVerifyDemand, shouldRecord } from "@/server/verify/query-log";
import { scanCoaDocument, firstIndexedCode } from "@/server/verify/coa-document";
import { runVerification } from "@/server/verify";
import { readFileSync } from "node:fs";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "verify-intel-test-secret-at-least-32-characters!!";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "verify-intel-test-privacy-secret-at-least-32-chr";

const REAL_URL = "https://verify.janoshik.com/tests/112184-Retatrutide_10mg_9D1HBMNJ411S";
const REAL_KEY = "9D1HBMNJ411S";

let db: SqlConnection;

beforeAll(async () => {
  await resetDatabaseForTests();
  db = await getDatabase();
  await db.query(
    `INSERT INTO lab_test_records (id, lab, verify_url, verify_key, sample_name, manufacturer, purity_pct, tested_at, is_independent, origin)
     VALUES ('ltr-1','Janoshik',$1,$2,'Retatrutide 10mg','Alpha BioPharma',99.1,'2026-04-24',TRUE,'live')
     ON CONFLICT (verify_url) DO NOTHING`,
    [REAL_URL, REAL_KEY],
  );
});
afterAll(async () => { await resetDatabaseForTests(); });

describe("probe cache", () => {
  beforeEach(async () => { await db.query(`DELETE FROM verify_probe_cache`); });

  it("runs the probe once, then serves the stored fact", async () => {
    const probe = vi.fn(async () => ({ value: { registeredAt: "2020-01-01" }, ok: true }));
    const ttl = { okSeconds: 3600, failSeconds: 60 };
    const a = await withProbeCache("domain-age", "example.com", ttl, probe);
    const b = await withProbeCache("domain-age", "example.com", ttl, probe);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it("keys on the question, so a different domain is a different probe", async () => {
    const probe = vi.fn(async () => ({ value: 1, ok: true }));
    const ttl = { okSeconds: 3600, failSeconds: 60 };
    await withProbeCache("domain-age", "a.com", ttl, probe);
    await withProbeCache("domain-age", "b.com", ttl, probe);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  // The asymmetry that stops a cache becoming a memory of an outage.
  it("keeps a failure only briefly, and a real answer for a long time", async () => {
    await withProbeCache("domain-age", "down.com", { okSeconds: 86_400, failSeconds: 1 }, async () => ({ value: null, ok: false }));
    await withProbeCache("domain-age", "up.com", { okSeconds: 86_400, failSeconds: 1 }, async () => ({ value: "x", ok: true }));
    const rows = await db.query<{ probe_key: string; secs: string }>(
      `SELECT probe_key, EXTRACT(EPOCH FROM (expires_at - NOW())) secs FROM verify_probe_cache ORDER BY probe_key`,
    );
    const secs = Object.fromEntries(rows.rows.map((r) => [r.probe_key, Number(r.secs)]));
    expect(secs["down.com"]).toBeLessThan(60);
    expect(secs["up.com"]).toBeGreaterThan(3600);
  });

  it("re-runs the probe once the entry has expired", async () => {
    const probe = vi.fn(async () => ({ value: 7, ok: true }));
    await withProbeCache("domain-age", "stale.com", { okSeconds: 3600, failSeconds: 60 }, probe);
    await db.query(`UPDATE verify_probe_cache SET expires_at = NOW() - INTERVAL '1 hour'`);
    await withProbeCache("domain-age", "stale.com", { okSeconds: 3600, failSeconds: 60 }, probe);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("prunes expired rows and leaves live ones", async () => {
    await withProbeCache("domain-age", "old.com", { okSeconds: 3600, failSeconds: 60 }, async () => ({ value: 1, ok: true }));
    await withProbeCache("domain-age", "new.com", { okSeconds: 3600, failSeconds: 60 }, async () => ({ value: 1, ok: true }));
    await db.query(`UPDATE verify_probe_cache SET expires_at = NOW() - INTERVAL '1 day' WHERE probe_key = 'old.com'`);
    await pruneProbeCache();
    const left = await db.query<{ probe_key: string }>(`SELECT probe_key FROM verify_probe_cache`);
    expect(left.rows.map((r) => r.probe_key)).toEqual(["new.com"]);
  });
});

describe("the demand log", () => {
  beforeEach(async () => { await db.query(`DELETE FROM verify_queries`); });

  it("counts repeats on one row rather than keeping a row per call", async () => {
    for (let i = 0; i < 3; i += 1) await recordVerifyQuery({ kind: "unknown-domain", query: "sketchy.com", verdict: "unproven" });
    const rows = await listVerifyDemand();
    expect(rows).toHaveLength(1);
    expect(rows[0].checks).toBe(3);
  });

  it("is case-insensitive, so one domain is one row", async () => {
    await recordVerifyQuery({ kind: "unknown-domain", query: "Sketchy.com", verdict: "unproven" });
    await recordVerifyQuery({ kind: "unknown-domain", query: "sketchy.com", verdict: "unproven" });
    expect((await listVerifyDemand())[0].checks).toBe(2);
  });

  it("never keeps a query that matched nothing — that is where a mistyped personal detail lands", () => {
    expect(shouldRecord({ kind: "nothing", query: "my card number is..." })).toBe(false);
    expect(shouldRecord({ kind: "unknown-domain", query: "sketchy.com" })).toBe(true);
  });

  it("stores no request context at all", async () => {
    await recordVerifyQuery({ kind: "unknown-domain", query: "sketchy.com", verdict: "unproven" });
    const cols = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'verify_queries'`,
    );
    const names = cols.rows.map((r) => r.column_name);
    for (const forbidden of ["ip", "ip_hash", "user_agent", "user_agent_hash", "session_id", "user_id"]) {
      expect(names, `verify_queries must not carry ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("ranks most-checked first, which is the point of the table", async () => {
    await recordVerifyQuery({ kind: "unknown-domain", query: "rare.com", verdict: "unproven" });
    for (let i = 0; i < 5; i += 1) await recordVerifyQuery({ kind: "unknown-domain", query: "common.com", verdict: "unproven" });
    expect((await listVerifyDemand())[0].display).toBe("common.com");
  });

  it("records a real verdict as a side effect of running one", async () => {
    await runVerification("bluumpeptides.com");
    const rows = await listVerifyDemand();
    expect(rows.some((r) => r.display === "Bluum Peptides" || r.kind === "vendor")).toBe(true);
  });
});

describe("reading a certificate PDF", () => {
  // A real generated PDF, committed rather than produced at test time: the point of this test is
  // that we can read a text layer out of a document we did not create, and a fixture built by the
  // same code under test would prove nothing.
  const pdf = () => new Uint8Array(readFileSync(new URL("../fixtures/janoshik-coa.pdf", import.meta.url)));

  it("finds the verify URL in the text layer", async () => {
    const scan = await scanCoaDocument(pdf());
    expect(scan.hasText).toBe(true);
    expect(scan.url).toBe(REAL_URL);
  });

  it("reports honestly when there is no text to read, rather than guessing", async () => {
    // A PDF header with no content stream — the shape a scanned photo has.
    const empty = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"));
    await expect(scanCoaDocument(empty).then((s) => s.hasText).catch(() => false)).resolves.toBe(false);
  });

  // A COA is full of key-shaped tokens. The index decides which one is a key, never the parser.
  it("lets the index pick the real key out of look-alike tokens", async () => {
    expect(await firstIndexedCode(["BATCH0001X", "LOTNUMBER12", REAL_KEY])).toBe(REAL_KEY);
    expect(await firstIndexedCode(["BATCH0001X", "LOTNUMBER12"])).toBeNull();
    expect(await firstIndexedCode([])).toBeNull();
  });
});

describe("a certificate we cannot reach is never called fabricated", () => {
  // Janoshik's edge answers 403 to server-side clients — a REAL certificate URL and an invented one
  // are indistinguishable to us. The old code read `!res.ok` as proof of forgery and published
  // "it is fabricated — do not trust it" about genuine documents.
  it("says we could not check, not that the document is fake", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("blocked", { status: 403 })));
    try {
      const r = await runVerification("https://verify.janoshik.com/tests/999999-Unknown_ZZZZZZZZZZZZ");
      expect(r.verdict).not.toBe("high-risk");
      expect(r.headline).toMatch(/couldn't check/i);
      // The accusation is machine-readable: a signal with ok:false renders as a red cross against
      // the document. Not one of them may be false when all we know is that we were turned away.
      // (The copy still tells the reader that a certificate which does not load IS fabricated —
      // that is the test to apply, not a claim about this one.)
      expect(r.signals.every((sig) => sig.ok !== false)).toBe(true);
      expect(r.summary).toMatch(/refuses automated checks/i);
      expect(r.link?.href).toContain("verify.janoshik.com");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("still condemns a page we DID read that holds no certificate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>no such test</html>", { status: 200 })));
    try {
      const r = await runVerification("https://verify.janoshik.com/tests/888888-Fake_YYYYYYYYYYYY");
      expect(r.verdict).toBe("high-risk");
      expect(r.summary).toMatch(/fabricated/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("finds an indexed certificate by the tail of its stored URL, not just the extracted column", async () => {
    await db.query(`UPDATE lab_test_records SET verify_key = 'DIFFERENT123' WHERE id = 'ltr-1'`);
    try {
      const r = await runVerification(REAL_KEY);
      expect(r.kind).toBe("coa");
      expect(r.verdict).toBe("trusted");
    } finally {
      await db.query(`UPDATE lab_test_records SET verify_key = $1 WHERE id = 'ltr-1'`, [REAL_KEY]);
    }
  });
});
