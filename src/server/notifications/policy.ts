// The one place that decides what a notification is allowed to do.
//
// WHY THIS EXISTS: /account rendered fourteen notification controls and SEVEN of them were read by
// nothing at all — in_app_enabled, email_enabled, evidence_alerts, order_alerts, digest_frequency,
// saved_search_alerts, market_digest. price_alerts was SELECTed and then dropped on the floor.
// Every one of them saved, showed the new value, and changed nothing. A setting that persists but
// does nothing is worse than no setting: the reader sees it stick and assumes it worked.
//
// The cause was structural, not a run of oversights. `syncWatchlistNotifications` decided delivery
// inline, so each new preference needed its own bespoke branch inside a 40-line function, and
// nobody ever added one. This module is that decision, made once, as pure functions — so a
// preference binds by appearing here, and a test can prove that it does.
//
// It deliberately knows nothing about the database or the request. Everything it needs arrives as
// arguments, so every rule below is directly testable without a fixture.

/** Categories `createAlert` actually emits. See src/server/intelligence/cascade.ts and scanner.ts. */
export type AlertCategory = "price-change" | "evidence-change" | "batch-change" | "availability-change" | "shipping-change";

export type DigestFrequency = "instant" | "daily" | "weekly";

export interface NotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  priceAlerts: boolean;
  evidenceAlerts: boolean;
  availabilityAlerts: boolean;
  orderAlerts: boolean;
  savedSearchAlerts: boolean;
  followedEntityAlerts: boolean;
  marketDigest: boolean;
  digestFrequency: DigestFrequency;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  relevanceThreshold: number;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
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

/**
 * Which toggle governs which alert category.
 *
 * Total by construction: the Record is keyed on AlertCategory, so adding a category to the union
 * without deciding who governs it is a type error rather than a silently ungoverned alert.
 */
const CATEGORY_TOGGLE: Record<AlertCategory, keyof NotificationPreferences> = {
  "price-change": "priceAlerts",
  "evidence-change": "evidenceAlerts",
  // A batch losing its COA linkage is an evidence event to a reader, whatever we call it internally.
  "batch-change": "evidenceAlerts",
  "availability-change": "availabilityAlerts",
  "shipping-change": "availabilityAlerts",
};

/** Categories arrive from collectors as free strings; an unrecognised one must not be mistaken for a known one. */
export function asAlertCategory(raw: string): AlertCategory | null {
  return Object.prototype.hasOwnProperty.call(CATEGORY_TOGGLE, raw) ? (raw as AlertCategory) : null;
}

export type NotificationSource = "watchlist" | "follow" | "saved-search" | "order" | "digest";

export interface DeliveryDecision {
  /** Write a row to the inbox. */
  inApp: boolean;
  /** Send a web-push now. Never true when the inbox row is deferred into the future. */
  push: boolean;
  /** Send an email. Always false today — see the note on the email branch below. */
  email: boolean;
  /** When the inbox row becomes visible. Quiet hours and the digest window both push this out. */
  deliverAfter: Date;
  /** Which preference suppressed it, for logging and so the UI can explain itself. */
  suppressedBy: string | null;
}

function minuteOfDay(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : 0;
}

/** Local wall-clock minute-of-day in the reader's timezone, or null if the zone is unusable. */
export function localMinuteOfDay(now: Date, timezone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? NaN);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? NaN);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
  } catch {
    // An invalid timezone string must not silence someone's alerts. Treat it as "no quiet hours".
    return null;
  }
}

