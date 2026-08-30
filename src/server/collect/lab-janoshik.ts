// The Janoshik public-test loop, on the collection queue.
//
// Until 2026-08-30 discovery (new public tests) and liveness (is each stored certificate still
// listed) were two hand-run scripts, and they last ran on 2026-07-22 — not because nobody
// remembered, but because public.janoshik.com sits behind Cloudflare, which answers every
// non-browser client with 403 "Attention Required": a Chrome user-agent, curl and an honest bot
// user-agent all get the same page (probed 2026-08-30; the read-only audit got it on 08-29). The
// same page renders normally in a person's browser. Nothing on /status or /admin said any of this;
// the evidence simply stopped growing and 279 certificates aged in place.
//
// Two collector kinds, because they have two different honest states:
//
//   lab-janoshik          LIVE. Reads the public feed with an honest user-agent, then runs discovery
//                         and liveness exactly as the scripts did. A refusal is a refusal: the
//                         target settles failed with the HTTP status in last_error, is disabled
//                         after three like any storefront that blocks us, and is retried weekly —
//                         so the day the lab's edge admits a server, the loop closes on its own.
//
//   lab-janoshik-capture  A snapshot a PERSON took in their own browser and committed to the repo
//                         (src/server/data/janoshik-feed-capture.json, written by
//                         scripts/janoshik-capture-to-json.mjs from a saved page). Same source, same
//                         parser contract; the one client the edge admits is a human. Discovery
//                         runs from it — idempotent on verify_url, so a capture is applied once and
//                         re-reading it costs nothing. Liveness does NOT: "still publicly listed" is
//                         a statement about now, and a capture only knows about the day it was taken.
//
// What this is not: a way around the block. No browser is automated and no fingerprint is spoofed.
import type { SqlConnection } from "@/server/db/client";
import type { JanoshikEntry } from "@/server/ingest/lab-tests";
import { reconcileLabsFromRegistry } from "@/server/ingest/lab-tests";
import { ingestNewJanoshikTests, applyPurities, annotateTestTypes, selectNewEntries, getKnownVerifyUrls, type PurityRecord } from "@/server/ingest/janoshik-discovery";
import { fetchJanoshikPortal, annotateJanoshikListings, JanoshikPortalError } from "@/server/verify/janoshik-verify";
import { computeAndStoreLinkages } from "@/server/verify/vendor-linkage";
import { recomputeCompoundStats } from "@/server/ingest/live-sources";
import { projectLiveBatchPassports } from "@/server/evidence-network/live-passports";
import { projectEvidenceRegistry } from "@/server/registry/repository";
import { StorefrontUnreachableError } from "@/server/ingest/woocommerce-import";
import type { CompoundRef } from "@/server/ingest/shopify-import";
import knownVendors from "@/server/verify/known-vendors.json";
import purityFile from "../../../scripts/data/janoshik-purities.json";
import captureFile from "@/server/data/janoshik-feed-capture.json";
import type { CollectorOutcome } from "./types";

export const JANOSHIK_HOST = "public.janoshik.com";

/**
 * The most new certificates one run records. A capture can carry 200 tests we have never seen;
 * each is a vendor upsert plus an insert, and everything downstream (linkage, compound stats,
 * passports, registry) recomputes once afterwards. Bounded so a first read cannot outlive the
 * function ceiling and die unsettled; the rest lands on the next run, idempotently.
 */
export const MAX_NEW_PER_RUN = 80;

export interface JanoshikCapture {
  capturedAt: string;
  capturedFrom: string;
  capturedBy: string;
  columns: string[];
  /** [testId, verifyUrl, sampleName, client, manufacturer, note, sticky] */
  rows: (string | number)[][];
}

const VERIFY_KEY = /_([A-Z0-9]{8,})$/;

/** Rows of a browser capture as feed entries — same shape the live parser produces, first
 *  occurrence of a verify_url wins (the portal pins recent tests as duplicates at the top). */
export function entriesFromCapture(capture: JanoshikCapture): JanoshikEntry[] {
  const out: JanoshikEntry[] = [];
  const seen = new Set<string>();
  for (const row of capture.rows) {
    const [testId, verifyUrl, sampleName, client, manufacturer, note] = row.map((v) => String(v ?? "").trim());
    if (!testId || !verifyUrl || !sampleName) continue;
    if (!verifyUrl.startsWith("https://verify.janoshik.com/tests/")) continue;
    if (seen.has(verifyUrl)) continue;
    seen.add(verifyUrl);
    const key = VERIFY_KEY.exec(verifyUrl);
    out.push({ testId, verifyUrl, verifyKey: key ? key[1]! : "", sampleName, manufacturer: manufacturer || "Unknown", client, note });
  }
  return out;
}

