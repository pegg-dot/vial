import { z } from "zod";
import { isSupportedTimeZone } from "@/server/account/timezone";

// The request shape for PATCH /api/v1/account/preferences.
//
// WHY THIS EXISTS: the route used to hand `await req.json()` straight to the repository, which did
// `Number(input.relevanceThreshold ?? 0.45)` and `String(input.timezone || "America/New_York")`.
// Two proven, silent, self-inflicted outages came out of that:
//
//   1. `{"relevanceThreshold":"high"}` becomes NaN. NUMERIC(5,4) accepts 'NaN', Postgres orders NaN
//      ABOVE every other numeric, and `listUserNotifications` filters on
//      `relevance_score >= COALESCE(p.relevance_threshold,0)` — so the inbox returns zero rows
//      forever and `relevance >= NaN` keeps push false forever. The slider then renders "NaN%".
//   2. A timezone typo ("New York", "GMT+5", "") makes `localMinuteOfDay` throw a RangeError, which
//      it catches and reports as "no local time", which `isWithinQuietHours` reads as "not quiet".
//      Quiet hours stop existing and the reader gets pushed at 03:00.
//
// Neither failed loudly, both persisted, and neither is recoverable from the UI. So the values are
// checked here, at the boundary, before anything can be written.
//
// It lives outside the route module because a Next route file may only export request handlers and
// the route config fields — a schema exported from there would be a build error — and because the
// tests must validate against the same object the route uses, not a copy of it.

/** Shared so the route, the tests and the UI all mean the same three values. */
export const DIGEST_FREQUENCIES = ["instant", "daily", "weekly"] as const;

/** 24-hour wall clock, zero-padded: what `<input type="time">` emits and what `minuteOfDay` parses. */
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The alert relevance floor: a finite number in [0, 1].
 *
 * The three conditions are written out rather than leaning on `z.number().min(0).max(1)` alone,
 * because the NaN case is the whole reason this file exists and it must not rest on a library
 * default: zod 3's `z.number()` accepted Infinity, zod 4's does not, and this column must not
 * silently become poisonable again on an upgrade.
 *
 * Measured by mutation, the range clause is the only one that fails alone — deleting it accepts
 * -0.2 and 1.5. `z.number()` and the finiteness clause are REDUNDANT with each other under zod
 * 4.4.3: removing either one on its own changes nothing, because the survivor still rejects NaN,
 * ±Infinity and every string. Removing BOTH accepts "0.6", `true` and `null`, which is the positive
 * control that the pair does real work. That redundancy is deliberate, not an oversight.
 */
export const relevanceThresholdSchema = z
  .number({ error: "relevanceThreshold must be a number between 0 and 1" })
  .refine((value) => Number.isFinite(value), { error: "relevanceThreshold must be a finite number, not NaN or Infinity" })
  .refine((value) => value >= 0 && value <= 1, { error: "relevanceThreshold must be between 0 and 1 inclusive" });

/** Quiet-hours boundary. "9:5", "25:00" and "22:00:00" are not times this system can read. */
export const clockTimeSchema = z
  .string()
  .trim()
  .regex(CLOCK_TIME, { error: "Quiet hours must be a 24-hour HH:MM time, for example 22:00" });

/**
 * A zone the runtime will actually accept.
 *
 * Checked against ICU rather than a committed list — see src/server/account/timezone.ts for why a
 * list would drift. Trimming first means " America/New_York " is accepted and STORED trimmed,
 * rather than being accepted and then throwing inside the quiet-hours check.
 */
export const timeZoneSchema = z
  .string()
  .trim()
  .refine(isSupportedTimeZone, { error: "Unknown timezone. Use an IANA zone such as America/New_York or UTC" });

export const digestFrequencySchema = z.enum(DIGEST_FREQUENCIES, { error: `digestFrequency must be one of ${DIGEST_FREQUENCIES.join(", ")}` });

/**
 * Every field is optional because this endpoint has always accepted a partial body and the UI
 * posts the whole object; the schema's job is to reject values that are WRONG, not to change which
 * bodies are accepted. Unknown keys are stripped by zod, so only these fields ever reach the
 * repository.
 */
export const notificationPreferencesPatchSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  priceAlerts: z.boolean().optional(),
  evidenceAlerts: z.boolean().optional(),
  availabilityAlerts: z.boolean().optional(),
  orderAlerts: z.boolean().optional(),
  savedSearchAlerts: z.boolean().optional(),
  followedEntityAlerts: z.boolean().optional(),
  marketDigest: z.boolean().optional(),
  digestFrequency: digestFrequencySchema.optional(),
  quietHoursStart: clockTimeSchema.optional(),
  quietHoursEnd: clockTimeSchema.optional(),
  timezone: timeZoneSchema.optional(),
  relevanceThreshold: relevanceThresholdSchema.optional(),
});

export type NotificationPreferencesPatch = z.output<typeof notificationPreferencesPatchSchema>;
