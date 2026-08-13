// Real regulatory-enforcement collection.
//
// Before this existed, `/enforcement` was loaded once by hand from a JSON file that no deployed
// code could read, so it could never change. Two streams now feed it, both readable from inside a
// deployment:
//
//   1. A CURATED BASELINE (`src/server/data/regulatory-actions.json`) — hand-verified FDA warning
//      letters and DOJ prosecutions against grey-market peptide sellers. There is no live,
//      machine-readable feed of FDA warning letters (see NOTE below), so these stay curated. They
//      are static-imported, which is the whole point: a deployment can read them.
//   2. openFDA drug enforcement (https://api.fda.gov/drug/enforcement.json) — FDA's own recall
//      database, free and keyless, updated continuously. Queried for the compounds this market
//      actually tracks, so a compounded-semaglutide recall shows up without anyone touching a file.
//
// NOTE on warning letters: FDA publishes `/files/api/datatables/static/warning-letters.json`, but it
// is a frozen 2017–2021 archive (verified: 2,658 rows, zero after 2021). The live warning-letter
// table is a Drupal view that exports xlsx only. Wiring the frozen file in would re-create exactly
// the bug this module fixes — a feed that can never update — so it is deliberately not used.
//
// THE ATTRIBUTION RULE: an enforcement record is a published statement about a named real company.
// Every record here goes through `recordRegulatoryAction`, which resolves the subject with the
// strict high/none matcher. An unmatched company is stored with `vendor_slug` NULL — visible in the
// market-wide feed, never pinned to a vendor's page. A false accusation is the real risk, not a
// missed match.

import type { SqlConnection } from "@/server/db/client";
import { safeFetch } from "@/server/refresh/safe-fetch";
import { recordRegulatoryAction } from "@/server/regulatory/repository";
import type { RegAgency, RegActionType, RegOutcome, RegulatoryActionInput, VendorRef } from "@/server/regulatory/actions";
import { cleanText, toIsoDate } from "./source-text";
import type { CollectorOutcome } from "./types";
import curatedActionsJson from "@/server/data/regulatory-actions.json";

/** The only host this collector may reach. Passed to `safeFetch` on every request. */
export const OPENFDA_HOSTNAMES = ["api.fda.gov"];
const OPENFDA_ENDPOINT = "https://api.fda.gov/drug/enforcement.json";

const TERMS_PER_QUERY = 12;   // one URL stays well under any length limit and openFDA ORs happily
const RECORDS_PER_QUERY = 1000; // openFDA's ceiling
const MAX_RECORDS_PER_RUN = 600;

// ── openFDA payload ───────────────────────────────────────────────────────────────────────────────

/** The subset of an openFDA drug-enforcement record this collector reads. Every field is optional:
 *  openFDA omits fields freely, and a missing field must never throw. */
export interface OpenFdaEnforcementRecord {
  recall_number?: string;
  event_id?: string;
  recalling_firm?: string;
  product_description?: string;
  reason_for_recall?: string;
  classification?: string;
  status?: string;
  voluntary_mandated?: string;
  distribution_pattern?: string;
  recall_initiation_date?: string;
  report_date?: string;
  city?: string;
  state?: string;
  country?: string;
  product_type?: string;
}

export interface OpenFdaEnforcementPayload {
  meta?: { results?: { total?: number; limit?: number; skip?: number } };
  results?: OpenFdaEnforcementRecord[];
  error?: { code?: string; message?: string };
}

/** A stable, unique primary-source permalink for one recall — also the idempotency key, since
 *  `regulatory_actions` is UNIQUE(source_url, subject_name). */
export function openFdaRecordUrl(recallNumber: string): string {
  return `${OPENFDA_ENDPOINT}?search=${encodeURIComponent(`recall_number:"${recallNumber}"`)}`;
}

/** Build one batched search URL. Terms are sanitized to plain words so nothing can escape the
 *  quotes and rewrite openFDA's query syntax. */
export function openFdaSearchUrl(terms: string[], limit = RECORDS_PER_QUERY): string {
  const safe = sanitizeTerms(terms);
  if (!safe.length) throw new Error("openFdaSearchUrl requires at least one usable term");
  const query = safe.map((t) => `"${t}"`).join(" OR ");
  const params = new URLSearchParams({ search: `product_description:(${query})`, limit: String(limit) });
  return `${OPENFDA_ENDPOINT}?${params.toString()}`;
}

/**
 * Reduce compound names to search terms that are safe and specific.
 *
 * Short tokens are dropped on purpose: `VIP`, `MGF`, `KPV`, and `P21` are real compounds in the
 * catalog, but as free-text searches against every drug recall in America they match noise, and a
 * noisy enforcement feed is worse than a small one.
 */
