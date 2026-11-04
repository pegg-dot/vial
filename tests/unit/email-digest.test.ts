import { describe, expect, it, vi } from "vitest";
import { normalizeEmail, signDigestToken, verifyDigestToken } from "@/server/digest/tokens";
import { allTopicsAnswered, buildDigest, confirmationEmail, DIGEST_MAX_ITEMS, selectDigestChanges } from "@/lib/digest-content";
import { emailConfig, sendEmail } from "@/server/email/resend";
import { updatesPromptAllowedOn } from "@/lib/updates-prompt";
import { accessDecision } from "@/server/auth/access-policy";
import type { TopicTrials } from "@/server/intelligence/public-trials";

const KEY = "unit-test-digest-key-at-least-32-characters-long";
const BANNED = ["buy", "shop", "price", "cart", "order", "available from", "in stock", "supplier", "vendor", "purchase", "discount"];

const trial = (nctId: string, lastUpdated: string | null, status = "RECRUITING") =>
  ({ nctId, title: "Study " + nctId, status, phase: null, sponsor: null, lastUpdated, resultsReported: false });
const topic = (label: string, studies: ReturnType<typeof trial>[], unavailable = false): TopicTrials =>
  ({ key: label.toLowerCase(), label, studies, checkedAt: "2026-11-04T00:00:00Z", unavailable });

describe("digest link tokens", () => {
  it("verifies its own token and nothing else", () => {
    const t = signDigestToken("abc", "unsubscribe", KEY);
    expect(verifyDigestToken("abc", "unsubscribe", t, KEY)).toBe(true);
    expect(verifyDigestToken("abd", "unsubscribe", t, KEY)).toBe(false);
    expect(verifyDigestToken("abc", "confirm", t, KEY)).toBe(false);
    expect(verifyDigestToken("abc", "unsubscribe", t + "x", KEY)).toBe(false);
    expect(verifyDigestToken("abc", "unsubscribe", t, KEY + "x")).toBe(false);
    expect(verifyDigestToken("abc", "unsubscribe", "", KEY)).toBe(false);
    expect(verifyDigestToken("abc", "unsubscribe", null, KEY)).toBe(false);
    expect(verifyDigestToken("", "unsubscribe", t, KEY)).toBe(false);
  });
});

describe("email normalisation", () => {
  it("accepts one plausible mailbox and lower-cases it", () => {
    expect(normalizeEmail("  Reader@Example.ORG ")).toBe("reader@example.org");
    expect(normalizeEmail("a.b+tag@sub.example.co")).toBe("a.b+tag@sub.example.co");
  });
  it("rejects lists, display names, spaces, bad dots and non-strings", () => {
    for (const bad of ["a@b", "a@b.c", "two@x.com,three@x.com", "Name <a@x.com>", "a b@x.com", "a@@x.com", ".a@x.com", "a..b@x.com", "a@x..com", "", "x".repeat(260) + "@x.com", 5, null, undefined]) {
      expect(normalizeEmail(bad as unknown)).toBeNull();
    }
  });
});

describe("digest content", () => {
  const topics = [
    topic("Tirzepatide", [trial("NCT00000001", "2026-11-02"), trial("NCT00000002", "2026-10-01"), trial("NCT00000003", "2026-11-02", "ACTIVE_NOT_RECRUITING"), trial("NCT00000004", "2026-11"), trial("NCT00000005", null)]),
    topic("Cagrilintide", [trial("NCT00000006", "2026-11-03")]),
  ];
  it("selects only dated updates on or after the cutoff, newest first, never guessing partial dates", () => {
    const rows = selectDigestChanges(topics, "2026-10-28");
    expect(rows.map(r => r.nctId)).toEqual(["NCT00000006", "NCT00000001", "NCT00000003"]);
    expect(rows[2]!.status).toBe("active not recruiting");
    expect(selectDigestChanges(topics, "not-a-date")).toEqual([]);
  });
  it("skips a topic the registry did not answer for, and says so via allTopicsAnswered", () => {
    const down = [topic("A", [trial("NCT00000007", "2026-11-03")], true), topics[1]!];
    expect(selectDigestChanges(down, "2026-10-01").map(r => r.nctId)).toEqual(["NCT00000006"]);
    expect(allTopicsAnswered(down)).toBe(false);
    expect(allTopicsAnswered(topics)).toBe(true);
    expect(allTopicsAnswered([])).toBe(false);
  });
  it("caps the list", () => {
    const many = topic("X", Array.from({ length: 30 }, (_, i) => trial("NCT" + String(10000000 + i), "2026-11-02")));
    expect(selectDigestChanges([many], "2026-10-01")).toHaveLength(DIGEST_MAX_ITEMS);
  });
  it("sends nothing when nothing changed", () => {
    expect(buildDigest({ changes: [], siteUrl: "https://v.example", unsubscribeUrl: "https://v.example/u", since: "2026-10-28" })).toBeNull();
  });
  it("links each record, carries the unsubscribe link, escapes html and uses no selling words", () => {
    const changes = selectDigestChanges([topic("Tirzepatide", [{ ...trial("NCT00000001", "2026-11-02"), title: "A <b>bold</b> & \"quoted\" study" }])], "2026-10-28");
    const mail = buildDigest({ changes, siteUrl: "https://v.example", unsubscribeUrl: "https://v.example/u?id=1", since: "2026-10-28" })!;
    expect(mail.subject).toBe("VialGrade: 1 registry record updated");
    expect(mail.text).toContain("https://v.example/intelligence/studies/NCT00000001");
    expect(mail.text).toContain("https://v.example/u?id=1");
    expect(mail.text).toContain("not that a study produced a result");
    expect(mail.html).not.toContain("<b>bold</b>");
    expect(mail.html).toContain("&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;");
    expect(mail.html).toContain('href="https://v.example/u?id=1"');
    const all = (mail.text + mail.html + confirmationEmail("https://v.example/c").text).toLowerCase();
    for (const w of BANNED) expect(all).not.toContain(w);
  });
});