export function isWithinQuietHours(now: Date, preferences: Pick<NotificationPreferences, "quietHoursStart" | "quietHoursEnd" | "timezone">) {
  const current = localMinuteOfDay(now, preferences.timezone);
  if (current === null) return false;
  const start = minuteOfDay(preferences.quietHoursStart);
  const end = minuteOfDay(preferences.quietHoursEnd);
  // start === end is a zero-length window, not a 24-hour one — otherwise a mis-set pair would mute
  // someone permanently with no clue why.
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function minutesUntilQuietEnds(now: Date, preferences: Pick<NotificationPreferences, "quietHoursStart" | "quietHoursEnd" | "timezone">) {
  const current = localMinuteOfDay(now, preferences.timezone);
  if (current === null) return 0;
  const start = minuteOfDay(preferences.quietHoursStart);
  const end = minuteOfDay(preferences.quietHoursEnd);
  if (start < end) return Math.max(1, end - current);
  return current < end ? Math.max(1, end - current) : Math.max(1, 24 * 60 - current + end);
}

/**
 * How long a digest holds a notification back.
 *
 * "Daily" and "weekly" were selectable and did nothing, so a reader asking for one summary a week
 * got one alert per change. Batching is expressed as a delay on `deliver_after` rather than as a
 * separate digest record: the inbox already sorts and groups, so a delayed row is simply one the
 * reader finds waiting alongside its neighbours.
 */
export function digestDelayMs(frequency: DigestFrequency): number {
  if (frequency === "daily") return 24 * 60 * 60 * 1000;
  if (frequency === "weekly") return 7 * 24 * 60 * 60 * 1000;
  return 0;
}

export function decideDelivery(input: {
  category: AlertCategory | null;
  source: NotificationSource;
  relevance: number;
  preferences: NotificationPreferences;
  now: Date;
}): DeliveryDecision {
  const { preferences: prefs, now } = input;
  const blocked = (reason: string): DeliveryDecision => ({ inApp: false, push: false, email: false, deliverAfter: now, suppressedBy: reason });

  // Source gates first: they express "I never want to hear about this KIND of thing at all".
  if (input.source === "follow" && !prefs.followedEntityAlerts) return blocked("followed_entity_alerts");
  if (input.source === "saved-search" && !prefs.savedSearchAlerts) return blocked("saved_search_alerts");
  if (input.source === "order" && !prefs.orderAlerts) return blocked("order_alerts");
  if (input.source === "digest" && !prefs.marketDigest) return blocked("market_digest");

  // Then the category gate. An unrecognised category is allowed THROUGH rather than dropped: a new
  // collector emitting a category nobody has mapped yet should be noisy, not invisible.
  if (input.category) {
    const toggle = CATEGORY_TOGGLE[input.category];
    if (!prefs[toggle]) return blocked(toggle);
  }

  // A digest is a preference about MARKET NEWS. Applying it to a transactional event meant a
  // reader who chose "weekly" made their own shipment notification invisible for seven days and
  // never got the push — an order update is not something they asked to have batched.
  const digestMs = input.source === "order" ? 0 : digestDelayMs(prefs.digestFrequency);
  const quietMs = isWithinQuietHours(now, prefs) ? minutesUntilQuietEnds(now, prefs) * 60_000 : 0;
  const deliverAfter = new Date(now.getTime() + Math.max(digestMs, quietMs));
  const dueNow = deliverAfter.getTime() <= now.getTime();

  // The relevance floor gates PUSH but never the stored row.
  //
  // `listUserNotifications` already filters the inbox on this threshold at READ time, and that is
  // the better place for it: raising the bar hides things, and lowering it again brings them back.
  // Refusing to WRITE below-threshold rows would make the setting destructive — a month at 90%
  // would leave a permanent hole in the history that no later change could recover.
  //
  // Push is different. There is no read-time filter on a notification that has already buzzed a
  // phone, which is why a reader at 100% used to get an empty inbox and a full lock screen.
  const meetsRelevance = input.relevance >= prefs.relevanceThreshold;

  return {
    inApp: prefs.inAppEnabled,
    // Push goes only when the notification is due NOW; anything held back by quiet hours or a
    // digest waits, and a later sweep pushes it once it comes due (see `pushed_at`).
    //
    // It also requires the in-app switch, because that is what the control says: "Everything below
    // still needs this on." Reporting push:true under inApp:false would leave the decision object
    // describing a delivery that the caller then has to know to suppress.
    push: prefs.inAppEnabled && dueNow && meetsRelevance,
    // No mail transport exists in this application: no provider dependency, no credentials, no send
    // path anywhere in src/. The toggle stored a value that could never do anything. Until a
    // transport is chosen this stays false whatever the reader set, and the UI says so.
    email: false,
    deliverAfter,
    suppressedBy: !prefs.inAppEnabled ? "in_app_enabled" : !meetsRelevance ? "relevance_threshold" : null,
  };
}

/** True when every channel that could have carried this is off. */
export function isFullySuppressed(decision: DeliveryDecision) {
  return !decision.inApp && !decision.push && !decision.email;
}

export const EMAIL_UNAVAILABLE_REASON = "Email delivery isn't configured on this deployment, so this stays off.";
