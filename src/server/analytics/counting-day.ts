// What "a day" means, defined once.
//
// Two things independently decide which day a visit belongs to: the visitor hash in JavaScript
// (which salts with a date so nobody can be followed across days) and the daily SQL buckets that
// draw the charts. They used to agree only by accident — both happened to use UTC. Nothing enforced
// it, so moving either one would have silently made the reader count and the daily chart describe
// different things.
//
// Two consumers, one definition, and an invariant test that fails if they ever drift apart.
//
// The boundary is 04:00 America/New_York rather than midnight UTC. Midnight UTC is 8pm Eastern —
// the middle of the evening — so a single session spanning it produced two "readers" during the
// busiest hours of the day. 4am is chosen because essentially nobody is mid-session then, so the
// rotation almost never splits one person's reading in half.
//
// The zone is fixed rather than per-reader on purpose: deriving it from the request would need a
// timezone from the browser, which is a fingerprinting signal we deliberately do not collect.

export const COUNTING_TIMEZONE = "America/New_York";

/** Local hour at which a new counting day begins. */
export const COUNTING_DAY_START_HOUR = 4;

/**
 * The counting day an instant belongs to, as YYYY-MM-DD.
 *
 * Uses Intl rather than a fixed offset so daylight saving is handled: the boundary is 04:00 local
 * in both EDT (09:00 UTC) and EST (08:00 UTC).
 */
export function countingDay(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COUNTING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: string) => parts.find(p => p.type === type)!.value;

  const localDate = `${part("year")}-${part("month")}-${part("day")}`;
  if (Number(part("hour")) >= COUNTING_DAY_START_HOUR) return localDate;

  // Before the roll-over the reader is still finishing yesterday. Step back one calendar day using
  // midday UTC as the anchor, which cannot be pushed into an adjacent day by any offset.
  const previous = new Date(`${localDate}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

/**
 * The same definition as a SQL expression, for grouping rows into daily buckets.
 *
 * `AT TIME ZONE` converts the stored timestamptz to local wall-clock time, and subtracting the
 * start hour shifts anything before the boundary back onto the previous day — exactly what
 * countingDay does in JavaScript.
 *
 * `column` is interpolated, so pass a column name or a bound placeholder, never user input.
 */
export function countingDaySql(column: string): string {
  return `TO_CHAR((${column} AT TIME ZONE '${COUNTING_TIMEZONE}') - INTERVAL '${COUNTING_DAY_START_HOUR} hours', 'YYYY-MM-DD')`;
}
