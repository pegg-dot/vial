// Reconciling duplicate vendor profiles — one business, one row.
//
// The COA "client" field spells the same reseller several ways across certificates ("HHM Peptide
// Ltd" on one, the canonicalised "HHM Peptide" on the next ingest generation; "admin@rayshine-
// peptide" instead of "Rayshine Peptide"). Each spelling minted its own organization, so one
// vendor's independent lab history is split across ghost profiles AND the site's headline vendor
// count is inflated by the ghosts. cleanVendorString() fixed the mint; this module heals what is
// already stored.
//
// Three rules govern everything here:
//
//   1. EVIDENCE IS NEVER DESTROYED. A merge re-points every row that names the losing vendor —
//      listings, COAs, passports, reviews, flags, status, enforcement, fingerprints, prices,
//      offers, signals, clicks — onto the survivor, and a census taken before and after must
//      balance. Where a unique constraint means the survivor already holds the equivalent row,
//      the losing row is collapsed and REPORTED, never silently dropped.
//   2. DERIVED IDENTITY IS HEALED IN THE SAME TRANSACTION. canonical_entities, entity_aliases,
//      search_documents and registry_identifiers are projections that only ever upsert — nothing
//      in the codebase prunes them. Deleting an organization without retiring its projections is
//      exactly what left `entity:organization:zztai-peptide-ltd` pointing at an organization that
//      no longer exists, and left a search document whose /vendors/ link 404s.
//   3. PUBLIC IDENTIFIERS REDIRECT, THEY DO NOT VANISH. A minted `vialgrade:vendor:...` ID is a
//      published standard; the losing ID is marked redirected at the survivor rather than deleted,
//      and the losing slug is kept as a resolvable former-slug alias.
//
// Immutable history (domain_events, publication_events, decision_events, security_audit_events,
// search_query_logs) is deliberately NOT rewritten: those rows record what happened to the entity
// that existed at the time, and the redirect above keeps them traceable.

import type { QueryResultRow } from "pg";
import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { canonicalizeVendorName, canonicalizeVendorSlug } from "@/server/ingest/coa-vendors";
import { normalizeTerm } from "@/server/market-data/normalize";

/** A table+column naming a vendor by SLUG. `unique` is the constraint that can collide on repoint. */
export interface SlugReference { table: string; column: string; unique?: string[]; filter?: string }
/** A table+column naming a vendor by organization ID (`org:...`). */
export interface OrgReference { table: string; column: string; unique?: string[] }

// Verified against information_schema + pg_constraint on the live store: every text column that
// currently holds, or is declared to hold, a vendor slug. Adding a vendor-scoped table WITHOUT
// adding it here is how evidence goes missing, so the coverage test walks the schema and fails
// on any *_slug column this list does not name.
export const SLUG_REFERENCES: SlugReference[] = [
  { table: "aggregator_ratings", column: "vendor_slug", unique: ["vendor_slug", "source"] },
  { table: "community_mentions", column: "vendor_slug" },
  { table: "lab_test_records", column: "vendor_slug" },
  { table: "news_items", column: "vendor_slug" },
  { table: "outbound_clicks", column: "vendor_slug" },
  { table: "partner_programs", column: "vendor_slug", unique: ["vendor_slug"] },
  { table: "price_observations", column: "vendor_slug" },
  { table: "regulatory_actions", column: "vendor_slug" },
  { table: "vendor_fingerprints", column: "vendor_slug", unique: ["vendor_slug", "kind", "value"] },
  { table: "vendor_flags", column: "vendor_slug", unique: ["vendor_slug", "kind"] },
  { table: "vendor_links", column: "vendor_slug", unique: ["vendor_slug", "linked_slug", "basis"] },
  { table: "vendor_links", column: "linked_slug", unique: ["vendor_slug", "linked_slug", "basis"] },
  { table: "vendor_offers", column: "vendor_slug", unique: ["vendor_slug", "description"] },
  { table: "vendor_reviews", column: "vendor_slug", unique: ["vendor_slug"] },
  { table: "vendor_signals", column: "vendor_slug", unique: ["vendor_slug"] },
  { table: "vendor_status", column: "vendor_slug", unique: ["vendor_slug"] },
  { table: "entity_follows", column: "entity_slug", unique: ["user_id", "entity_type", "entity_slug"], filter: "t.entity_type='vendor'" },
];

