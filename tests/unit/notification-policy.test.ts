import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  asAlertCategory,
  decideDelivery,
  digestDelayMs,
  isWithinQuietHours,
  type AlertCategory,
  type NotificationPreferences,
} from "@/server/notifications/policy";

const NOON_UTC = new Date("2026-08-25T12:00:00.000Z");

function prefs(over: Partial<NotificationPreferences> = {}): NotificationPreferences {
  // Quiet hours parked far from noon UTC so a test about one setting is never really a test about
  // the clock. Tests that care about quiet hours set them explicitly.
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, timezone: "UTC", quietHoursStart: "23:00", quietHoursEnd: "23:30", relevanceThreshold: 0, ...over };
}

function decide(over: Partial<Parameters<typeof decideDelivery>[0]> = {}) {
  return decideDelivery({ category: "price-change", source: "watchlist", relevance: 0.9, preferences: prefs(), now: NOON_UTC, ...over });
}

// Every column below was verified DEAD before this module existed: stored, rendered as a control,
// and read by no code that changes behaviour. One test per column, so "it binds" is a fact rather
// than a claim.
describe("each notification preference actually binds", () => {
  it("in_app_enabled suppresses the inbox row", () => {
    expect(decide().inApp).toBe(true);
    const off = decide({ preferences: prefs({ inAppEnabled: false }) });
    expect(off.inApp).toBe(false);
    expect(off.suppressedBy).toBe("in_app_enabled");
  });

  it("price_alerts governs price changes and nothing else", () => {
    const off = prefs({ priceAlerts: false });
    expect(decide({ category: "price-change", preferences: off }).inApp).toBe(false);
    expect(decide({ category: "evidence-change", preferences: off }).inApp).toBe(true);
  });

  it("evidence_alerts governs both evidence and batch changes", () => {
    const off = prefs({ evidenceAlerts: false });
    expect(decide({ category: "evidence-change", preferences: off }).suppressedBy).toBe("evidenceAlerts");
    expect(decide({ category: "batch-change", preferences: off }).suppressedBy).toBe("evidenceAlerts");
    expect(decide({ category: "price-change", preferences: off }).inApp).toBe(true);
  });

  it("availability_alerts governs availability and shipping changes", () => {
    const off = prefs({ availabilityAlerts: false });
    expect(decide({ category: "availability-change", preferences: off }).inApp).toBe(false);
    expect(decide({ category: "shipping-change", preferences: off }).inApp).toBe(false);
    expect(decide({ category: "price-change", preferences: off }).inApp).toBe(true);
  });

  it("order_alerts governs order notifications", () => {
    expect(decide({ source: "order", category: null, preferences: prefs({ orderAlerts: false }) }).suppressedBy).toBe("order_alerts");
    expect(decide({ source: "order", category: null }).inApp).toBe(true);
  });

  it("saved_search_alerts governs saved-search notifications", () => {
    expect(decide({ source: "saved-search", category: null, preferences: prefs({ savedSearchAlerts: false }) }).suppressedBy).toBe("saved_search_alerts");
    expect(decide({ source: "saved-search", category: null }).inApp).toBe(true);
  });

  it("followed_entity_alerts governs follow-derived notifications", () => {
    expect(decide({ source: "follow", preferences: prefs({ followedEntityAlerts: false }) }).suppressedBy).toBe("followed_entity_alerts");
    expect(decide({ source: "follow" }).inApp).toBe(true);
  });

  it("market_digest governs the change summary", () => {
    expect(decide({ source: "digest", category: null, preferences: prefs({ marketDigest: false }) }).suppressedBy).toBe("market_digest");
    expect(decide({ source: "digest", category: null }).inApp).toBe(true);
  });

  it("relevance_threshold silences the push but still records the notification", () => {
    const strict = prefs({ relevanceThreshold: 0.8 });
    const below = decide({ relevance: 0.5, preferences: strict });
    expect(below.push, "a reader at a high threshold used to get an empty inbox and a full lock screen").toBe(false);
    // The row is still written: listUserNotifications filters the inbox on this threshold at READ
    // time, so lowering the bar later must bring the history back rather than find a hole in it.
    expect(below.inApp).toBe(true);
    expect(below.suppressedBy).toBe("relevance_threshold");
    const above = decide({ relevance: 0.85, preferences: strict });
    expect(above.push).toBe(true);
    expect(above.suppressedBy).toBeNull();
  });

  it("email stays off no matter what the reader stored, because no transport exists", () => {
    expect(decide({ preferences: prefs({ emailEnabled: true }) }).email).toBe(false);
  });
});

