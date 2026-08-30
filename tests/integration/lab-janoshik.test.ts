import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { CADENCE_MINUTES, runCollectionTick, syncCollectionTargets } from "@/server/collect/scheduler";
import { collectJanoshikLive, collectJanoshikCapture, entriesFromCapture, bundledCapture, MAX_NEW_PER_RUN, type JanoshikCapture } from "@/server/collect/lab-janoshik";
import { recordLabTest } from "@/server/ingest/lab-tests";

// The Janoshik loop on the queue. Two kinds with two honest states: the LIVE feed, which the
// lab's Cloudflare edge refuses to every server-side client today (403 to a Chrome UA, curl and an
// honest bot UA alike, probed 2026-08-30), and the committed CAPTURE a person took in their own
// browser. Neither may look healthy when it is not, and the capture may never claim to know what
// is listed today.

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});
afterEach(() => vi.unstubAllGlobals());

type Db = Awaited<ReturnType<typeof getDatabase>>;
const LIVE = "ct:lab-janoshik:market";
const CAPTURE = "ct:lab-janoshik-capture:market";

interface Fixture { id: string; key: string; sample: string; client: string; mfr: string; note?: string; sticky?: boolean }
const verifyUrl = (f: Fixture) => `https://verify.janoshik.com/tests/${f.id}-${f.sample.replace(/[^A-Za-z0-9]+/g, "_")}_${f.key}`;
/** The portal's real row shape: pinned rows carry class="sticky" BEFORE data-test-id, "Made By" sits inside the span. */
const portalLi = (f: Fixture) => `<li${f.sticky ? ' class="sticky"' : ""} data-test-id="${f.id}">
  <a href="${verifyUrl(f)}" class="news test-link"><header>
    <h3 style="margin-bottom:0">#${f.id} <span class="sample">${f.sample}</span><span class="float-right tiny">${f.note ?? "Assessment of a peptide vial or vials."}</span></h3>
    <h6>tested by <span class="client">${f.client}</span> <span class="manufacturer">Made By ${f.mfr}</span></h6>
  </header></a></li>`;
const portalHtml = (rows: Fixture[]) => `<!doctype html><html><body><ul class="tests">${rows.map(portalLi).join("\n")}</ul></body></html>`;
const captureOf = (rows: Fixture[], capturedAt = "2026-08-30T03:06:18.483Z"): JanoshikCapture => ({
  capturedAt, capturedFrom: "https://public.janoshik.com/", capturedBy: "owner-browser",
  columns: ["testId", "verifyUrl", "sampleName", "client", "manufacturer", "note", "sticky"],
  rows: rows.map((f) => [f.id, verifyUrl(f), f.sample, f.client, f.mfr, f.note ?? "", f.sticky ? 1 : 0]),
});
const HELD: Fixture = { id: "100491", key: "DAWP5HCLAV5W", sample: "BPC-157 10mg + TB 500 10mg", client: "Penguin Peptides", mfr: "Penguin Peptides" };
const NEW: Fixture = { id: "216148", key: "VUWT4FP4TVVG", sample: "MOTS-c 10mg", client: "Peptnex Biotech Co., Limited", mfr: "peptnex.com", note: "MOTS-c analysis" };

function stubPortal(status: number, body = "") {
  vi.stubGlobal("fetch", (async () => new Response(body, { status, headers: { "content-type": "text/html" } })) as unknown as typeof fetch);
}
const resolve = { compounds: [], vendors: [] };
async function holdAlready(db: Db) {
  await recordLabTest(db, { testId: HELD.id, verifyUrl: verifyUrl(HELD), verifyKey: HELD.key, sampleName: HELD.sample, manufacturer: HELD.mfr }, resolve);
}
const stored = async (db: Db) =>
  (await db.query<{ test_id: string; janoshik_listed: boolean | null; janoshik_checked_at: string | null; vendor_slug: string | null }>(
    `SELECT test_id, janoshik_listed, janoshik_checked_at, vendor_slug FROM lab_test_records WHERE lab = 'Janoshik Analytical' AND origin = 'live' ORDER BY test_id`)).rows;
const target = async (db: Db, id: string) =>
  (await db.query<{ enabled: boolean; consecutive_failures: number; last_ok: boolean | null; last_error: string | null; cadence_minutes: number }>(
    `SELECT enabled, consecutive_failures, last_ok, last_error, cadence_minutes FROM collection_targets WHERE id = $1`, [id])).rows[0];
async function tickOnly(db: Db, id: string) {
  await syncCollectionTargets(db);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() + interval '1 day'`);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour' WHERE id = $1`, [id]);
  return runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
}

describe("the Janoshik loop is on the queue", () => {
  it("registers both kinds as market-wide targets on a daily cadence", async () => {
    // Fails while discovery and liveness are hand scripts nobody runs.
    const db = await getDatabase();
    await syncCollectionTargets(db);
    expect((await target(db, LIVE))?.cadence_minutes).toBe(24 * 60);
    expect((await target(db, CAPTURE))?.cadence_minutes).toBe(24 * 60);
    expect(CADENCE_MINUTES["lab-janoshik"]).toBe(24 * 60);
    expect(CADENCE_MINUTES["lab-janoshik-capture"]).toBe(24 * 60);
  });
});

