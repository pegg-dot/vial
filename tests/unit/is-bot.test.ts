import { describe, expect, it } from "vitest";
import { isAttributableVisitor, isBotUserAgent } from "@/server/analytics/is-bot";

// "We sent you 676 buyers" is the claim the business rests on. The first thing a vendor does is
// check their own analytics — so a figure inflated with crawler hits does not just look wrong, it
// ends the conversation. Under-counting is the safe direction; over-counting is fatal.
describe("bot detection", () => {
  it("treats a missing or stub user-agent as a bot", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent("   ")).toBe(true);
    expect(isBotUserAgent("Mozilla")).toBe(true); // too short to be a real browser
  });

  it("catches the crawlers that actually hit a live site", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0)",
      "Mozilla/5.0 (compatible; ClaudeBot/1.0)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
      "Mozilla/5.0 (compatible; Bytespider)",
      "facebookexternalhit/1.1",
      "Slackbot-LinkExpanding 1.0",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "node-fetch/1.0",
      "Mozilla/5.0 HeadlessChrome/120.0.0.0",
    ]) {
      expect(isBotUserAgent(ua), ua).toBe(true);
    }
  });

  // Our own verification traffic must never inflate the numbers either.
  it("excludes our own tooling", () => {
    expect(isBotUserAgent("VialGrade-Catalog-Import/1.0 (+https://vialgrade.app/how-we-check)")).toBe(true);
  });

  it("lets real browsers through", () => {
    for (const ua of [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    ]) {
      expect(isBotUserAgent(ua), ua).toBe(false);
    }
  });
});

describe("attributable visitors", () => {
  const REAL = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

  // Without an address every visitor hashes identically — which is how 676 clicks collapsed into
  // "1 distinct person" on the live dashboard.
  it("requires both a real browser and a client address", () => {
    expect(isAttributableVisitor(REAL, "1.2.3.4")).toBe(true);
    expect(isAttributableVisitor(REAL, null)).toBe(false);
    expect(isAttributableVisitor(REAL, "")).toBe(false);
    expect(isAttributableVisitor("curl/8.4.0", "1.2.3.4")).toBe(false);
  });
});
