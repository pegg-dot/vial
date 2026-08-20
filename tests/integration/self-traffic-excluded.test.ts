import { beforeEach, describe, expect, it } from "vitest";
import type { QueryResultRow } from "pg";
import { NextRequest } from "next/server";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { createSession } from "@/server/auth/repository";
import { encodeSessionEnvelope, SESSION_COOKIE } from "@/server/auth/session-envelope";
import { isStaffTraffic } from "@/server/analytics/self-traffic";
import { getVisitorSummary } from "@/server/analytics/visitors";
import { POST as trackView } from "@/app/api/track/view/route";
import { GET as goOutbound } from "@/app/go/route";
import { upsertLiveCompound, upsertLiveListing, upsertLiveVendor } from "@/server/ingest/live-sources";

const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** A real signed session cookie for a real row in auth_users — no mocks, no stubbed auth. */
async function signedCookieFor(userId: string, accountType: "staff" | "customer"): Promise<string> {
  const db = await getDatabase();
  const user = (
    await db.query<QueryResultRow & { id: string }>(`SELECT * FROM auth_users WHERE id=$1`, [userId])
  ).rows[0]!;
  const session = await createSession(
    { ...user, roles: accountType === "staff" ? ["administrator"] : ["customer"] } as Parameters<typeof createSession>[0],
    { requestId: "req-test", ipHash: "iphash", userAgentHash: "uahash" },
    db,
  );
  return encodeSessionEnvelope({
    version: 1,
    sessionId: session.id,
    userId,
    accountType,
    roles: accountType === "staff" ? ["administrator"] : ["customer"],
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
}

const viewRequest = (path: string, cookie?: string) =>
  new NextRequest("https://vialgrade.com/api/track/view", {
    method: "POST",
    body: JSON.stringify({ path }),
    headers: {
      "content-type": "application/json",
      "user-agent": BROWSER,
      "x-forwarded-for": "198.51.100.9",
      ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}),
    },
  });

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  await resetDatabaseForTests();
  const db = await getDatabase();
  await db.query(
    `INSERT INTO auth_users(id,email,display_name,account_type,roles,status)
     VALUES('user:staff-self','staff@vialgrade.test','Staff','staff','["administrator"]'::jsonb,'active')
     ON CONFLICT(id) DO NOTHING`,
  );
  await db.query(
    `INSERT INTO auth_users(id,email,display_name,account_type,roles,status)
     VALUES('user:shopper','shopper@vialgrade.test','Shopper','customer','["customer"]'::jsonb,'active')
     ON CONFLICT(id) DO NOTHING`,
  );
});

describe("our own traffic is not counted as a visitor", () => {
  it("recognises a staff session cookie", async () => {
    const cookie = await signedCookieFor("user:staff-self", "staff");
    expect(await isStaffTraffic(cookie)).toBe(true);
  });

  it("does not treat a signed-out reader as staff", async () => {
    expect(await isStaffTraffic(undefined)).toBe(false);
    expect(await isStaffTraffic("not-a-real-cookie")).toBe(false);
  });

  it("does not treat a logged-in customer as staff", async () => {
    const cookie = await signedCookieFor("user:shopper", "customer");
    expect(await isStaffTraffic(cookie)).toBe(false);
  });

  it("records nothing when an admin browses the public site", async () => {
    const cookie = await signedCookieFor("user:staff-self", "staff");
    await trackView(viewRequest("/market", cookie));

    const db = await getDatabase();
    const summary = await getVisitorSummary({ connection: db });
    expect(summary.visits).toBe(0);
  });

  it("still records a signed-out reader on the same page", async () => {
    await trackView(viewRequest("/market"));

    const db = await getDatabase();
    const summary = await getVisitorSummary({ connection: db });
    expect(summary.visits).toBe(1);
  });
});

// Seeded through the REAL live writers, never hand-built rows: this is the vendor-facing revenue
// path, where a fabricated row could certify a broken exclusion as working.
async function seedClickable() {
  const db = await getDatabase();
  await upsertLiveCompound(db, {
    slug: "self-compound", name: "Self Compound", shorthand: "SELF",
    category: "Peptide", description: "test compound", aliases: ["Self"],
  });
  await upsertLiveVendor(db, {
    slug: "self-vendor", name: "Self Vendor", domains: ["selfvendor.example"], description: "test vendor",
  });
  await upsertLiveListing(db, {
    compoundSlug: "self-compound", vendorSlug: "self-vendor", slug: "self-listing",
    name: "Self 5mg", quantity: "5mg", externalUrl: "https://selfvendor.example/product/self", price: 49,
  } as Parameters<typeof upsertLiveListing>[1]);
  return db;
}

const goRequest = (listingSlug: string, cookie?: string) =>
  new NextRequest(`https://vialgrade.com/go?l=${listingSlug}`, {
    headers: {
      "user-agent": BROWSER,
      "x-forwarded-for": "198.51.100.9",
      ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}),
    },
  });

const clickCount = async (db: Awaited<ReturnType<typeof getDatabase>>) =>
  Number((await db.query<QueryResultRow & { n: string }>(`SELECT COUNT(*) n FROM outbound_clicks`)).rows[0]!.n);

describe("our own vendor clicks are not counted as demand", () => {
  it("still hands an admin through to the vendor, but records no click", async () => {
    const db = await seedClickable();
    const cookie = await signedCookieFor("user:staff-self", "staff");

    const res = await goOutbound(goRequest("self-listing", cookie));

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("selfvendor.example");
    expect(await clickCount(db)).toBe(0);
  });

  it("records a signed-out reader's click on the same listing", async () => {
    const db = await seedClickable();

    const res = await goOutbound(goRequest("self-listing"));

    expect(res.status).toBe(302);
    expect(await clickCount(db)).toBe(1);
  });
});