export function sanitizeTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of terms) {
    const cleaned = String(raw ?? "").toLowerCase().replace(/[^a-z0-9+\- ]+/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length >= 5 && cleaned.length <= 60) seen.add(cleaned);
  }
  return [...seen];
}

/**
 * One openFDA recall to one `regulatory_actions` input. Returns null when the record cannot be
 * stored honestly — no named firm (nobody to attribute it to) or no stable recall number (no
 * idempotency key, so re-running would duplicate it).
 */
export function mapEnforcementRecord(record: OpenFdaEnforcementRecord): RegulatoryActionInput | null {
  const subjectName = cleanText(record.recalling_firm, 200);
  const recallNumber = cleanText(record.recall_number, 60);
  if (!subjectName || !recallNumber) return null;

  const product = cleanText(record.product_description, 240);
  const reason = cleanText(record.reason_for_recall, 600);
  const classification = cleanText(record.classification, 40);
  const status = cleanText(record.status, 40);
  const voluntary = cleanText(record.voluntary_mandated, 60);
  const distribution = cleanText(record.distribution_pattern, 120);

  const titleProduct = product ? product.split(",")[0]!.trim().slice(0, 90) : "drug product";
  const title = `FDA ${classification || "drug"} recall — ${titleProduct}`;

  const summary = [
    `FDA recall ${recallNumber}${classification ? ` (${classification})` : ""} by ${subjectName}.`,
    product ? `Product: ${product}.` : "",
    reason ? `Reason for recall: ${reason}` : "",
    [voluntary, distribution ? `Distribution: ${distribution}` : "", status ? `Status: ${status}` : ""].filter(Boolean).join(" · "),
  ].filter(Boolean).join(" ");

  return {
    actionType: "recall",
    agency: "FDA",
    subjectName,
    // openFDA carries no website for the recalling firm, so there is no domain to match on. The
    // resolver falls back to an exact normalized-name match, which is the intended strictness.
    subjectDomain: undefined,
    outcome: null,
    title: title.slice(0, 300),
    summary: cleanText(summary, 1400),
    actionDate: toIsoDate(record.recall_initiation_date) ?? toIsoDate(record.report_date),
    sourceUrl: openFdaRecordUrl(recallNumber),
    isPrimarySource: true,
  };
}

// ── curated baseline ─────────────────────────────────────────────────────────────────────────────

const ACTION_TYPES: RegActionType[] = ["warning_letter", "import_alert", "doj_action", "ftc_action", "recall", "advisory"];
const AGENCIES: RegAgency[] = ["FDA", "DOJ", "FTC", "state", "other"];
const OUTCOMES: RegOutcome[] = ["charged", "indicted", "guilty_plea", "convicted", "settlement", "injunction", "seizure", "sentenced"];

/** Validate the bundled JSON into the typed input. A malformed entry is skipped, not coerced. */
export function normalizeCuratedAction(raw: unknown): RegulatoryActionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const actionType = ACTION_TYPES.find((t) => t === r.actionType);
  const agency = AGENCIES.find((a) => a === r.agency);
  const subjectName = cleanText(typeof r.subjectName === "string" ? r.subjectName : "", 200);
  const title = cleanText(typeof r.title === "string" ? r.title : "", 300);
  const sourceUrl = typeof r.sourceUrl === "string" ? r.sourceUrl.trim() : "";
  if (!actionType || !agency || !subjectName || !title || !sourceUrl) return null;
  return {
    actionType,
    agency,
    subjectName,
    subjectDomain: typeof r.subjectDomain === "string" && r.subjectDomain.trim() ? r.subjectDomain.trim() : undefined,
    outcome: OUTCOMES.find((o) => o === r.outcome) ?? null,
    title,
    summary: cleanText(typeof r.summary === "string" ? r.summary : "", 1400),
    actionDate: toIsoDate(typeof r.actionDate === "string" ? r.actionDate : null),
    sourceUrl,
    isPrimarySource: r.isPrimarySource !== false,
  };
}

export function curatedActions(): RegulatoryActionInput[] {
  const list = Array.isArray(curatedActionsJson) ? curatedActionsJson : [];
  return list.map(normalizeCuratedAction).filter((a): a is RegulatoryActionInput => a !== null);
}

// ── collection ───────────────────────────────────────────────────────────────────────────────────

export type JsonFetcher = (url: string) => Promise<unknown>;

/** The real transport. Every outbound request in this module goes through `safeFetch` with an
 *  explicit hostname allowlist — never bare `fetch`. */
