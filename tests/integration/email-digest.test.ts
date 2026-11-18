import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import type { OutboundEmail } from "@/server/email/resend";
import { confirmSubscription, purgeStalePending, requestSubscription, sendWaitingConfirmations, unsubscribeAndDelete, type Mailer } from "@/server/digest/subscribers";
import { getSignupOverview } from "@/server/digest/signup-overview";
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

  it("keeps nothing for an invalid address, or when mail is configured and sending fails", async () => {
    const db = await getDatabase();
    expect(await requestSubscription(db, "nope", mail)).toBe("invalid");
    expect(await requestSubscription(db, "nope", null)).toBe("invalid");
    failSends = true;
    expect(await requestSubscription(db, "b@example.org", mail)).toBe("unavailable");
    expect((await db.query(`SELECT 1 FROM digest_subscribers`)).rows).toHaveLength(0);
  });

  describe("before the update email has started (no mail configured)", () => {
    const rowOf = async (email: string) => (await (await getDatabase()).query<{ status: string; consent_version: string; confirm_sent_at: unknown; confirmed_at: unknown }>(
      `SELECT status, consent_version, confirm_sent_at, confirmed_at FROM digest_subscribers WHERE email=$1`, [email])).rows[0];

    it("saves the address with its consent, unconfirmed, and mails nothing", async () => {
      const db = await getDatabase();
      expect(await requestSubscription(db, " Early@Example.org ", null)).toBe("saved");
      expect(outbox).toHaveLength(0);
      expect(await rowOf("early@example.org")).toEqual({ status: "pending", consent_version: "digest-2026-11", confirm_sent_at: null, confirmed_at: null });
    });

    it("gives the same reply for an address already here, and stores it once", async () => {
      const db = await getDatabase();
      expect(await requestSubscription(db, "twice@example.org", null)).toBe("saved");
      expect(await requestSubscription(db, "TWICE@example.org", null)).toBe("saved");
      await addActive("on@example.org");
      expect(await requestSubscription(db, "on@example.org", null)).toBe("saved");
      expect((await db.query(`SELECT 1 FROM digest_subscribers`)).rows).toHaveLength(2);
      expect((await rowOf("on@example.org"))!.status).toBe("active");
    });

    it("still caps new signups per hour, so a flood cannot fill the list", async () => {
      const db = await getDatabase();
      for (let i = 0; i < 100; i++) expect(await requestSubscription(db, `flood${i}@example.org`, null)).toBe("saved");
      expect(await requestSubscription(db, "late@example.org", null)).toBe("unavailable");
      expect(await idOf("late@example.org")).toBeUndefined();
    });

    it("is not purged for waiting, however long, and gets no monthly update while unconfirmed", async () => {
      const db = await getDatabase();
      await requestSubscription(db, "patient@example.org", null);
      await db.query(`UPDATE digest_subscribers SET created_at = NOW() - INTERVAL '90 days' WHERE email='patient@example.org'`);
      expect(await purgeStalePending(db)).toBe(0);
      expect(await idOf("patient@example.org")).toBeDefined();
      // Mail is still off: the monthly run does nothing at all, and the row is untouched.
      expect(await runDigest(db, { topics: async () => topics("2026-11-08"), mail: null, now: NOW })).toEqual({ state: "skipped", reason: "email-not-configured" });
      expect((await rowOf("patient@example.org"))!.confirm_sent_at).toBeNull();
    });

    it("once sending starts, the monthly run mails each waiting address one confirmation link and nothing else", async () => {
      const db = await getDatabase();
      await requestSubscription(db, "w1@example.org", null);
      await requestSubscription(db, "w2@example.org", null);
      await db.query(`UPDATE digest_subscribers SET created_at = NOW() - INTERVAL '40 days'`);
      const result = await runDigest(db, { topics: async () => topics("2026-11-08"), mail, now: NOW });
      expect(result).toMatchObject({ state: "ok", confirmations: 2, changes: 1, sent: 0, purged: 0 });
      expect(outbox.map(m => m.to).sort()).toEqual(["w1@example.org", "w2@example.org"]);
      for (const message of outbox) expect(message.subject).toBe("Confirm your VialGrade update email");
      const id = (await idOf("w1@example.org"))!;
      expect(outbox.find(m => m.to === "w1@example.org")!.text).toContain("/intelligence/updates/confirm?id=" + id + "&t=" + signDigestToken(id, "confirm"));
      expect((await rowOf("w1@example.org"))!.confirm_sent_at).not.toBeNull();
      // A second run does not send the link again.
      outbox.length = 0;
      expect(await runDigest(db, { topics: async () => topics("2026-11-08"), mail, now: NOW })).toMatchObject({ confirmations: 0 });
      expect(outbox).toHaveLength(0);
      // The link works even though the address was saved 40 days ago: the 3 days run from when it was mailed.
      expect(await confirmSubscription(db, id, signDigestToken(id, "confirm"))).toBe(true);
      // The one that never clicks is deleted 3 days after its link went out, not before.
      expect(await purgeStalePending(db)).toBe(0);
      await db.query(`UPDATE digest_subscribers SET confirm_sent_at = NOW() - INTERVAL '4 days' WHERE email='w2@example.org'`);
      expect(await purgeStalePending(db)).toBe(1);
      expect(await idOf("w2@example.org")).toBeUndefined();
      expect(await idOf("w1@example.org")).toBe(id);
    });

    it("sends the waiting confirmations even when the registry is down, and leaves a failed one waiting", async () => {
      const db = await getDatabase();
      await requestSubscription(db, "ok@example.org", null);
      await requestSubscription(db, "bad@example.org", null);
      failFor = "bad@example.org";
      expect(await runDigest(db, { topics: async () => topics("2026-11-08", true), mail, now: NOW })).toEqual({ state: "skipped", reason: "registry-unavailable", confirmations: 1 });
      expect((await rowOf("ok@example.org"))!.confirm_sent_at).not.toBeNull();
      expect((await rowOf("bad@example.org"))!.confirm_sent_at).toBeNull();
      failFor = null;
      expect(await sendWaitingConfirmations(db, mail)).toEqual({ sent: 1, failed: 0, remaining: 0 });
    });

    it("sends at most the limit per run, oldest first, and reports the rest", async () => {
      const db = await getDatabase();
      for (let i = 0; i < 5; i++) await db.query(`INSERT INTO digest_subscribers(id,email,status,consent_version,created_at) VALUES($1,$2,'pending','v',NOW() - ($3 || ' minutes')::interval)`, ["w" + i, `w${i}@example.org`, String(50 - i)]);
      expect(await sendWaitingConfirmations(db, mail, 3)).toEqual({ sent: 3, failed: 0, remaining: 2 });
      expect(outbox.map(m => m.to)).toEqual(["w0@example.org", "w1@example.org", "w2@example.org"]);
    });

    it("a signup made once sending has started asks for the link straight away, even for an address that was waiting", async () => {
      const db = await getDatabase();
      await requestSubscription(db, "again@example.org", null);
      expect(await requestSubscription(db, "again@example.org", mail)).toBe("sent");
      expect(outbox.map(m => m.to)).toEqual(["again@example.org"]);
      expect((await rowOf("again@example.org"))!.confirm_sent_at).not.toBeNull();
    });
  });

  describe("signup overview for the admin page", () => {
    it("counts who is on the list by state and by recency, and lists the newest first", async () => {
      const db = await getDatabase();
      await addActive("confirmed@example.org");
      await requestSubscription(db, "linksent@example.org", mail);
      await requestSubscription(db, "waiting@example.org", null);
      await requestSubscription(db, "old@example.org", null);
      await db.query(`UPDATE digest_subscribers SET created_at = NOW() - INTERVAL '10 days' WHERE email='linksent@example.org'`);
      await db.query(`UPDATE digest_subscribers SET created_at = NOW() - INTERVAL '45 days' WHERE email='old@example.org'`);
      const overview = await getSignupOverview({ connection: db, mailConnected: false, limit: 3 });
      expect(overview).toMatchObject({ total: 4, confirmed: 1, confirmationSent: 1, waiting: 2, last7Days: 2, last30Days: 3, previous30Days: 1, mailConnected: false, lastUpdateThrough: null });
      expect(overview.daily).toHaveLength(30);
      expect(overview.daily.reduce((sum, d) => sum + d.count, 0)).toBe(3);
      expect(overview.daily.at(-1)!.count).toBe(2);
      // Capped at the limit, newest first; the total above is the count, not this length.
      expect(overview.rows).toHaveLength(3);
      expect(overview.rows.map(r => r.email)).not.toContain("old@example.org");
      expect(overview.rows.at(-1)!.email).toBe("linksent@example.org");
      const states = Object.fromEntries(overview.rows.map(r => [r.email, r.state]));
      expect(states).toEqual({ "confirmed@example.org": "confirmed", "waiting@example.org": "waiting", "linksent@example.org": "confirmation-sent" });
      expect(overview.rows.find(r => r.email === "confirmed@example.org")!.confirmedAt).not.toBeNull();
    });

    it("carries only list fields: no hash, token, consent text or anything that could tie a row to reading", async () => {
      const db = await getDatabase();
      await requestSubscription(db, "shape@example.org", null);
      const overview = await getSignupOverview({ connection: db, mailConnected: true });
      expect(Object.keys(overview.rows[0]!).sort()).toEqual(["confirmedAt", "email", "id", "lastEmailedAt", "signedUpAt", "state"]);
      expect(overview.mailConnected).toBe(true);
    });

    it("is all zeros for an empty list, and stops listing someone who unsubscribed", async () => {
      const db = await getDatabase();
      expect(await getSignupOverview({ connection: db, mailConnected: false })).toMatchObject({ total: 0, confirmed: 0, waiting: 0, last30Days: 0, rows: [] });
      const id = await addActive("leaving@example.org");
      expect((await getSignupOverview({ connection: db, mailConnected: false })).total).toBe(1);
      await unsubscribeAndDelete(db, id, signDigestToken(id, "unsubscribe"));
      expect(await getSignupOverview({ connection: db, mailConnected: false })).toMatchObject({ total: 0, rows: [] });
    });

    it("reports the date the last monthly update ran through", async () => {
      const db = await getDatabase();
      await runDigest(db, { topics: async () => topics("2026-01-01"), mail, now: NOW });
      expect((await getSignupOverview({ connection: db, mailConnected: true })).lastUpdateThrough).toBe("2026-11-09");
    });
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
    for (let i = 0; i < 100; i++) await db.query(`INSERT INTO digest_subscribers(id,email,status,consent_version,confirm_sent_at) VALUES($1,$2,'pending','v',NOW())`, ["id" + i, `p${i}@example.org`]);
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
    // The 3 days run from when the link was mailed.
    await db.query(`UPDATE digest_subscribers SET confirm_sent_at = NOW() - INTERVAL '4 days' WHERE id=$1`, [id]);
    expect(await confirmSubscription(db, id, signDigestToken(id, "confirm"))).toBe(false);
    await db.query(`UPDATE digest_subscribers SET confirm_sent_at = NOW() WHERE id=$1`, [id]);
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
    await db.query(`INSERT INTO digest_subscribers(id,email,status,consent_version,created_at,confirm_sent_at) VALUES('old','old@example.org','pending','v',NOW() - INTERVAL '4 days',NOW() - INTERVAL '4 days'),('new','new@example.org','pending','v',NOW(),NOW())`);
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
      expect(await runDigest(db, { topics: async () => topics("2026-11-08", true), mail, now: NOW })).toEqual({ state: "skipped", reason: "registry-unavailable", confirmations: 0 });
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
