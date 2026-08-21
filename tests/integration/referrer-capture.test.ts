import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { getVisitorSummary } from "@/server/analytics/visitors";
import { POST as trackView } from "@/app/api/track/view/route";

const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * A page view beacon as a browser actually sends it.
 *
 * The beacon is a same-origin POST from the page being viewed, so the request's own `Referer` is
 * the VialGrade page — NOT the site that sent the reader here. The external referrer is only
 * available to the client, via document.referrer, and has to be put in the body.
 */
const beacon = (path: string, opts: { documentReferrer?: string } = {}) =>
  new NextRequest("https://vialgrade.com/api/track/view", {
    method: "POST",
    body: JSON.stringify({ path, referrer: opts.documentReferrer ?? "" }),
    headers: {
      "content-type": "application/json",
      "user-agent": BROWSER,
      "x-forwarded-for": "198.51.100.9",
      referer: `https://vialgrade.com${path}`, // what the browser really puts on the beacon
    },
  });

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  await resetDatabaseForTests();
});

describe("where a reader came from", () => {
  it("credits the site that actually sent them", async () => {
    await trackView(beacon("/market", { documentReferrer: "https://www.reddit.com/r/Peptides/comments/abc" }));

    const s = await getVisitorSummary({ connection: await getDatabase() });
    expect(s.topSources.map(x => x.source)).toContain("reddit.com");
  });

  it("credits a search engine rather than calling it direct", async () => {
    await trackView(beacon("/compounds/bpc-157", { documentReferrer: "https://www.google.com/" }));

    const s = await getVisitorSummary({ connection: await getDatabase() });
    expect(s.topSources.map(x => x.source)).toContain("google.com");
  });

  it("still calls a typed-in visit direct", async () => {
    await trackView(beacon("/", { documentReferrer: "" }));

    const s = await getVisitorSummary({ connection: await getDatabase() });
    expect(s.topSources.map(x => x.source)).toEqual(["direct"]);
  });

  it("treats moving between our own pages as internal, not a referral", async () => {
    await trackView(beacon("/products/x", { documentReferrer: "https://vialgrade.com/market" }));

    const s = await getVisitorSummary({ connection: await getDatabase() });
    expect(s.topSources.map(x => x.source)).toEqual(["direct"]);
  });

  it("ignores a junk referrer rather than storing it", async () => {
    await trackView(beacon("/", { documentReferrer: "not a url at all" }));

    const s = await getVisitorSummary({ connection: await getDatabase() });
    expect(s.topSources.map(x => x.source)).toEqual(["direct"]);
  });
});