// Columns holding `org:<slug>`. products/sources/commerce_sellers carry a real FOREIGN KEY, so
// missing one of these turns the org DELETE into a hard error; batch_passports.vendor_id is
// ON DELETE SET NULL, which is worse — it detaches a published passport from its vendor SILENTLY.
export const ORG_REFERENCES: OrgReference[] = [
  { table: "products", column: "vendor_id" },
  { table: "batch_passports", column: "vendor_id" },
  { table: "sources", column: "owner_organization_id" },
  { table: "commerce_sellers", column: "organization_id", unique: ["organization_id"] },
  { table: "laboratory_profiles", column: "organization_id" },
];

export type Census = Record<string, number>;

export interface MergeMember {
  slug: string;
  orgId: string;
  displayName: string;
  domains: string[];
  census: Census;
  evidenceRows: number;
}

export interface MergeCluster {
  /** The canonical slug every member collapses onto. */
  canonical: string;
  survivor: MergeMember;
  absorbed: MergeMember[];
  /** Set when the survivor itself has to be renamed onto the canonical slug first. */
  rename: { from: string; to: string; displayName: string } | null;
}

export interface IdentityResidue {
  kind: "canonical-entity" | "search-document" | "registry-identifier";
  id: string;
  danglingRef: string;
  /** The existing vendor slug this residue should resolve to, or null when it cannot be decided. */
  resolvesTo: string | null;
}

export interface VendorMergePlan {
  vendorCountBefore: number;
  vendorCountAfter: number;
  clusters: MergeCluster[];
  residue: IdentityResidue[];
  malformedNames: { slug: string; displayName: string; reason: string }[];
}

const ORG_ROWS = `SELECT id, slug, display_name, domains FROM organizations WHERE organization_type='vendor' ORDER BY slug`;

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") { try { const p = JSON.parse(value); return Array.isArray(p) ? p.filter((v): v is string => typeof v === "string") : []; } catch { return []; } }
  return [];
}

/** Count every evidence row attached to one vendor, table by table. The proof a merge lost nothing. */
export async function censusForVendor(db: SqlConnection, slug: string, orgId: string): Promise<Census> {
  const census: Census = {};
  for (const ref of SLUG_REFERENCES) {
    const filter = ref.filter ? ` AND ${ref.filter}` : "";
    const n = (await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM "${ref.table}" AS t WHERE t."${ref.column}"=$1${filter}`, [slug])).rows[0]?.n ?? 0;
    if (n > 0) census[`${ref.table}.${ref.column}`] = n;
  }
  for (const ref of ORG_REFERENCES) {
    const n = (await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM "${ref.table}" AS t WHERE t."${ref.column}"=$1`, [orgId])).rows[0]?.n ?? 0;
    if (n > 0) census[`${ref.table}.${ref.column}`] = n;
  }
  return census;
}

function total(census: Census): number {
  return Object.values(census).reduce((a, b) => a + b, 0);
}

