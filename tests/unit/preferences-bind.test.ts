import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  decideDelivery,
  type AlertCategory,
  type NotificationPreferences,
  type NotificationSource,
} from "@/server/notifications/policy";

// A standing guard against the defect that produced this file.
//
// /account rendered fourteen notification controls and SEVEN of them were read by no code:
// in_app_enabled, email_enabled, evidence_alerts, order_alerts, digest_frequency,
// saved_search_alerts, market_digest. price_alerts was SELECTed and dropped on the floor.
// personalization_enabled was dead on the other table. Each one saved, showed its new value, and
// did nothing — and every one of them was found by a person reading code, which does not scale and
// would not have survived the next feature.
//
// This is the same move `cron-routes-reachable.test.ts` makes for the perimeter allowlist: a
// comment could not stop that bug happening twice, so a test reads the config and fails.
//
// WHY IT PROVES BEHAVIOUR RATHER THAN GREPPING. The obvious version of this test looks for the
// column name somewhere outside the form. That version passes for `email_enabled` right now —
// the identifier appears in the policy module's interface, its defaults, and a comment, while
// nothing reads the value. A mention is not a binding. So each column below must come with a
// FLIP that demonstrably changes what the system decides.

const SCHEMA_FILES = ["src/server/db/consumer-intelligence-schema.ts", "src/server/db/foundation-schema.ts"];

/** Columns that are structure, not preference. */
const STRUCTURAL = new Set(["user_id", "created_at", "updated_at"]);