describe("Resend client", () => {
  const config = { apiKey: "re_secret_key", from: "VialGrade <updates@v.example>", siteUrl: "https://v.example" };
  const message = { to: "r@example.org", subject: "s", text: "t", html: "<p>t</p>", headers: { "List-Unsubscribe": "<https://v.example/u>" } };
  it("posts one authenticated JSON request and reports success", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await sendEmail(message, config, fetchImpl as unknown as typeof fetch)).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_secret_key");
    expect(JSON.parse(String(init.body))).toMatchObject({ from: config.from, to: ["r@example.org"], headers: { "List-Unsubscribe": "<https://v.example/u>" } });
  });
  it("reports failure for a rejected request or a network fault, without throwing or leaking the key", async () => {
    expect(await sendEmail(message, config, (async () => new Response("no", { status: 422 })) as unknown as typeof fetch)).toEqual({ ok: false });
    const result = await sendEmail(message, config, (async () => { throw new Error("boom re_secret_key"); }) as unknown as typeof fetch);
    expect(result).toEqual({ ok: false });
    expect(JSON.stringify(result)).not.toContain("re_secret_key");
  });
  it("is configured only when key, sender and an https (or localhost) site URL are all set", () => {
    const ok = { RESEND_API_KEY: "k", DIGEST_FROM_EMAIL: "a@b.c", NEXT_PUBLIC_SITE_URL: "https://v.example/" } as unknown as NodeJS.ProcessEnv;
    expect(emailConfig(ok)).toEqual({ apiKey: "k", from: "a@b.c", siteUrl: "https://v.example" });
    expect(emailConfig({ ...ok, RESEND_API_KEY: "" })).toBeNull();
    expect(emailConfig({ ...ok, DIGEST_FROM_EMAIL: undefined })).toBeNull();
    expect(emailConfig({ ...ok, NEXT_PUBLIC_SITE_URL: "http://v.example" })).toBeNull();
    expect(emailConfig({ ...ok, NEXT_PUBLIC_SITE_URL: "http://localhost:3100" })).not.toBeNull();
  });
});

describe("first-visit bar rule and perimeter", () => {
  it("offers the bar on research pages but never on signup, legal, login, register, admin or account", () => {
    for (const ok of ["/intelligence", "/intelligence/", "/intelligence/market", "/intelligence/explore/pexiganan"]) expect(updatesPromptAllowedOn(ok)).toBe(true);
    for (const no of ["/intelligence/updates", "/intelligence/updates/", "/intelligence/updates/confirm", "/intelligence/updates/unsubscribe", "/legal/privacy", "/login", "/register", "/admin", "/admin/login", "/account", "/", "/intelligence-x"]) expect(updatesPromptAllowedOn(no)).toBe(false);
  });
  it("keeps the signup pages and weekly cron reachable without a session, and nothing wider", () => {
    for (const p of ["/intelligence/updates", "/intelligence/updates/confirm", "/intelligence/updates/unsubscribe", "/api/internal/cron/digest"]) expect(accessDecision(p, null).allowed).toBe(true);
    for (const p of ["/intelligence/updates/other", "/api/v1/updates", "/api/internal/cron/other"]) expect(accessDecision(p, null).allowed).toBe(false);
  });
});
