// Time-zone truth for the account preferences, shared by the API validator and the account UI.
//
// WHY THIS EXISTS: `timezone` used to be a free-text input. Whatever the reader typed was stored,
// and `localMinuteOfDay` in src/server/notifications/policy.ts catches the RangeError an unknown
// zone throws and returns null — which `isWithinQuietHours` reads as "not in quiet hours". So a
// typo did not fail loudly, it silently deleted the reader's quiet hours and started pushing them
// at 03:00. The field saved, showed the new value, and stopped working.
//
// The check is deliberately NOT a hardcoded list. The IANA database gains, renames and retires
// zones, and a literal list committed here would drift from whatever ICU the deployed Node ships:
// it would reject zones the runtime handles and, worse, accept zones it does not. The only
// authority that matters is the same constructor `localMinuteOfDay` will later call, so ask it.
//
// No database or request imports live here on purpose: the account UI is a client component and
// must be able to import these two functions.

/** Zones offered when the runtime cannot enumerate its own — each still checked against ICU. */
const FALLBACK_TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Asia/Jerusalem",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/**
 * Whether the runtime actually accepts this string as a time zone.
 *
 * `Intl.DateTimeFormat` throws a RangeError for an unknown zone, and that constructor is the exact
 * thing the quiet-hours code depends on, so a value that passes here cannot silently disable quiet
 * hours later. "New York", "GMT+5" and "" all throw; "America/New_York", "US/Eastern" and "UTC"
 * do not.
 */
export function isSupportedTimeZone(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every zone this runtime knows, for building a picker that cannot produce an invalid value.
 *
 * `Intl.supportedValuesOf` is absent on older engines and on trimmed ICU builds, so its absence is
 * handled rather than assumed: the fallback list is itself filtered through `isSupportedTimeZone`,
 * because offering an option the runtime would reject would re-create the bug the picker exists to
 * prevent.
 */
export function listSupportedTimeZones(): string[] {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  if (typeof supportedValuesOf === "function") {
    try {
      const zones = supportedValuesOf("timeZone").filter(isSupportedTimeZone);
      // ICU enumerates canonical zones only, and on this runtime that list does NOT contain "UTC"
      // even though every runtime accepts it. Leaving it out would mean the picker could not offer
      // the one zone with no politics in it, so it is added back when absent.
      if (zones.length > 0) return zones.includes("UTC") ? zones : ["UTC", ...zones];
    } catch {
      // Fall through to the curated list below.
    }
  }
  return FALLBACK_TIME_ZONES.filter(isSupportedTimeZone);
}
