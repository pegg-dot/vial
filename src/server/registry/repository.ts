import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { normalizeTerm } from "@/server/market-data/normalize";
import { resolveEntityLabel, type CanonicalEntityType } from "@/server/market-data/graph";

// The public identity namespaces VialGrade mints stable IDs in. These are the category
// standard others cite — `vialgrade:compound:bpc-157`, `vialgrade:lab:aperture-analytical`.
export type RegistryEntityType = "compound" | "vendor" | "product" | "lab" | "batch" | "source";

const CANONICAL_TYPE: Record<RegistryEntityType, CanonicalEntityType> = {
  compound: "compound",
  vendor: "organization",
  product: "product",
  lab: "laboratory",
  batch: "batch",
  source: "source",
};

export interface RegistryRecord {
  registryId: string;
  entityType: RegistryEntityType;
  displayName: string;
  slug: string;
  status: string;
  redirectsTo: string | null;
  sourceEntityType: string;
  sourceEntityId: string;
  provenanceUrl: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  relationships: { relation: string; registryId: string | null; displayName: string; entityType: string }[];
}

function slugify(value: string): string {
  return normalizeTerm(value).replace(/\s+/g, "-");
}

// Route params may already be decoded by the framework; a second decode of a bare '%'
// throws URIError. Degrade to the raw value so an unknown ID becomes a clean 404, not a 500.
export function decodeRegistryId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// A registry ID's provenance URL is the canonical VialGrade page for that record — the
// human-readable authority a citation points a reader to.
export function provenanceUrlFor(entityType: RegistryEntityType, slug: string): string {
  switch (entityType) {
    case "compound": return `/compounds/${slug}`;
    case "vendor": return `/vendors/${slug}`;
    case "product": return `/products/${slug}`;
    case "lab": return `/labs/${slug}`;
    case "batch": return `/passports/${slug}`;
    case "source": return "";
  }
}

interface RegistryRow extends QueryResultRow {
  registry_id: string;
  entity_type: RegistryEntityType;
  source_entity_type: string;
  source_entity_id: string;
  current_entity_id: string | null;
  display_name: string;
  canonical_slug: string;
  provenance_url: string;
  status: string;
  redirects_to: string | null;
  attributes: unknown;
}

export interface MintInput {
  entityType: RegistryEntityType;
  sourceEntityType: string;
  sourceEntityId: string;
  displayName: string;
  slug: string;
  currentEntityId?: string | null;
  attributes?: Record<string, unknown>;
}

