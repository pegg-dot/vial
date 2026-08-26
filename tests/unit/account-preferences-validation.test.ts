import { describe, expect, it } from "vitest";
import {
  clockTimeSchema,
  digestFrequencySchema,
  notificationPreferencesPatchSchema,
  relevanceThresholdSchema,
  timeZoneSchema,
} from "@/server/account/schemas";
import { isSupportedTimeZone, listSupportedTimeZones } from "@/server/account/timezone";

/**
 * PATCH /api/v1/account/preferences used to pass `await req.json()` straight into the repository.
 * Two values in that body are load-bearing and both could be poisoned by the account owner's own
 * keyboard, silently and unrecoverably:
 *
 *   - relevanceThreshold "high" became NaN, which NUMERIC(5,4) stores and Postgres orders above
 *     every numeric — so `relevance_score >= relevance_threshold` matched nothing and the inbox was
 *     empty forever, while the policy's `relevance >= NaN` held push false forever.
 *   - timezone "New York" made Intl throw, which the quiet-hours code reads as "not quiet" — so
 *     quiet hours stopped existing and push resumed at 03:00.
 *
 * These assertions are on the schema object the route actually imports, not a copy of it.
 */

/** The body the account UI posts, with every other field already valid. */
const VALID_BODY = {
  inAppEnabled: true,
  emailEnabled: false,
  priceAlerts: true,
  evidenceAlerts: true,
  availabilityAlerts: true,
  orderAlerts: true,
  savedSearchAlerts: true,
  followedEntityAlerts: true,
  marketDigest: true,
  digestFrequency: "instant",
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  timezone: "America/New_York",
  relevanceThreshold: 0.45,
};

const body = (overrides: Record<string, unknown>) => notificationPreferencesPatchSchema.safeParse({ ...VALID_BODY, ...overrides });

