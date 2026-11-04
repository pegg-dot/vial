import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import type { OutboundEmail } from "@/server/email/resend";
import { confirmSubscription, purgeStalePending, requestSubscription, unsubscribeAndDelete, type Mailer } from "@/server/digest/subscribers";
import { MAX_SENDS_PER_RUN, runDigest } from "@/server/digest/send-digest";
import { signDigestToken } from "@/server/digest/tokens";
import type { TopicTrials } from "@/server/intelligence/public-trials";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "email-digest-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "email-digest-privacy-secret-at-least-32-chars";

const config = { apiKey: "k", from: "VialGrade <u@v.example>", siteUrl: "https://v.example" };
const outbox: OutboundEmail[] = [];
let failSends = false;
let failFor: string | null = null;
const send: Mailer = async m => { if (failSends || m.to === failFor) return { ok: false }; outbox.push(m); return { ok: true }; };
const mail = { config, send };

const topics = (updated: string, unavailable = false): TopicTrials[] => [{
  key: "t", label: "Tirzepatide", checkedAt: "x", unavailable,
  studies: [{ nctId: "NCT00000001", title: "A study", status: "RECRUITING", phase: null, sponsor: null, lastUpdated: updated, resultsReported: false }],
}];
const NOW = new Date("2026-11-09T14:00:00Z");

async function idOf(email: string) {
  const db = await getDatabase();
  return (await db.query<{ id: string }>(`SELECT id FROM digest_subscribers WHERE email=$1`, [email])).rows[0]?.id;
}
async function addActive(email: string) {
  const db = await getDatabase();
  expect(await requestSubscription(db, email, mail)).toBe("sent");
  const id = (await idOf(email))!;
  expect(await confirmSubscription(db, id, signDigestToken(id, "confirm"))).toBe(true);
  outbox.length = 0;
  return id;
}