describe("lab-janoshik (live)", () => {
  it("records the tests it does not hold and stamps liveness on every stored certificate", async () => {
    const db = await getDatabase();
    await holdAlready(db);
    stubPortal(200, portalHtml([{ ...NEW, sticky: true }, HELD, NEW]));
    const outcome = await collectJanoshikLive(db);
    expect(outcome).toMatchObject({ items: 2, ok: true });
    const rows = await stored(db);
    expect(rows.map((r) => r.test_id)).toEqual([HELD.id, NEW.id]);
    expect(rows.every((r) => r.janoshik_listed === true && r.janoshik_checked_at !== null)).toBe(true);
    // The client (the reseller a buyer recognises) outranks the manufacturer domain, legal suffix stripped.
    expect(rows.find((r) => r.test_id === NEW.id)?.vendor_slug).toBe("peptnex-biotech");
  });

  it("settles a refusal as a refusal — named on the target, disabled after three, nothing written", async () => {
    // Fails if a 403 reads as a green zero-item run, or as a defect in our own code.
    const db = await getDatabase();
    await holdAlready(db);
    stubPortal(403, "<html><head><title>Attention Required! | Cloudflare</title></head></html>");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await tickOnly(db, LIVE);
      expect(result.ran).toHaveLength(1);
      expect(result.ran[0]).toMatchObject({ collector: "lab-janoshik", ok: false, items: 0 });
      const row = await target(db, LIVE);
      expect(row.consecutive_failures).toBe(attempt);
      expect(row.last_error).toMatch(/HTTP 403/);
      expect(row.enabled).toBe(attempt < 3);
      // Re-arm for the next attempt (the queue backed it off).
      await db.query(`UPDATE collection_targets SET enabled = TRUE WHERE id = $1 AND $2::int < 3`, [LIVE, attempt]);
    }
    const rows = await stored(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].janoshik_checked_at).toBeNull();
  });

  it("treats a page with no public tests as a failed read, not a green zero", async () => {
    const db = await getDatabase();
    stubPortal(200, "<html><body><p>Scheduled maintenance</p></body></html>");
    const outcome = await collectJanoshikLive(db);
    expect(outcome.ok).toBe(false);
    expect(outcome.items).toBe(0);
    expect(outcome.error).toMatch(/no public tests/);
    expect(await stored(db)).toHaveLength(0);
  });
});

describe("lab-janoshik-capture (a person's browser snapshot)", () => {
  it("maps rows to entries, first occurrence of a verify URL wins, junk rows dropped", () => {
    const entries = entriesFromCapture(captureOf([{ ...NEW, sticky: true }, HELD, NEW]));
    expect(entries.map((e) => e.testId)).toEqual([NEW.id, HELD.id]);
    expect(entries[0]).toMatchObject({ verifyKey: NEW.key, manufacturer: NEW.mfr, client: NEW.client, note: "MOTS-c analysis" });
    const junk = captureOf([]);
    junk.rows = [["1", "https://evil.example/x", "BPC", "", "", "", 0], ["", "", "", "", "", "", 0]];
    expect(entriesFromCapture(junk)).toEqual([]);
  });

  it("ingests what it does not hold, once, and never claims to know what is listed today", async () => {
    // Fails if a capture stamps janoshik_listed / janoshik_checked_at — a snapshot cannot vouch for now.
    const db = await getDatabase();
    await holdAlready(db);
    const capture = captureOf([{ ...NEW, sticky: true }, HELD, NEW]);
    expect(await collectJanoshikCapture(db, { capture })).toMatchObject({ items: 2, ok: true });
    expect(await collectJanoshikCapture(db, { capture })).toMatchObject({ items: 2, ok: true });
    const rows = await stored(db);
    expect(rows.map((r) => r.test_id)).toEqual([HELD.id, NEW.id]);
    expect(rows.every((r) => r.janoshik_listed === null && r.janoshik_checked_at === null)).toBe(true);
  });

  it("records at most MAX_NEW_PER_RUN new certificates per run and finishes on the next", async () => {
    // Fails if one run tries to record an unbounded capture inside a serverless tick.
    const db = await getDatabase();
    const many: Fixture[] = Array.from({ length: MAX_NEW_PER_RUN + 3 }, (_, i) => ({
      id: String(300000 + i), key: `K${String(i).padStart(11, "0")}`, sample: `BPC-157 ${i} mg`, client: "Acme Peptides", mfr: "acmepeptides.example",
    }));
    const capture = captureOf(many);
    expect(await collectJanoshikCapture(db, { capture })).toMatchObject({ items: many.length, ok: true });
    expect(await stored(db)).toHaveLength(MAX_NEW_PER_RUN);
    expect(await collectJanoshikCapture(db, { capture })).toMatchObject({ items: many.length, ok: true });
    expect(await stored(db)).toHaveLength(many.length);
  });

  it("runs from the queue against the committed capture, which parses and is dated", async () => {
    const db = await getDatabase();
    const bundled = bundledCapture();
    expect(Date.parse(bundled.capturedAt)).toBeGreaterThan(Date.parse("2026-08-01T00:00:00Z"));
    expect(entriesFromCapture(bundled).length).toBeGreaterThan(100);
    const result = await tickOnly(db, CAPTURE);
    expect(result.ran[0]).toMatchObject({ collector: "lab-janoshik-capture", ok: true });
    expect(result.ran[0].items).toBe(entriesFromCapture(bundled).length);
    expect((await stored(db)).length).toBe(Math.min(MAX_NEW_PER_RUN, entriesFromCapture(bundled).length));
  });
});