// A display name that is an email address, a URL, a bare domain or a scrap of contact markup is
// not a company name. `admin@rayshine-peptide` shipped as a browsable, gradable vendor because
// nothing ever checked. This does not repair the string — the mint is the place for that — it
// makes the breakage visible instead of silent.
const NAME_SHAPES: { reason: string; test: RegExp }[] = [
  { reason: "email address", test: /@/ },
  { reason: "URL", test: /^https?:\/\//i },
  { reason: "bare domain", test: /^(www\.)?[a-z0-9-]+\.[a-z]{2,}$/i },
  { reason: "contact markup", test: /\[email|__cf_email__|&#\d+;|&nbsp;|\bprotected\]/i },
  { reason: "login handle prefix", test: /^admin[\s\-@_.]/i },
];

export function describeMalformedName(displayName: string): string | null {
  for (const shape of NAME_SHAPES) if (shape.test.test(displayName.trim())) return shape.reason;
  return null;
}

export async function findMalformedVendorNames(db: SqlConnection) {
  const rows = (await db.query<QueryResultRow & { slug: string; display_name: string }>(ORG_ROWS)).rows;
  return rows
    .map((r) => ({ slug: r.slug, displayName: r.display_name, reason: describeMalformedName(r.display_name) }))
    .filter((r): r is { slug: string; displayName: string; reason: string } => r.reason !== null);
}

/**
 * Identity projections left pointing at an organization that no longer exists. These are the
 * fingerprints of a merge that deleted the row but not its derived records — a search hit whose
 * link 404s, a canonical entity the resolver still offers, a public registry ID with no subject.
 */
export async function findIdentityResidue(db: SqlConnection): Promise<IdentityResidue[]> {
  const live = new Set((await db.query<{ id: string; slug: string }>(ORG_ROWS)).rows.map((r) => r.id));
  const liveSlugs = new Set((await db.query<{ slug: string }>(`SELECT slug FROM organizations WHERE organization_type='vendor'`)).rows.map((r) => r.slug));
  const resolve = (key: string) => { const c = canonicalizeVendorSlug(key); return liveSlugs.has(c) ? c : null; };
  const out: IdentityResidue[] = [];

  for (const row of (await db.query<QueryResultRow & { id: string; canonical_key: string; source_entity_id: string }>(
    `SELECT id, canonical_key, source_entity_id FROM canonical_entities
     WHERE entity_type='organization' AND source_entity_type='organization' AND source_entity_id IS NOT NULL ORDER BY id`,
  )).rows) {
    if (live.has(row.source_entity_id)) continue;
    out.push({ kind: "canonical-entity", id: row.id, danglingRef: row.source_entity_id, resolvesTo: resolve(row.canonical_key) });
  }
  for (const row of (await db.query<QueryResultRow & { id: string; entity_id: string }>(
    `SELECT id, entity_id FROM search_documents WHERE entity_type='organization' ORDER BY id`,
  )).rows) {
    if (live.has(row.entity_id)) continue;
    out.push({ kind: "search-document", id: row.id, danglingRef: row.entity_id, resolvesTo: resolve(row.entity_id.replace(/^org:/, "")) });
  }
  for (const row of (await db.query<QueryResultRow & { registry_id: string; source_entity_id: string; canonical_slug: string; status: string }>(
    `SELECT registry_id, source_entity_id, canonical_slug, status FROM registry_identifiers
     WHERE source_entity_type='organization' ORDER BY registry_id`,
  )).rows) {
    if (live.has(row.source_entity_id) || row.status === "redirected") continue;
    out.push({ kind: "registry-identifier", id: row.registry_id, danglingRef: row.source_entity_id, resolvesTo: resolve(row.canonical_slug) });
  }
  return out;
}

/**
 * Group live vendors by the slug the ingest would mint for them TODAY. A cluster of two or more is
 * a duplicate to merge; a cluster of one whose member is not already canonical is a duplicate
 * WAITING to happen — the next COA naming that vendor mints the canonical twin beside it. Missing
 * that second case is why `hhm-peptide-ltd` (alone, so skipped) acquired an `hhm-peptide` twin a
 * week later.
 */
export async function planVendorMerges(db: SqlConnection): Promise<VendorMergePlan> {
  const rows = (await db.query<QueryResultRow & { id: string; slug: string; display_name: string; domains: unknown }>(ORG_ROWS)).rows;
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = canonicalizeVendorSlug(row.slug);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(row); else grouped.set(key, [row]);
  }

  const clusters: MergeCluster[] = [];
  for (const [canonical, members] of grouped) {
    if (members.length === 1 && members[0].slug === canonical) continue;

    const described: MergeMember[] = [];
    for (const m of members) {
      const census = await censusForVendor(db, m.slug, m.id);
      described.push({ slug: m.slug, orgId: m.id, displayName: m.display_name, domains: asStringArray(m.domains), census, evidenceRows: total(census) });
    }
    // The survivor is the member already on the canonical slug; failing that, the one carrying the
    // most evidence, which is then renamed onto it. Never pick by row order — that is arbitrary.
    described.sort((a, b) => b.evidenceRows - a.evidenceRows || a.slug.localeCompare(b.slug));
    const survivor = described.find((m) => m.slug === canonical) ?? described[0];
    const absorbed = described.filter((m) => m.slug !== survivor.slug);
    clusters.push({
      canonical,
      survivor,
      absorbed,
      rename: survivor.slug === canonical ? null : { from: survivor.slug, to: canonical, displayName: canonicalizeVendorName(survivor.displayName) },
    });
  }
  clusters.sort((a, b) => a.canonical.localeCompare(b.canonical));

  const vendorCountBefore = rows.length;
  const vendorCountAfter = vendorCountBefore - clusters.reduce((n, c) => n + c.absorbed.length, 0);
  return { vendorCountBefore, vendorCountAfter, clusters, residue: await findIdentityResidue(db), malformedNames: await findMalformedVendorNames(db) };
}

export interface CollapsedRows { table: string; column: string; rows: number }
export interface MergeOutcome {
  cluster: string;
  survivor: string;
  absorbed: string[];
  before: Census;
  after: Census;
  collapsed: CollapsedRows[];
  /** True when after == before minus the reported collapses, table by table. */
  balanced: boolean;
}
export interface ApplyResult {
  dryRun: boolean;
  merges: MergeOutcome[];
  renames: { from: string; to: string }[];
  residueRepaired: IdentityResidue[];
  residueSkipped: IdentityResidue[];
  vendorCountBefore: number;
  vendorCountAfter: number;
}

function sumCensus(list: Census[]): Census {
  const out: Census = {};
  for (const c of list) for (const [k, v] of Object.entries(c)) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Move every row naming `from` onto `to`, collapsing rows the survivor already holds. */
async function repointSlug(db: SqlConnection, ref: SlugReference, from: string, to: string): Promise<number> {
  const filter = ref.filter ? ` AND ${ref.filter}` : "";
  let guard = "";
  if (ref.unique?.includes(ref.column)) {
    const parts = ref.unique.map((u) => (u === ref.column ? `x."${u}" = $1` : `x."${u}" IS NOT DISTINCT FROM t."${u}"`));
    guard = ` AND NOT EXISTS (SELECT 1 FROM "${ref.table}" x WHERE ${parts.join(" AND ")})`;
  }
  await db.query(`UPDATE "${ref.table}" AS t SET "${ref.column}"=$1 WHERE t."${ref.column}"=$2${filter}${guard}`, [to, from]);
  const left = (await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM "${ref.table}" AS t WHERE t."${ref.column}"=$1${filter}`, [from])).rows[0]?.n ?? 0;
  if (left > 0) await db.query(`DELETE FROM "${ref.table}" AS t WHERE t."${ref.column}"=$1${filter}`, [from]);
  return left;
}

async function repointOrg(db: SqlConnection, ref: OrgReference, from: string, to: string): Promise<number> {
  let guard = "";
  if (ref.unique?.includes(ref.column)) {
    const parts = ref.unique.map((u) => (u === ref.column ? `x."${u}" = $1` : `x."${u}" IS NOT DISTINCT FROM t."${u}"`));
    guard = ` AND NOT EXISTS (SELECT 1 FROM "${ref.table}" x WHERE ${parts.join(" AND ")})`;
  }
  await db.query(`UPDATE "${ref.table}" AS t SET "${ref.column}"=$1 WHERE t."${ref.column}"=$2${guard}`, [to, from]);
  const left = (await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM "${ref.table}" AS t WHERE t."${ref.column}"=$1`, [from])).rows[0]?.n ?? 0;
  if (left > 0) await db.query(`DELETE FROM "${ref.table}" AS t WHERE t."${ref.column}"=$1`, [from]);
  return left;
}

async function canonicalEntityFor(db: SqlConnection, orgId: string): Promise<string | null> {
  return (await db.query<{ id: string }>(
    `SELECT id FROM canonical_entities WHERE entity_type='organization' AND source_entity_id=$1 ORDER BY updated_at DESC, id LIMIT 1`, [orgId],
  )).rows[0]?.id ?? null;
}

async function addAlias(db: SqlConnection, entityId: string, alias: string, aliasType: string): Promise<void> {
  const normalized = normalizeTerm(alias);
  if (!normalized) return;
  await db.query(
    `INSERT INTO entity_aliases(id,entity_id,alias,normalized_alias,alias_type,source,confidence)
     VALUES($1,$2,$3,$4,$5,'vendor-merge',1)
     ON CONFLICT(entity_id,normalized_alias) DO NOTHING`,
    [`alias:${entityId}:${normalized.replace(/\s+/g, "-")}`, entityId, alias, normalized, aliasType],
  );
}

/**
 * Retire the losing vendor's derived identity onto the survivor's: aliases move (so the observed
 * spelling still resolves), the canonical entity and search document go, and the public registry
 * ID redirects instead of disappearing.
 */
async function retireIdentity(db: SqlConnection, loser: { orgId: string; slug: string; displayName: string }, survivor: { orgId: string; slug: string }): Promise<void> {
  const loserEntity = await canonicalEntityFor(db, loser.orgId);
  const survivorEntity = await canonicalEntityFor(db, survivor.orgId);

  if (loserEntity && survivorEntity && loserEntity !== survivorEntity) {
    // entity_aliases.entity_id CASCADEs on delete, so the observed spellings must move first.
    await db.query(
      `INSERT INTO entity_aliases(id,entity_id,alias,normalized_alias,alias_type,source,confidence)
       SELECT $1 || normalized_alias, $2, alias, normalized_alias, alias_type, source, confidence
         FROM entity_aliases WHERE entity_id=$3
       ON CONFLICT(entity_id,normalized_alias) DO NOTHING`,
      [`alias:${survivorEntity}:`, survivorEntity, loserEntity],
    );
  }
  if (survivorEntity) {
    await addAlias(db, survivorEntity, loser.displayName, "merged-variant");
    await addAlias(db, survivorEntity, loser.slug, "merged-slug");
  }
  if (loserEntity && loserEntity !== survivorEntity) await db.query(`DELETE FROM canonical_entities WHERE id=$1`, [loserEntity]);

  await db.query(`DELETE FROM search_documents WHERE entity_type='organization' AND entity_id=$1`, [loser.orgId]);

  const survivorRegistry = (await db.query<{ registry_id: string }>(
    `SELECT registry_id FROM registry_identifiers WHERE source_entity_type='organization' AND source_entity_id=$1 LIMIT 1`, [survivor.orgId],
  )).rows[0]?.registry_id ?? null;
  const loserRegistry = (await db.query<{ registry_id: string }>(
    `SELECT registry_id FROM registry_identifiers WHERE source_entity_type='organization' AND source_entity_id=$1 LIMIT 1`, [loser.orgId],
  )).rows[0]?.registry_id ?? null;

  if (loserRegistry && survivorRegistry && loserRegistry !== survivorRegistry) {
    await db.query(
      `UPDATE registry_identifiers SET status='redirected', redirects_to=$2, current_entity_id=COALESCE($3,current_entity_id), updated_at=NOW() WHERE registry_id=$1`,
      [loserRegistry, survivorRegistry, survivorEntity],
    );
    await db.query(
      `INSERT INTO registry_identifier_aliases(id,registry_id,alias,normalized_alias,alias_type)
       VALUES($1,$2,$3,$4,'former-slug') ON CONFLICT(registry_id,normalized_alias) DO NOTHING`,
      [newId("regalias"), survivorRegistry, loser.slug, normalizeTerm(loser.slug)],
    );
  }
}

/** Fold the losing profile's own attributes into the survivor so nothing observed is thrown away. */
async function absorbAttributes(db: SqlConnection, survivorId: string, loserId: string): Promise<void> {
  await db.query(
    `UPDATE organizations s SET
       domains = (SELECT COALESCE(jsonb_agg(DISTINCT d), '[]'::jsonb) FROM (
                    SELECT jsonb_array_elements(s.domains) d UNION SELECT jsonb_array_elements(l.domains) FROM organizations l WHERE l.id=$2
                  ) u),
       location = CASE WHEN COALESCE(s.location,'')='' THEN (SELECT l.location FROM organizations l WHERE l.id=$2) ELSE s.location END,
       legal_name = COALESCE(s.legal_name, (SELECT l.legal_name FROM organizations l WHERE l.id=$2)),
       last_observed = GREATEST(s.last_observed, (SELECT l.last_observed FROM organizations l WHERE l.id=$2)),
       updated_at = NOW()
     WHERE s.id=$1`,
    [survivorId, loserId],
  );
}

async function renameVendor(db: SqlConnection, from: string, to: string, displayName: string, orgId: string): Promise<void> {
  await db.query(`UPDATE organizations SET slug=$1, display_name=$2, updated_at=NOW() WHERE id=$3`, [to, displayName, orgId]);
  for (const ref of SLUG_REFERENCES) await repointSlug(db, ref, from, to);
  // The canonical entity's id encodes the slug and entity_aliases points at it, so the row is
  // re-keyed by copy-then-delete rather than an UPDATE the foreign key would refuse.
  const oldEntity = await canonicalEntityFor(db, orgId);
  if (oldEntity && oldEntity !== `entity:organization:${to}`) {
    const newEntity = `entity:organization:${to}`;
    await db.query(
      `INSERT INTO canonical_entities(id,entity_type,canonical_key,display_name,normalized_name,status,attributes,source_entity_type,source_entity_id)
       SELECT $1,entity_type,$2,$3,$4,status,attributes,source_entity_type,source_entity_id FROM canonical_entities WHERE id=$5
       ON CONFLICT(entity_type,canonical_key) DO NOTHING`,
      [newEntity, to, displayName, normalizeTerm(displayName), oldEntity],
    );
    await db.query(
      `INSERT INTO entity_aliases(id,entity_id,alias,normalized_alias,alias_type,source,confidence)
       SELECT $1 || normalized_alias,$2,alias,normalized_alias,alias_type,source,confidence FROM entity_aliases WHERE entity_id=$3
       ON CONFLICT(entity_id,normalized_alias) DO NOTHING`,
      [`alias:${newEntity}:`, newEntity, oldEntity],
    );
    await addAlias(db, newEntity, from, "merged-slug");
    await db.query(`DELETE FROM canonical_entities WHERE id=$1`, [oldEntity]);
    await db.query(`UPDATE registry_identifiers SET current_entity_id=$1, canonical_slug=$2, updated_at=NOW() WHERE source_entity_type='organization' AND source_entity_id=$3`, [newEntity, to, orgId]);
  }
}

/**
 * Execute a plan. DRY RUN BY DEFAULT: with `apply: false` nothing is written and the "after"
 * census is the arithmetic prediction, so the report can be read before anything is at risk.
 * Idempotent — a second run finds no clusters and no residue, and changes nothing.
 *
 * Callers must run this inside a transaction and are expected to rebuild the derived layers
 * afterwards (vendor links, search index, registry projection, vendor grades); the plan's
 * `balanced` flag is the pre-commit check that no evidence went missing.
 */
export async function applyVendorMerges(db: SqlConnection, plan: VendorMergePlan, options: { apply?: boolean } = {}): Promise<ApplyResult> {
  const apply = options.apply === true;
  const merges: MergeOutcome[] = [];
  const renames: { from: string; to: string }[] = [];

  for (const cluster of plan.clusters) {
    const before = sumCensus([cluster.survivor.census, ...cluster.absorbed.map((m) => m.census)]);
    const collapsed: CollapsedRows[] = [];

    if (!apply) {
      merges.push({ cluster: cluster.canonical, survivor: cluster.canonical, absorbed: cluster.absorbed.map((m) => m.slug), before, after: before, collapsed, balanced: true });
      if (cluster.rename) renames.push({ from: cluster.rename.from, to: cluster.rename.to });
      continue;
    }

    if (cluster.rename) {
      await renameVendor(db, cluster.rename.from, cluster.rename.to, cluster.rename.displayName, cluster.survivor.orgId);
      renames.push({ from: cluster.rename.from, to: cluster.rename.to });
    }
    for (const loser of cluster.absorbed) {
      for (const ref of ORG_REFERENCES) {
        const n = await repointOrg(db, ref, loser.orgId, cluster.survivor.orgId);
        if (n > 0) collapsed.push({ table: ref.table, column: ref.column, rows: n });
      }
      for (const ref of SLUG_REFERENCES) {
        const n = await repointSlug(db, ref, loser.slug, cluster.canonical);
        if (n > 0) collapsed.push({ table: ref.table, column: ref.column, rows: n });
      }
      // A link between two profiles that are now one profile is not a link.
      await db.query(`DELETE FROM vendor_links WHERE vendor_slug = linked_slug`);
      await absorbAttributes(db, cluster.survivor.orgId, loser.orgId);
      await retireIdentity(db, { orgId: loser.orgId, slug: loser.slug, displayName: loser.displayName }, { orgId: cluster.survivor.orgId, slug: cluster.canonical });
      await db.query(`DELETE FROM organizations WHERE id=$1`, [loser.orgId]);
    }

    const after = await censusForVendor(db, cluster.canonical, cluster.survivor.orgId);
    const collapsedByKey = new Map<string, number>();
    for (const c of collapsed) collapsedByKey.set(`${c.table}.${c.column}`, (collapsedByKey.get(`${c.table}.${c.column}`) ?? 0) + c.rows);
    const balanced = [...new Set([...Object.keys(before), ...Object.keys(after)])].every(
      (key) => (after[key] ?? 0) === (before[key] ?? 0) - (collapsedByKey.get(key) ?? 0),
    );
    merges.push({ cluster: cluster.canonical, survivor: cluster.canonical, absorbed: cluster.absorbed.map((m) => m.slug), before, after, collapsed, balanced });
  }

  // Residue left by an EARLIER, incomplete merge: repair only what unambiguously resolves to a
  // live vendor, and report the rest rather than guessing.
  const residueRepaired: IdentityResidue[] = [];
  const residueSkipped: IdentityResidue[] = [];
  for (const item of plan.residue) {
    if (!item.resolvesTo) { residueSkipped.push(item); continue; }
    residueRepaired.push(item);
    if (!apply) continue;
    const survivorOrg = (await db.query<{ id: string }>(`SELECT id FROM organizations WHERE slug=$1`, [item.resolvesTo])).rows[0]?.id ?? null;
    if (!survivorOrg) { residueRepaired.pop(); residueSkipped.push(item); continue; }
    const survivorEntity = await canonicalEntityFor(db, survivorOrg);
    if (item.kind === "canonical-entity") {
      if (survivorEntity && survivorEntity !== item.id) {
        await db.query(
          `INSERT INTO entity_aliases(id,entity_id,alias,normalized_alias,alias_type,source,confidence)
           SELECT $1 || normalized_alias,$2,alias,normalized_alias,alias_type,source,confidence FROM entity_aliases WHERE entity_id=$3
           ON CONFLICT(entity_id,normalized_alias) DO NOTHING`,
          [`alias:${survivorEntity}:`, survivorEntity, item.id],
        );
      }
      await db.query(`DELETE FROM canonical_entities WHERE id=$1`, [item.id]);
    } else if (item.kind === "search-document") {
      await db.query(`DELETE FROM search_documents WHERE id=$1`, [item.id]);
    } else {
      const survivorRegistry = (await db.query<{ registry_id: string }>(
        `SELECT registry_id FROM registry_identifiers WHERE source_entity_type='organization' AND source_entity_id=$1 LIMIT 1`, [survivorOrg],
      )).rows[0]?.registry_id ?? null;
      if (!survivorRegistry || survivorRegistry === item.id) { residueRepaired.pop(); residueSkipped.push(item); continue; }
      await db.query(
        `UPDATE registry_identifiers SET status='redirected', redirects_to=$2, current_entity_id=COALESCE($3,current_entity_id), updated_at=NOW() WHERE registry_id=$1`,
        [item.id, survivorRegistry, survivorEntity],
      );
    }
  }

  const vendorCountAfter = apply
    ? (await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM organizations WHERE organization_type='vendor'`)).rows[0]?.n ?? 0
    : plan.vendorCountAfter;

  return { dryRun: !apply, merges, renames, residueRepaired, residueSkipped, vendorCountBefore: plan.vendorCountBefore, vendorCountAfter };
}