function schemaSql() {
  return SCHEMA_FILES.map((file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8")).join("\n");
}

/** Every column a table holds, from both its CREATE TABLE and every later ADD COLUMN. */
export function columnsOf(table: string, sql: string): string[] {
  const found = new Set<string>();
  const create =
    new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)\\n?\\);`, "i").exec(sql) ??
    new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\(([^;]*?)\\);`, "i").exec(sql);
  if (create) {
    for (const line of create[1].split(",")) {
      const m = /^\s*([a-z_]+)\s+[A-Z]/.exec(line);
      if (m && !["PRIMARY", "UNIQUE", "FOREIGN", "CONSTRAINT"].includes(m[1].toUpperCase())) found.add(m[1]);
    }
  }
  for (const m of sql.matchAll(new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ([a-z_]+)`, "gi"))) found.add(m[1]);
  return [...found].filter((c) => !STRUCTURAL.has(c));
}

const NOON_UTC = new Date("2026-08-25T12:00:00.000Z");

/** A neutral profile: quiet hours parked away from noon, nothing else suppressing. */
function base(): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, timezone: "UTC", quietHoursStart: "23:00", quietHoursEnd: "23:30", relevanceThreshold: 0 };
}

interface Binding {
  /**
   * Applied to BOTH sides before the flip. Some preferences are only observable against a
   * particular starting profile — a timezone changes nothing unless a quiet-hours window already
   * exists for it to be interpreted in.
   */
  baseline?: (p: NotificationPreferences) => NotificationPreferences;
  /** Change the stored value the way a reader would. */
  flip: (p: NotificationPreferences) => NotificationPreferences;
  /** The kind of notification this preference governs, if it only governs one. */
  category?: AlertCategory | null;
  source?: NotificationSource;
  relevance?: number;
}

/**
 * One entry per column, each demonstrating the value changes a decision.
 *
 * Adding a column to the schema without adding an entry here fails the suite. Removing a binding
 * from the policy also fails it, because the flip stops making a difference.
 */
const NOTIFICATION_BINDINGS: Record<string, Binding> = {
  in_app_enabled: { flip: (p) => ({ ...p, inAppEnabled: false }) },
  price_alerts: { flip: (p) => ({ ...p, priceAlerts: false }), category: "price-change" },
  evidence_alerts: { flip: (p) => ({ ...p, evidenceAlerts: false }), category: "evidence-change" },
  availability_alerts: { flip: (p) => ({ ...p, availabilityAlerts: false }), category: "availability-change" },
  order_alerts: { flip: (p) => ({ ...p, orderAlerts: false }), category: null, source: "order" },
  saved_search_alerts: { flip: (p) => ({ ...p, savedSearchAlerts: false }), category: null, source: "saved-search" },
  followed_entity_alerts: { flip: (p) => ({ ...p, followedEntityAlerts: false }), source: "follow" },
  market_digest: { flip: (p) => ({ ...p, marketDigest: false }), category: null, source: "digest" },
  digest_frequency: { flip: (p) => ({ ...p, digestFrequency: "weekly" }) },
  quiet_hours_start: { flip: (p) => ({ ...p, quietHoursStart: "11:00", quietHoursEnd: "13:00" }) },
  quiet_hours_end: { flip: (p) => ({ ...p, quietHoursStart: "11:00", quietHoursEnd: "13:00" }) },
  // Same window, different zone. Noon UTC is inside 11:00-13:00 in UTC and 08:00 — outside it —
  // in New York, so the zone alone decides whether this is quiet.
  timezone: {
    baseline: (p) => ({ ...p, quietHoursStart: "11:00", quietHoursEnd: "13:00" }),
    flip: (p) => ({ ...p, timezone: "America/New_York" }),
  },
  relevance_threshold: { flip: (p) => ({ ...p, relevanceThreshold: 0.99 }), relevance: 0.5 },
};

/**
 * Columns that deliberately do nothing, each with the reason.
 *
 * An exception has to be written down and ASSERTED — the test below requires that flipping one
 * really does change nothing. So if someone builds the missing capability, this fails and tells
 * them to move the column into the bindings above rather than leaving it silently half-wired.
 */
const NOTIFICATION_UNBOUND: Record<string, { reason: string; flip: (p: NotificationPreferences) => NotificationPreferences }> = {
  email_enabled: {
    reason: "No mail transport exists in this repository — no provider dependency, no credentials, no send path. The control is rendered disabled with this reason, and the policy returns email:false whatever is stored.",
    flip: (p) => ({ ...p, emailEnabled: true }),
  },
};

/**
 * What the system actually DOES, with the diagnostic label stripped out.
 *
 * Comparing whole decisions let a mutation slip through: un-gating push on the relevance threshold
 * still flipped `suppressedBy`, so the objects differed and the test stayed green while the phone
 * buzzed anyway. A preference has to change a channel or a delivery time, not just how the decision
 * describes itself.
 */
function effect(preferences: NotificationPreferences, binding: Binding) {
  const d = decide(preferences, binding);
  return JSON.stringify({ inApp: d.inApp, push: d.push, email: d.email, deliverAfter: d.deliverAfter.toISOString() });
}

function decide(preferences: NotificationPreferences, binding: Binding) {
  return decideDelivery({
    category: binding.category === undefined ? "price-change" : binding.category,
    source: binding.source ?? "watchlist",
    relevance: binding.relevance ?? 0.9,
    preferences,
    now: NOON_UTC,
  });
}

describe("every stored notification preference binds", () => {
  const columns = columnsOf("user_notification_preferences", schemaSql());

  it("finds the table in the schema at all", () => {
    // If the extraction silently returned nothing, every assertion below would pass vacuously.
    expect(columns.length).toBeGreaterThan(5);
  });

  it("accounts for every column — bound, or excepted with a reason", () => {
    const unaccounted = columns.filter((c) => !(c in NOTIFICATION_BINDINGS) && !(c in NOTIFICATION_UNBOUND));
    expect(
      unaccounted,
      `these columns are stored but nothing here proves they do anything: ${unaccounted.join(", ")}. Add a binding, or an entry in NOTIFICATION_UNBOUND explaining why it cannot bind.`,
    ).toEqual([]);
  });

  it.each(Object.keys(NOTIFICATION_BINDINGS))("%s changes what the system decides", (column) => {
    const binding = NOTIFICATION_BINDINGS[column]!;
    const start = binding.baseline ? binding.baseline(base()) : base();
    expect(
      effect(binding.flip(start), binding),
      `flipping ${column} changed nothing — it is stored and rendered but no longer governs anything`,
    ).not.toEqual(effect(start, binding));
  });

  it.each(Object.keys(NOTIFICATION_UNBOUND))("%s is documented as doing nothing, and really does nothing", (column) => {
    const entry = NOTIFICATION_UNBOUND[column]!;
    expect(entry.reason.length, "an exception needs a reason someone can read").toBeGreaterThan(40);
    const binding: Binding = { flip: entry.flip };
    expect(
      effect(entry.flip(base()), binding),
      `${column} is listed as unbound but flipping it DID change something — move it into NOTIFICATION_BINDINGS`,
    ).toEqual(effect(base(), binding));
  });

  it("does not let a binding be satisfied by a mention", () => {
    // The reason this file tests behaviour instead of grepping: `emailEnabled` appears in the
    // policy module's interface, its defaults and a comment, and reads as bound to any text search.
    const policy = readFileSync(new URL("../../src/server/notifications/policy.ts", import.meta.url), "utf8");
    expect(policy).toContain("emailEnabled");
    expect(Object.keys(NOTIFICATION_UNBOUND)).toContain("email_enabled");
  });
});

// The market-preference table binds through getPersonalizedMarket, which needs a database — so the
// behavioural proof lives in tests/integration/market-preferences-bind.test.ts. This half checks
// that every column HAS such a proof, so a new column cannot be added without one.
const MARKET_PROOF_FILES = [
  "../integration/market-preferences-bind.test.ts",
  "../integration/consumer-intelligence.test.ts",
];

/** column -> the identifier a proof must exercise. An identifier survives rewording; a phrase does not. */
const MARKET_COVERAGE: Record<string, string> = {
  price_floor: "priceFloor",
  price_ceiling: "priceCeiling",
  max_shipping_days: "maxShippingDays",
  evidence_priorities: "evidencePriorities",
  required_evidence_levels: "requiredEvidenceLevels",
  preferred_vendor_slugs: "preferredVendorSlugs",
  hidden_vendor_slugs: "hiddenVendorSlugs",
  preferred_compound_slugs: "preferredCompoundSlugs",
  home_view: "homeView",
  personalization_enabled: "personalizationEnabled",
};

describe("every stored market preference has a behavioural proof", () => {
  const columns = columnsOf("user_market_preferences", schemaSql());

  it("finds the table in the schema at all", () => {
    expect(columns.length).toBeGreaterThan(5);
  });

  it("accounts for every column", () => {
    const unaccounted = columns.filter((c) => !(c in MARKET_COVERAGE));
    expect(
      unaccounted,
      `stored but unproven: ${unaccounted.join(", ")}. Add a test to tests/integration/market-preferences-bind.test.ts and name it here.`,
    ).toEqual([]);
  });

  it("points at integration proofs that exist and exercise each preference", () => {
    const proof = MARKET_PROOF_FILES
      .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
      .join("\n");
    const missing = Object.entries(MARKET_COVERAGE).filter(([, identifier]) => !proof.includes(identifier));
    expect(
      missing.map(([column]) => column),
      `named as covered here but no proof file exercises them: ${missing.map(([c]) => c).join(", ")}`,
    ).toEqual([]);
  });
});