describe("digest_frequency", () => {
  it("holds nothing back on instant", () => {
    expect(digestDelayMs("instant")).toBe(0);
    expect(decide().deliverAfter.getTime()).toBe(NOON_UTC.getTime());
  });

  it("holds a day back on daily and a week on weekly", () => {
    expect(digestDelayMs("daily")).toBe(86_400_000);
    expect(digestDelayMs("weekly")).toBe(604_800_000);
    expect(decide({ preferences: prefs({ digestFrequency: "daily" }) }).deliverAfter.getTime()).toBe(NOON_UTC.getTime() + 86_400_000);
    expect(decide({ preferences: prefs({ digestFrequency: "weekly" }) }).deliverAfter.getTime()).toBe(NOON_UTC.getTime() + 604_800_000);
  });

  it("does not push something it has deliberately held back", () => {
    // Otherwise "daily digest" would still buzz the phone on every single change, which is the
    // opposite of what choosing a digest asks for.
    expect(decide({ preferences: prefs({ digestFrequency: "daily" }) }).push).toBe(false);
    expect(decide().push).toBe(true);
  });
});

describe("quiet hours", () => {
  const quiet = prefs({ quietHoursStart: "11:00", quietHoursEnd: "13:00" });

  it("recognises a window containing the moment", () => {
    expect(isWithinQuietHours(NOON_UTC, quiet)).toBe(true);
  });

  it("recognises a window that wraps past midnight", () => {
    const overnight = prefs({ quietHoursStart: "22:00", quietHoursEnd: "08:00" });
    expect(isWithinQuietHours(new Date("2026-08-25T23:30:00.000Z"), overnight)).toBe(true);
    expect(isWithinQuietHours(new Date("2026-08-25T03:00:00.000Z"), overnight)).toBe(true);
    expect(isWithinQuietHours(NOON_UTC, overnight)).toBe(false);
  });

  it("defers the inbox row and refuses the push", () => {
    const decision = decide({ preferences: quiet });
    expect(decision.deliverAfter.getTime()).toBeGreaterThan(NOON_UTC.getTime());
    expect(decision.push, "quiet hours silenced the inbox and left the phone buzzing at 3am").toBe(false);
    expect(decision.inApp).toBe(true);
  });

  it("treats an equal start and end as no quiet hours rather than a permanent mute", () => {
    expect(isWithinQuietHours(NOON_UTC, prefs({ quietHoursStart: "09:00", quietHoursEnd: "09:00" }))).toBe(false);
  });

  it("does not mute anyone because their timezone string is unusable", () => {
    expect(isWithinQuietHours(NOON_UTC, prefs({ timezone: "Not/AZone", quietHoursStart: "00:00", quietHoursEnd: "23:59" }))).toBe(false);
  });

  it("respects the timezone rather than the server clock", () => {
    const window = { quietHoursStart: "11:00", quietHoursEnd: "13:00" } as const;
    expect(isWithinQuietHours(NOON_UTC, { ...window, timezone: "UTC" })).toBe(true);
    // Noon UTC is 08:00 in New York, outside the window.
    expect(isWithinQuietHours(NOON_UTC, { ...window, timezone: "America/New_York" })).toBe(false);
  });

  it("takes the longer of the digest and quiet-hours delays, never their sum", () => {
    const both = prefs({ digestFrequency: "daily", quietHoursStart: "11:00", quietHoursEnd: "13:00" });
    expect(decide({ preferences: both }).deliverAfter.getTime()).toBe(NOON_UTC.getTime() + 86_400_000);
  });
});

describe("category mapping", () => {
  it("recognises exactly the categories the collectors emit", () => {
    const emitted: AlertCategory[] = ["price-change", "evidence-change", "batch-change", "availability-change", "shipping-change"];
    for (const category of emitted) expect(asAlertCategory(category)).toBe(category);
  });

  it("does not mistake an unknown category for a known one", () => {
    expect(asAlertCategory("something-new")).toBeNull();
    // Object.prototype keys must not resolve as categories.
    expect(asAlertCategory("constructor")).toBeNull();
    expect(asAlertCategory("toString")).toBeNull();
  });

  it("lets an unmapped category through rather than silently dropping it", () => {
    // A new collector emitting a category nobody mapped should be noisy, not invisible.
    const allOff = prefs({ priceAlerts: false, evidenceAlerts: false, availabilityAlerts: false });
    expect(decideDelivery({ category: asAlertCategory("brand-new"), source: "watchlist", relevance: 1, preferences: allOff, now: NOON_UTC }).inApp).toBe(true);
  });
});