// Idempotent minter. A VialGrade ID is keyed on the stable *source identity*
// (source_entity_type + source_entity_id), NOT the slug — so a rename reuses the same
// public ID instead of orphaning it. When the slug changes, the former slug is recorded
// as an alias so citations to the old identifier still resolve.
export async function mintRegistryId(db: SqlConnection, input: MintInput): Promise<{ registryId: string; minted: boolean }> {
  const existing = (await db.query<RegistryRow>(
    `SELECT * FROM registry_identifiers WHERE source_entity_type=$1 AND source_entity_id=$2`,
    [input.sourceEntityType, input.sourceEntityId],
  )).rows[0];

  const provenanceUrl = provenanceUrlFor(input.entityType, input.slug);
  const attributes = JSON.stringify(input.attributes ?? {});

  if (existing) {
    if (existing.canonical_slug !== input.slug) {
      // Preserve the prior slug as a resolvable former identifier before it changes.
      await db.query(
        `INSERT INTO registry_identifier_aliases(id,registry_id,alias,normalized_alias,alias_type)
         VALUES($1,$2,$3,$4,'former-slug') ON CONFLICT(registry_id,normalized_alias) DO NOTHING`,
        [newId("regalias"), existing.registry_id, existing.canonical_slug, normalizeTerm(existing.canonical_slug)],
      );
    }
    await db.query(
      `UPDATE registry_identifiers SET display_name=$2,canonical_slug=$3,provenance_url=$4,
         current_entity_id=COALESCE($5,current_entity_id),attributes=$6::jsonb,updated_at=NOW()
       WHERE registry_id=$1`,
      [existing.registry_id, input.displayName, input.slug, provenanceUrl, input.currentEntityId ?? null, attributes],
    );
    return { registryId: existing.registry_id, minted: false };
  }

  // Mint a fresh, human-legible ID, suffixing on collision with a *different* source. The
  // canonical_slug carries the SAME suffix so the collided entity stays resolvable by its
  // own identity (the base slug still points a reader to the shared source page).
  const base = `vialgrade:${input.entityType}:${input.slug}`;
  let registryId = base;
  let canonicalSlug = input.slug;
  for (let attempt = 2; ; attempt += 1) {
    const clash = (await db.query<{ registry_id: string }>(`SELECT registry_id FROM registry_identifiers WHERE registry_id=$1`, [registryId])).rows[0];
    if (!clash) break;
    if (attempt > 999) throw new Error(`Unable to mint a unique VialGrade ID for ${base}`);
    registryId = `${base}-${attempt}`;
    canonicalSlug = `${input.slug}-${attempt}`;
  }
  await db.query(
    `INSERT INTO registry_identifiers(registry_id,entity_type,source_entity_type,source_entity_id,current_entity_id,display_name,canonical_slug,provenance_url,attributes)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [registryId, input.entityType, input.sourceEntityType, input.sourceEntityId, input.currentEntityId ?? null, input.displayName, canonicalSlug, provenanceUrl, attributes],
  );
  return { registryId, minted: true };
}

function toAttributes(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// Resolves a public VialGrade ID to its full record, following a redirect (merge) one hop.
export async function getRegistryRecord(registryId: string, connection?: SqlConnection): Promise<RegistryRecord | null> {
  const db = connection ?? (await getDatabase());
  let row = (await db.query<RegistryRow>(`SELECT * FROM registry_identifiers WHERE registry_id=$1`, [registryId])).rows[0];
  // A former identifier — a pre-VialGrade `vial:…` citation, or a slug that has since
  // moved — must still land on its record. The registry promises durable IDs, so an exact
  // miss falls back to the alias index rather than 404ing a published citation.
  if (!row) {
    row = (await db.query<RegistryRow>(
      `SELECT ri.* FROM registry_identifier_aliases a
       JOIN registry_identifiers ri ON ri.registry_id=a.registry_id
       WHERE a.normalized_alias=$1 ORDER BY a.created_at LIMIT 1`,
      [normalizeTerm(registryId)],
    )).rows[0];
    if (row) return getRegistryRecord(row.registry_id, db);
  }
  if (!row) return null;
  if (row.status === "redirected" && row.redirects_to && row.redirects_to !== registryId) {
    return getRegistryRecord(row.redirects_to, db);
  }
  const aliases = (await db.query<{ alias: string }>(`SELECT alias FROM registry_identifier_aliases WHERE registry_id=$1 ORDER BY created_at`, [registryId])).rows.map(r => r.alias);
  const relationships = row.current_entity_id
    ? (await db.query<{ relation_type: string; to_entity_id: string; display_name: string; entity_type: string; registry_id: string | null }>(
        `SELECT r.relation_type,r.to_entity_id,e.display_name,e.entity_type,ri.registry_id
         FROM entity_relationships r
         JOIN canonical_entities e ON e.id=r.to_entity_id
         LEFT JOIN registry_identifiers ri ON ri.current_entity_id=e.id
         WHERE r.from_entity_id=$1 AND r.status='confirmed' ORDER BY r.relation_type LIMIT 40`,
        [row.current_entity_id],
      )).rows.map(r => ({ relation: r.relation_type, registryId: r.registry_id, displayName: r.display_name, entityType: r.entity_type }))
    : [];
  return {
    registryId: row.registry_id,
    entityType: row.entity_type,
    displayName: row.display_name,
    slug: row.canonical_slug,
    status: row.status,
    redirectsTo: row.redirects_to,
    sourceEntityType: row.source_entity_type,
    sourceEntityId: row.source_entity_id,
    provenanceUrl: row.provenance_url,
    aliases,
    attributes: toAttributes(row.attributes),
    relationships,
  };
}

export interface RegistryResolution {
  best: { registryId: string; displayName: string; entityType: RegistryEntityType; score: number; matchedOn: string } | null;
  candidates: { registryId: string; displayName: string; entityType: RegistryEntityType; score: number }[];
}

// Maps a messy real-world label (a vendor's product string, a former slug, a typo)
// onto a canonical VialGrade ID — the flywheel that turns every observation into resolution.
export async function resolveToRegistry(label: string, type?: RegistryEntityType, connection?: SqlConnection): Promise<RegistryResolution> {
  const db = connection ?? (await getDatabase());
  const normalized = normalizeTerm(label);
  const slug = slugify(label);

  // 1. Exact current-slug match in the registry.
  const direct = (await db.query<RegistryRow>(
    `SELECT * FROM registry_identifiers WHERE canonical_slug=$1 AND status='active' ${type ? "AND entity_type=$2" : ""} ORDER BY minted_at LIMIT 1`,
    type ? [slug, type] : [slug],
  )).rows[0];
  if (direct) return { best: { registryId: direct.registry_id, displayName: direct.display_name, entityType: direct.entity_type, score: 1, matchedOn: direct.canonical_slug }, candidates: [] };

  // 2. Former-slug / alias match.
  const alias = (await db.query<RegistryRow & { matched_alias: string }>(
    `SELECT ri.*,a.alias matched_alias FROM registry_identifier_aliases a
     JOIN registry_identifiers ri ON ri.registry_id=a.registry_id
     WHERE a.normalized_alias=$1 AND ri.status='active' ${type ? "AND ri.entity_type=$2" : ""} ORDER BY a.created_at LIMIT 1`,
    type ? [normalized, type] : [normalized],
  )).rows[0];
  if (alias) return { best: { registryId: alias.registry_id, displayName: alias.display_name, entityType: alias.entity_type, score: 0.97, matchedOn: alias.matched_alias }, candidates: [] };

  // 3. Fuzzy match through the canonical entity graph, mapped back to a VialGrade ID.
  const canonicalType = type ? CANONICAL_TYPE[type] : undefined;
  const resolution = await resolveEntityLabel(label, canonicalType);
  const candidates: RegistryResolution["candidates"] = [];
  let best: RegistryResolution["best"] = null;
  for (const candidate of resolution.candidates) {
    const reg = (await db.query<RegistryRow>(`SELECT * FROM registry_identifiers WHERE current_entity_id=$1 AND status='active' LIMIT 1`, [candidate.entity.id])).rows[0];
    if (!reg) continue;
    const mapped = { registryId: reg.registry_id, displayName: reg.display_name, entityType: reg.entity_type, score: candidate.score };
    candidates.push(mapped);
    if (!best) best = { ...mapped, matchedOn: candidate.matchedOn };
  }
  return { best, candidates };
}

// Projects the market-data spine (vendors, compounds, products) into the public registry.
// Idempotent — reruns update, never duplicate.
export async function projectMarketDataRegistry(connection?: SqlConnection) {
  const db = connection ?? (await getDatabase());
  // Order newest-first and de-dupe by source identity: a rename leaves an orphaned OLD
  // canonical_entities row with the same source_entity_id, so we must project only the
  // CURRENT (most-recently-updated) row — a stale row must never regress the record.
  const rows = (await db.query<QueryResultRow & { id: string; entity_type: string; canonical_key: string; display_name: string; attributes: unknown; source_entity_type: string; source_entity_id: string }>(
    `SELECT id,entity_type,canonical_key,display_name,attributes,source_entity_type,source_entity_id
     FROM canonical_entities WHERE source_entity_id IS NOT NULL AND entity_type IN ('organization','compound','product')
     ORDER BY updated_at DESC, id`,
  )).rows;
  const seen = new Set<string>();
  let minted = 0;
  for (const row of rows) {
    // Only real vendor organizations become vendor IDs; laboratories are minted from the
    // evidence-network record, and any other org type is out of the market-data scope
    // (which the reputation loader also assumes — keep the two aligned).
    if (row.entity_type === "organization" && String(toAttributes(row.attributes).organizationType ?? "") !== "vendor") continue;
    const sourceKey = `${row.source_entity_type}:${row.source_entity_id}`;
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    const entityType: RegistryEntityType = row.entity_type === "compound" ? "compound" : row.entity_type === "product" ? "product" : "vendor";
    const result = await mintRegistryId(db, {
      entityType,
      sourceEntityType: row.source_entity_type ?? row.entity_type,
      sourceEntityId: row.source_entity_id,
      displayName: row.display_name,
      slug: row.canonical_key,
      currentEntityId: row.id,
      attributes: toAttributes(row.attributes),
    });
    if (result.minted) minted += 1;
  }
  return { count: seen.size, minted };
}

// Projects the evidence spine (real laboratories, published batch passports) into the
// SAME registry — unifying the two identity spines the audit found unreconciled.
export async function projectEvidenceRegistry(connection?: SqlConnection) {
  const db = connection ?? (await getDatabase());
  const labs = (await db.query<QueryResultRow & { id: string; slug: string; display_name: string; organization_id: string; accreditation_status: string; status: string }>(
    `SELECT id,slug,display_name,organization_id,accreditation_status,status FROM laboratory_profiles WHERE status IN ('sandbox','active')`,
  )).rows;
  for (const lab of labs) {
    await mintRegistryId(db, {
      entityType: "lab",
      sourceEntityType: "laboratory_profile",
      sourceEntityId: lab.id,
      displayName: lab.display_name,
      slug: lab.slug,
      attributes: { accreditationStatus: lab.accreditation_status, organizationId: lab.organization_id, status: lab.status },
    });
  }
  const batches = (await db.query<QueryResultRow & { id: string; slug: string; declared_batch_code: string; vendor_id: string | null; product_id: string | null; evidence_confidence: string | number; status: string }>(
    `SELECT id,slug,declared_batch_code,vendor_id,product_id,evidence_confidence,status FROM batch_passports WHERE status='published'`,
  )).rows;
  for (const batch of batches) {
    await mintRegistryId(db, {
      entityType: "batch",
      sourceEntityType: "batch_passport",
      sourceEntityId: batch.id,
      displayName: `Batch ${batch.declared_batch_code}`,
      slug: batch.slug,
      attributes: { declaredBatchCode: batch.declared_batch_code, vendorId: batch.vendor_id, productId: batch.product_id, evidenceConfidence: Number(batch.evidence_confidence), status: batch.status },
    });
  }
  return { labs: labs.length, batches: batches.length };
}