describe("email-only update list", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });
  beforeEach(async () => {
    outbox.length = 0; failSends = false; failFor = null;
    const db = await getDatabase();
    await db.query(`DELETE FROM digest_subscribers`);
    await db.query(`DELETE FROM digest_state`);
  });

  it("stores a pending row and mails a confirm link only to the address given", async () => {
    const db = await getDatabase();
    expect(await requestSubscription(db, " New@Example.org ", mail)).toBe("sent");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe("new@example.org");
    const id = (await idOf("new@example.org"))!;
    expect(outbox[0]!.text).toContain("https://v.example/intelligence/updates/confirm?id=" + id + "&t=" + signDigestToken(id, "confirm"));
    const row = (await db.query<{ status: string; consent_version: string }>(`SELECT status, consent_version FROM digest_subscribers WHERE id=$1`, [id])).rows[0]!;
    expect(row).toEqual({ status: "pending", consent_version: "digest-2026-11" });
  });

  it("keeps nothing for an invalid address or when mail is not configured or sending fails", async () => {
    const db = await getDatabase();
    expect(await requestSubscription(db, "nope", mail)).toBe("invalid");
    expect(await requestSubscription(db, "a@example.org", null)).toBe("unavailable");
    failSends = true;
    expect(await requestSubscription(db, "b@example.org", mail)).toBe("unavailable");
    expect((await db.query(`SELECT 1 FROM digest_subscribers`)).rows).toHaveLength(0);
  });

  it("does not reveal or re-mail an address that is already active, and throttles confirm re-sends", async () => {
    const db = await getDatabase();
    await addActive("on@example.org");
    // Past the re-send throttle, so only the "already active" rule can stop a second email.
    await db.query(`UPDATE digest_subscribers SET confirm_sent_at = NOW() - INTERVAL '2 hours' WHERE email='on@example.org'`);
    expect(await requestSubscription(db, "ON@example.org", mail)).toBe("sent");
    expect(outbox).toHaveLength(0);
    expect(await requestSubscription(db, "p@example.org", mail)).toBe("sent");
    expect(await requestSubscription(db, "p@example.org", mail)).toBe("sent");
    expect(outbox).toHaveLength(1);
    await db.query(`UPDATE digest_subscribers SET confirm_sent_at = NOW() - INTERVAL '11 minutes' WHERE email='p@example.org'`);
    expect(await requestSubscription(db, "p@example.org", mail)).toBe("sent");
    expect(outbox).toHaveLength(2);
  });

  it("caps new pending signups per hour", async () => {
    const db = await getDatabase();
    for (let i = 0; i < 100; i++) await db.query(`INSERT INTO digest_subscribers(id,email,status,consent_version) VALUES($1,$2,'pending','v')`, ["id" + i, `p${i}@example.org`]);
    expect(await requestSubscription(db, "late@example.org", mail)).toBe("unavailable");
    expect(await idOf("late@example.org")).toBeUndefined();
  });

  it("confirms only with the right token for that purpose, and not after 3 days", async () => {
    const db = await getDatabase();
    await requestSubscription(db, "c@example.org", mail);
    const id = (await idOf("c@example.org"))!;
    expect(await confirmSubscription(db, id, signDigestToken(id, "unsubscribe"))).toBe(false);
    expect(await confirmSubscription(db, id, "garbage")).toBe(false);
    expect(await confirmSubscription(db, id, null)).toBe(false);
    await db.query(`UPDATE digest_subscribers SET created_at = NOW() - INTERVAL '4 days' WHERE id=$1`, [id]);
    expect(await confirmSubscription(db, id, signDigestToken(id, "confirm"))).toBe(false);
    await db.query(`UPDATE digest_subscribers SET created_at = NOW() WHERE id=$1`, [id]);
    expect(await confirmSubscription(db, id, signDigestToken(id, "confirm"))).toBe(true);
    expect((await db.query<{ status: string }>(`SELECT status FROM digest_subscribers WHERE id=$1`, [id])).rows[0]!.status).toBe("active");
  });

  it("unsubscribing deletes the row; a confirm token cannot do it; stale pending rows are purged", async () => {
    const db = await getDatabase();
    const id = await addActive("gone@example.org");
    expect(await unsubscribeAndDelete(db, id, signDigestToken(id, "confirm"))).toBe(false);
    expect(await idOf("gone@example.org")).toBe(id);
    expect(await unsubscribeAndDelete(db, id, signDigestToken(id, "unsubscribe"))).toBe(true);
    expect(await idOf("gone@example.org")).toBeUndefined();
    await db.query(`INSERT INTO digest_subscribers(id,email,status,consent_version,created_at) VALUES('old','old@example.org','pending','v',NOW() - INTERVAL '4 days'),('new','new@example.org','pending','v',NOW())`);
    expect(await purgeStalePending(db)).toBe(1);
    expect(await idOf("old@example.org")).toBeUndefined();
    expect(await idOf("new@example.org")).toBe("new");
  });

  describe("monthly run", () => {
    const marker = async () => (await (await getDatabase()).query<{ value: string }>(`SELECT value FROM digest_state WHERE key='last_digest_date'`)).rows[0]?.value;

    it("does nothing without mail configuration or while the registry is down, and keeps the marker", async () => {
      const db = await getDatabase();
      await addActive("r@example.org");
      expect(await runDigest(db, { topics: async () => topics("2026-11-08"), mail: null, now: NOW })).toEqual({ state: "skipped", reason: "email-not-configured" });
      expect(await runDigest(db, { topics: async () => topics("2026-11-08", true), mail, now: NOW })).toEqual({ state: "skipped", reason: "registry-unavailable" });
      expect(outbox).toHaveLength(0);
      expect(await marker()).toBeUndefined();
    });

    it("mails active readers only, with an unsubscribe link and header, then advances the marker", async () => {
      const db = await getDatabase();
      const id = await addActive("a@example.org");
      await requestSubscription(db, "pending@example.org", mail);
      outbox.length = 0;
      const result = await runDigest(db, { topics: async () => topics("2026-11-08"), mail, now: NOW });
      expect(result).toMatchObject({ state: "ok", changes: 1, sent: 1, failed: 0, remaining: 0 });
      expect(outbox).toHaveLength(1);
      expect(outbox[0]!.to).toBe("a@example.org");
      expect(outbox[0]!.text).toContain("/intelligence/updates/unsubscribe?id=" + id + "&t=" + signDigestToken(id, "unsubscribe"));
      expect(outbox[0]!.headers?.["List-Unsubscribe"]).toContain("/intelligence/updates/unsubscribe?id=" + id);
      expect(await marker()).toBe("2026-11-09");
      // Same week, second run: nobody is mailed twice.
      outbox.length = 0;
      await runDigest(db, { topics: async () => topics("2026-11-09"), mail, now: new Date("2026-11-09T18:00:00Z") });
      expect(outbox).toHaveLength(0);
    });

    it("sends no email when nothing changed, yet still moves the marker", async () => {
      const db = await getDatabase();
      await addActive("q@example.org");
      const result = await runDigest(db, { topics: async () => topics("2026-01-01"), mail, now: NOW });
      expect(result).toMatchObject({ state: "ok", changes: 0, sent: 0 });
      expect(outbox).toHaveLength(0);
      expect(await marker()).toBe("2026-11-09");
    });

    it("keeps the marker after an outage where every send failed, but not for one bad address", async () => {
      const db = await getDatabase();
      await addActive("x@example.org");
      failSends = true;
      expect(await runDigest(db, { topics: async () => topics("2026-11-08"), mail, now: NOW })).toMatchObject({ sent: 0, failed: 1 });
      expect(await marker()).toBeUndefined();
      failSends = false;
      await addActive("y@example.org");
      failFor = "x@example.org";
      expect(await runDigest(db, { topics: async () => topics("2026-11-08"), mail, now: NOW })).toMatchObject({ sent: 1, failed: 1 });
      expect(await marker()).toBe("2026-11-09");
    });

    it("reports readers beyond the per-run cap and leaves the marker until they are mailed", async () => {
      const db = await getDatabase();
      for (let i = 0; i < MAX_SENDS_PER_RUN + 2; i++) await db.query(`INSERT INTO digest_subscribers(id,email,status,consent_version) VALUES($1,$2,'active','v')`, ["s" + i, `s${i}@example.org`]);
      const first = await runDigest(db, { topics: async () => topics("2026-11-08"), mail, now: NOW });
      expect(first).toMatchObject({ sent: MAX_SENDS_PER_RUN, remaining: 2 });
      expect(await marker()).toBeUndefined();
      const second = await runDigest(db, { topics: async () => topics("2026-11-08"), mail, now: NOW });
      expect(second).toMatchObject({ sent: 2, remaining: 0 });
      expect(await marker()).toBe("2026-11-09");
    });
  });
});