describe("notification preference validation", () => {
  it("accepts the body the account UI posts", () => {
    const parsed = notificationPreferencesPatchSchema.safeParse(VALID_BODY);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.relevanceThreshold).toBe(0.45);
    expect(parsed.success && parsed.data.timezone).toBe("America/New_York");
  });

  describe("relevanceThreshold", () => {
    it("rejects NaN", () => {
      expect(relevanceThresholdSchema.safeParse(NaN).success).toBe(false);
      expect(body({ relevanceThreshold: NaN }).success).toBe(false);
      // The exact proven payload: a string that Number() turns into NaN downstream.
      expect(body({ relevanceThreshold: "high" }).success).toBe(false);
      expect(Number("high")).toBeNaN();
    });

    it("rejects Infinity and -Infinity", () => {
      expect(relevanceThresholdSchema.safeParse(Infinity).success).toBe(false);
      expect(relevanceThresholdSchema.safeParse(-Infinity).success).toBe(false);
      expect(body({ relevanceThreshold: Infinity }).success).toBe(false);
      expect(body({ relevanceThreshold: -Infinity }).success).toBe(false);
    });

    it("rejects strings, including strings that look like numbers", () => {
      for (const value of ["high", "0.6", "", " "]) {
        expect(relevanceThresholdSchema.safeParse(value).success, `string ${JSON.stringify(value)}`).toBe(false);
        expect(body({ relevanceThreshold: value }).success, `body ${JSON.stringify(value)}`).toBe(false);
      }
    });

    it("rejects other non-numbers a JSON body can carry", () => {
      for (const value of [null, true, [], {}]) {
        expect(relevanceThresholdSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
      }
    });

    it("rejects a value above 1", () => {
      expect(relevanceThresholdSchema.safeParse(1.5).success).toBe(false);
      // 42 would not even fit NUMERIC(5,4); it must never reach the INSERT.
      expect(body({ relevanceThreshold: 42 }).success).toBe(false);
    });

    it("rejects a negative value", () => {
      expect(relevanceThresholdSchema.safeParse(-0.2).success).toBe(false);
      expect(body({ relevanceThreshold: -1 }).success).toBe(false);
    });

    it("accepts a valid threshold, including both ends of the range", () => {
      for (const value of [0, 0.05, 0.45, 0.9999, 1]) {
        expect(relevanceThresholdSchema.safeParse(value).success, String(value)).toBe(true);
        expect(body({ relevanceThreshold: value }).success, String(value)).toBe(true);
      }
    });

    it("reports the offending field so the API can return it", () => {
      const parsed = body({ relevanceThreshold: "high" });
      expect(parsed.success).toBe(false);
      expect(parsed.success === false && parsed.error.flatten().fieldErrors.relevanceThreshold).toBeTruthy();
    });
  });

  describe("timezone", () => {
    it("rejects the values a reader actually types", () => {
      for (const value of ["New York", "GMT+5", "", "  ", "EST5", "Mars/Phobos"]) {
        expect(timeZoneSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
        expect(body({ timezone: value }).success, `body ${JSON.stringify(value)}`).toBe(false);
      }
    });

    it("accepts real IANA zones", () => {
      for (const value of ["America/New_York", "UTC", "Europe/London", "Asia/Tokyo"]) {
        expect(timeZoneSchema.safeParse(value).success, value).toBe(true);
        expect(body({ timezone: value }).success, `body ${value}`).toBe(true);
      }
    });

    it("agrees with the runtime that quiet hours actually depend on", () => {
      // The schema is only worth anything if it accepts exactly what Intl accepts — a hardcoded
      // list would drift from ICU in both directions. Assert the two agree on the same inputs.
      for (const value of ["America/New_York", "UTC", "US/Eastern", "New York", "GMT+5", ""]) {
        let intlAccepts = true;
        try {
          Intl.DateTimeFormat(undefined, { timeZone: value });
        } catch {
          intlAccepts = false;
        }
        expect(timeZoneSchema.safeParse(value).success, `schema vs ICU for ${JSON.stringify(value)}`).toBe(intlAccepts);
        expect(isSupportedTimeZone(value), `helper vs ICU for ${JSON.stringify(value)}`).toBe(intlAccepts);
      }
      // The failure mode being prevented: an unknown zone throws, which the quiet-hours code
      // swallows into "no quiet hours".
      expect(() => Intl.DateTimeFormat(undefined, { timeZone: "New York" })).toThrow(RangeError);
    });

    it("stores the trimmed value rather than one Intl would reject later", () => {
      const parsed = timeZoneSchema.safeParse("  America/Chicago  ");
      expect(parsed.success && parsed.data).toBe("America/Chicago");
    });

    it("offers the account picker only values the schema accepts", () => {
      // The picker is the other half of the fix: every option it can emit must survive this schema,
      // otherwise the control could still produce an unsaveable value.
      const zones = listSupportedTimeZones();
      expect(zones.length).toBeGreaterThan(20);
      expect(zones).toContain("UTC");
      expect(zones.every((zone) => timeZoneSchema.safeParse(zone).success)).toBe(true);
      expect(zones).not.toContain("New York");
    });
  });

  describe("quiet hours", () => {
    it("rejects anything that is not zero-padded 24-hour HH:MM", () => {
      for (const value of ["9:5", "25:00", "22:60", "22:00:00", "2200", "", "10:00 PM", "abc"]) {
        expect(clockTimeSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
        expect(body({ quietHoursStart: value }).success, `start ${JSON.stringify(value)}`).toBe(false);
        expect(body({ quietHoursEnd: value }).success, `end ${JSON.stringify(value)}`).toBe(false);
      }
    });

    it("accepts the values <input type=\"time\"> emits", () => {
      for (const value of ["00:00", "08:00", "22:00", "23:59", "09:05"]) {
        expect(clockTimeSchema.safeParse(value).success, value).toBe(true);
      }
    });
  });

  describe("digestFrequency", () => {
    it("rejects an unknown frequency", () => {
      for (const value of ["hourly", "INSTANT", "", "monthly", 1]) {
        expect(digestFrequencySchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
        expect(body({ digestFrequency: value }).success, `body ${JSON.stringify(value)}`).toBe(false);
      }
    });

    it("accepts the three the reader can choose", () => {
      for (const value of ["instant", "daily", "weekly"]) {
        expect(digestFrequencySchema.safeParse(value).success, value).toBe(true);
      }
    });
  });

  it("drops unknown keys instead of forwarding them to the INSERT", () => {
    const parsed = notificationPreferencesPatchSchema.safeParse({ ...VALID_BODY, userId: "user:someone-else", relevance_threshold: 9 });
    expect(parsed.success).toBe(true);
    expect(parsed.success && Object.keys(parsed.data)).not.toContain("userId");
    expect(parsed.success && Object.keys(parsed.data)).not.toContain("relevance_threshold");
  });

  it("rejects a body that is not an object at all", () => {
    for (const value of [null, undefined, "", 3, []]) {
      expect(notificationPreferencesPatchSchema.safeParse(value).success, JSON.stringify(value ?? null)).toBe(false);
    }
  });
});