export function bundledCapture(): JanoshikCapture {
  return captureFile as JanoshikCapture;
}

interface KnownVendor { slug: string; name: string; domain: string }
function knownVendorRefs(): KnownVendor[] {
  const raw = knownVendors as unknown;
  const list = Array.isArray(raw) ? raw : ((raw as { vendors?: unknown[] }).vendors ?? []);
  return (list as KnownVendor[]).filter((v) => v?.slug && v?.domain).map((v) => ({ slug: v.slug, name: v.name, domain: v.domain }));
}

async function compoundRefs(db: SqlConnection): Promise<CompoundRef[]> {
  return (await db.query<{ slug: string; canonical_name: string; aliases: unknown }>(`SELECT slug, canonical_name, aliases FROM compounds`)).rows
    .map((r) => ({ slug: r.slug, name: r.canonical_name, aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : [] }));
}

export interface DiscoverySummary { entries: number; newTests: number; newVendors: string[]; purities: number; typed: number; remaining: number }

/**
 * Discovery, shared by both kinds: record what the feed lists and we do not hold (bounded), backfill
 * vision-read certificate values, annotate test types, reconcile labs against the registry, and —
 * only when something actually changed — recompute what is derived from certificates.
 */
export async function discoverFromEntries(db: SqlConnection, entries: JanoshikEntry[], purities: Record<string, PurityRecord> = purityFile as Record<string, PurityRecord>): Promise<DiscoverySummary> {
  const unseen = selectNewEntries(entries, await getKnownVerifyUrls(db));
  const batch = unseen.slice(0, MAX_NEW_PER_RUN);
  // Feed the ingest only the slice it should record; it re-derives "new" itself, idempotently.
  const res = await ingestNewJanoshikTests(db, batch, { compounds: await compoundRefs(db), vendors: knownVendorRefs() }, purities);
  const applied = await applyPurities(db, purities);
  const typed = await annotateTestTypes(db, entries);
  await reconcileLabsFromRegistry(db);
  if (res.newTests.length || applied || typed) {
    await computeAndStoreLinkages(db);
    await recomputeCompoundStats(db);
    // Recency is a factor of passport confidence; the projection's default `asOf` is a frozen date
    // from its first run. From the queue, "as of" is now.
    await projectLiveBatchPassports(db, new Date());
    await projectEvidenceRegistry(db);
  }
  return { entries: entries.length, newTests: res.newTests.length, newVendors: res.newVendors, purities: applied, typed, remaining: unseen.length - batch.length };
}

/** LIVE: the public feed, read by this deployment. Refusals surface as refusals. */
export async function collectJanoshikLive(db: SqlConnection, input: { fetchImpl?: typeof fetch } = {}): Promise<CollectorOutcome> {
  let entries: JanoshikEntry[];
  try {
    ({ entries } = await fetchJanoshikPortal({ ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}) }));
  } catch (error) {
    // The queue disables a source that refuses us after three attempts and names the status on
    // /admin; a thrown error of any other shape would read as a defect in our own code.
    if (error instanceof JanoshikPortalError) throw new StorefrontUnreachableError(JANOSHIK_HOST, error.status);
    throw error;
  }
  if (entries.length === 0) {
    return { items: 0, ok: false, error: "the portal answered but no public tests parsed — its layout may have changed; nothing was written" };
  }
  const discovery = await discoverFromEntries(db, entries);
  const liveness = await annotateJanoshikListings(db, entries);
  if (liveness.delisted.length) {
    console.warn(`[collect/lab-janoshik] ${liveness.delisted.length} previously-listed certificate(s) are no longer in the public feed: ${liveness.delisted.slice(0, 20).join(", ")}`);
  }
  console.log(`[collect/lab-janoshik] feed=${entries.length} new=${discovery.newTests} remaining=${discovery.remaining} listed=${liveness.stillListed}/${liveness.keysChecked}`);
  return { items: entries.length, ok: true };
}

/** CAPTURE: the committed browser snapshot. Discovery only; never a liveness stamp. */
export async function collectJanoshikCapture(db: SqlConnection, input: { capture?: JanoshikCapture } = {}): Promise<CollectorOutcome> {
  const capture = input.capture ?? bundledCapture();
  const entries = entriesFromCapture(capture);
  if (entries.length === 0) return { items: 0, ok: false, error: "the bundled capture holds no public tests — nothing was written" };
  const discovery = await discoverFromEntries(db, entries);
  console.log(`[collect/lab-janoshik-capture] capture=${capture.capturedAt} entries=${entries.length} new=${discovery.newTests} remaining=${discovery.remaining}`);
  return { items: entries.length, ok: true };
}