export const fetchOpenFdaJson: JsonFetcher = async (url) => {
  const response = await safeFetch(url, {
    allowedHostnames: OPENFDA_HOSTNAMES,
    allowedContentTypes: ["application/json"],
    timeoutMs: 25_000,
    maxResponseBytes: 12 * 1024 * 1024,
    maxRedirects: 2,
  });
  return JSON.parse(response.body) as unknown;
};

/** The vendors an action may be attributed to, read from the live catalog. */
export async function liveVendorRefs(db: SqlConnection): Promise<VendorRef[]> {
  const rows = (await db.query<{ slug: string; display_name: string; domains: unknown }>(
    `SELECT slug, display_name, domains FROM organizations WHERE origin='live' AND organization_type='vendor'`,
  )).rows;
  return rows.map((r) => {
    let domains: string[] = [];
    if (Array.isArray(r.domains)) domains = r.domains.filter((d): d is string => typeof d === "string");
    else if (typeof r.domains === "string") { try { const p = JSON.parse(r.domains); if (Array.isArray(p)) domains = p.filter((d): d is string => typeof d === "string"); } catch { domains = []; } }
    return { slug: r.slug, name: r.display_name, domains };
  });
}

/** Compound names from the catalog, so the enforcement search tracks whatever the market tracks. */
async function compoundTerms(db: SqlConnection): Promise<string[]> {
  const rows = (await db.query<{ canonical_name: string }>(`SELECT canonical_name FROM compounds`)).rows;
  return sanitizeTerms(rows.map((r) => r.canonical_name));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface EnforcementCollectionOptions {
  fetchJson?: JsonFetcher;
  terms?: string[];
  /** Skip the bundled baseline (used by tests that assert purely on the live stream). */
  includeCurated?: boolean;
  maxRecords?: number;
}

/**
 * Run one enforcement pass. Never throws for a source problem — an unreachable, rate-limited, or
 * reshaped openFDA settles as `ok: false` with the curated baseline still written, because the
 * baseline is bundled and cannot fail.
 */
export async function collectEnforcement(db: SqlConnection, options: EnforcementCollectionOptions = {}): Promise<CollectorOutcome> {
  const fetchJson = options.fetchJson ?? fetchOpenFdaJson;
  const maxRecords = options.maxRecords ?? MAX_RECORDS_PER_RUN;
  const vendors = await liveVendorRefs(db);
  let items = 0;

  // 1. Bundled baseline. Idempotent upsert, so this is a no-op after the first tick.
  if (options.includeCurated !== false) {
    for (const action of curatedActions()) {
      await recordRegulatoryAction(db, action, vendors);
      items += 1;
    }
  }

  // 2. Live openFDA.
  const terms = options.terms?.length ? sanitizeTerms(options.terms) : await compoundTerms(db);
  if (!terms.length) return { items, ok: false, error: "no usable search terms — the compound catalog is empty" };

  const seenRecalls = new Set<string>();
  const failures: string[] = [];
  let batches = 0;
  let liveRecords = 0;

  for (const group of chunk(terms, TERMS_PER_QUERY)) {
    if (liveRecords >= maxRecords) break;
    batches += 1;
    let payload: OpenFdaEnforcementPayload;
    try {
      payload = (await fetchJson(openFdaSearchUrl(group))) as OpenFdaEnforcementPayload;
    } catch (error) {
      // One dead batch must not lose the batches that worked.
      failures.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    // openFDA answers "nothing matched" with HTTP 404 + {error:{code:"NOT_FOUND"}}. safeFetch turns
    // the 404 into a throw, so that lands above — but when it arrives as a body, it is an empty
    // result, not a breakage.
    if (payload?.error && !payload.results) continue;
    for (const record of payload?.results ?? []) {
      if (liveRecords >= maxRecords) break;
      const mapped = mapEnforcementRecord(record);
      if (!mapped) continue;
      if (seenRecalls.has(mapped.sourceUrl)) continue; // the same recall matches several terms
      seenRecalls.add(mapped.sourceUrl);
      await recordRegulatoryAction(db, mapped, vendors);
      liveRecords += 1;
    }
  }

  items += liveRecords;

  // Every batch failed, or the source returned nothing at all: the live stream is broken or empty.
  // Say so rather than reporting a green run off the bundled baseline alone.
  if (failures.length === batches && batches > 0) {
    return { items, ok: false, error: `openFDA unreachable: ${failures[0]}`.slice(0, 400) };
  }
  if (liveRecords === 0) {
    return { items, ok: false, error: "openFDA returned no enforcement records for any tracked compound" };
  }
  return { items, ok: true };
}
