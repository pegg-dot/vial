// A listing's price trend, computed from its dated observations — and the sentence that says
// exactly what is known (spec docs/superpowers/specs/2026-08-29-vial-price-truth-design.md, D6/§5).
//
// Pure: no database, no clock of its own. The rule is the same one recomputeCompoundPriceChanges
// applies in SQL for compounds; keep them in step. Nothing here recommends anything — prices are
// observed, never projected, and a change is shown only when it is earned.

export interface PricePoint { day: string; price: number | null; available: boolean }

export const TREND_WINDOW_DAYS = 30;
export const TREND_BASELINE_TOLERANCE_DAYS = 7;
export const TREND_FRESH_DAYS = 2;
export const TREND_MIN_SPAN_DAYS = 14;
export const TREND_STALE_AFTER_DAYS = 3;

interface Common { checks: number; staleDays: number; lastCheck: PricePoint }
export type ListingTrend =
  | (Common & { state: "none" })
  | (Common & { state: "insufficient"; first: PricePoint; latest: { day: string; price: number } })
  | (Common & { state: "trending"; pct: number; base: { day: string; price: number }; latest: { day: string; price: number }; window: number })
  | (Common & { state: "unavailable"; lastAvailable: { day: string; price: number } | null });

const DAY_MS = 86_400_000;
const dayIndex = (day: string) => Math.floor(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY_MS);
const todayIndex = (now: Date) => Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / DAY_MS);

/**
 * @param points every observation for ONE listing, oldest first (not just change points — the
 *   baseline rule needs to know the price was actually checked near the window start)
 * @param checks how many checks the copy should cite; defaults to the number of points
 */
export function computeListingTrend(points: PricePoint[], now: Date = new Date(), checks = points.length): ListingTrend {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const latest = sorted[sorted.length - 1];
  const today = todayIndex(now);
  const staleDays = latest ? Math.max(0, today - dayIndex(latest.day)) : 0;
  const priced = sorted.filter((p): p is PricePoint & { price: number } => p.available && p.price !== null && p.price > 0);
  const common: Common = { checks, staleDays, lastCheck: latest ?? { day: "", price: null, available: false } };

  if (!latest) return { ...common, state: "none" };
  if (!latest.available || latest.price === null) {
    const last = priced[priced.length - 1];
    return { ...common, state: "unavailable", lastAvailable: last ? { day: last.day, price: last.price } : null };
  }
  const first = sorted[0];
  const latestPriced = { day: latest.day, price: latest.price };
  const distinctDays = new Set(priced.map((p) => p.day)).size;
  if (distinctDays < 2) return { ...common, state: "none" };

  const windowStart = today - TREND_WINDOW_DAYS;
  const base = [...priced].reverse().find((p) => { const d = dayIndex(p.day); return d <= windowStart && d >= windowStart - TREND_BASELINE_TOLERANCE_DAYS; });
  const fresh = staleDays <= TREND_FRESH_DAYS;
  const span = base ? dayIndex(latest.day) - dayIndex(base.day) : 0;
  if (!base || !fresh || span < TREND_MIN_SPAN_DAYS) return { ...common, state: "insufficient", first, latest: latestPriced };
  const pct = ((latest.price - base.price) / base.price) * 100;
  return { ...common, state: "trending", pct, base: { day: base.day, price: base.price }, latest: latestPriced, window: TREND_WINDOW_DAYS };
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatObservedPrice = (value: number) => money.format(value);
export function formatObservedDay(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export function formatPct(pct: number) {
  const sign = pct < 0 ? "−" : pct > 0 ? "+" : "";
  return `${sign}${Math.abs(pct).toFixed(1)} %`;
}

/** The one sentence a reader gets — the same sentence the chart's text alternative carries. */
export function describeListingTrend(trend: ListingTrend): string {
  const stale = trend.staleDays > TREND_STALE_AFTER_DAYS ? ` Last checked ${trend.staleDays} days ago.` : "";
  switch (trend.state) {
    case "none":
      return trend.lastCheck.day
        ? `Price checked once, on ${formatObservedDay(trend.lastCheck.day)}. No trend yet — a change needs checks on at least two different days.${stale}`
        : "No price checks on record yet.";
    case "insufficient":
      return `${trend.checks} checks since ${formatObservedDay(trend.first.day)}. Too short a span for a ${TREND_WINDOW_DAYS}-day change. Latest ${formatObservedPrice(trend.latest.price)} on ${formatObservedDay(trend.latest.day)}.${stale}`;
    case "trending":
      return `${formatPct(trend.pct)} over ${trend.window} days · ${trend.checks} checks · ${formatObservedPrice(trend.base.price)} on ${formatObservedDay(trend.base.day)} → ${formatObservedPrice(trend.latest.price)} on ${formatObservedDay(trend.latest.day)}. Vendor list price before shipping or discounts. Observed, not projected.${stale}`;
    case "unavailable":
      return `Not available when last checked (${formatObservedDay(trend.lastCheck.day)}).${trend.lastAvailable ? ` Last observed price ${formatObservedPrice(trend.lastAvailable.price)} on ${formatObservedDay(trend.lastAvailable.day)}.` : ""}${stale}`;
  }
}

export interface CompoundPriceBasis { k: number; n: number; window: number; asOf: string; medianPct: number | null }

/** What a compound's Δ rests on, or why there is none. */
export function describeCompoundBasis(basis: CompoundPriceBasis | null | undefined): string {
  if (!basis || basis.n === 0) return "No price checks on record for this compound yet.";
  if (basis.medianPct === null) return `Not enough listings with ${basis.window} days of checks to summarise a change — ${basis.k} of ${basis.n} qualify so far.`;
  return `Median of ${basis.k} listings' ${basis.window}-day changes; ${basis.n - basis.k} excluded for insufficient history.`;
}
