import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests, getDatabase } from "@/server/db/client";
import { ensureEvidenceNetworkSeed } from "@/server/evidence-network/repository";
import { getRegistryRecord, resolveToRegistry, mintVialId, projectMarketDataRegistry } from "@/server/registry/repository";

beforeEach(async () => {
  process.env.VIAL_PGLITE_MEMORY = "true";
  process.env.VIAL_SEED_FIXTURES = "true";
  process.env.VIAL_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});

describe("VIAL 10.0 identity registry", () => {
  it("mints stable, human-legible public VIAL IDs for compounds and vendors", async () => {
    const compound = await getRegistryRecord("vial:compound:bpc-157");
    expect(compound).toBeTruthy();
    expect(compound!.entityType).toBe("compound");
    expect(compound!.displayName.toLowerCase()).toContain("bpc-157");
    expect(compound!.sourceEntityType).toBe("compound");
    expect(compound!.provenanceUrl).toBe("/compounds/bpc-157");

    const vendor = await getRegistryRecord("vial:vendor:northstar-research");
    expect(vendor).toBeTruthy();
    expect(vendor!.entityType).toBe("vendor");
    expect(vendor!.provenanceUrl).toBe("/vendors/northstar-research");
  });

  it("unifies the evidence spine — the real lab and batch get authoritative VIAL IDs from real records", async () => {
    await ensureEvidenceNetworkSeed();

    const lab = await getRegistryRecord("vial:lab:aperture-analytical");
    expect(lab).toBeTruthy();
    expect(lab!.entityType).toBe("lab");
    // Sourced from the REAL laboratory_profiles record, not a report_issuer string.
    expect(lab!.sourceEntityType).toBe("laboratory_profile");
    expect(lab!.sourceEntityId).toBe("lab:aperture");
    expect(lab!.provenanceUrl).toBe("/labs/aperture-analytical");

    const batch = await getRegistryRecord("vial:batch:hx-bpc-2607");
    expect(batch).toBeTruthy();
    expect(batch!.entityType).toBe("batch");
    expect(batch!.sourceEntityType).toBe("batch_passport");
    expect(batch!.attributes.declaredBatchCode).toBe("HX-BPC-2607");
    expect(batch!.provenanceUrl).toBe("/passports/hx-bpc-2607");
  });

  it("resolves a messy alias to a canonical VIAL ID", async () => {
    const resolution = await resolveToRegistry("BPC157", "compound");
    expect(resolution.best).toBeTruthy();
    expect(resolution.best!.vialId).toBe("vial:compound:bpc-157");
    expect(resolution.best!.score).toBeGreaterThan(0.9);
  });

  it("keeps the VIAL ID stable across a slug/display rename and records the former slug", async () => {
    const db = await getDatabase();
    const first = await mintVialId(db, {
      entityType: "compound",
      sourceEntityType: "compound",
      sourceEntityId: "cmp:renametest",
      displayName: "Rename Test",
      slug: "rename-test",
    });
    expect(first.minted).toBe(true);

    const second = await mintVialId(db, {
      entityType: "compound",
      sourceEntityType: "compound",
      sourceEntityId: "cmp:renametest",
      displayName: "Rename Test Renamed",
      slug: "rename-test-renamed",
    });
    expect(second.minted).toBe(false);
    // Same immutable id despite the slug change.
    expect(second.vialId).toBe(first.vialId);

    // The former slug still resolves to the same record.
    const byFormer = await resolveToRegistry("rename-test", "compound");
    expect(byFormer.best?.vialId).toBe(first.vialId);
  });

  it("is idempotent — re-projecting mints no new identifiers", async () => {
    const db = await getDatabase();
    const before = Number((await db.query<{ count: string | number }>(`SELECT COUNT(*) count FROM registry_identifiers`)).rows[0]!.count);
    await projectMarketDataRegistry(db);
    const after = Number((await db.query<{ count: string | number }>(`SELECT COUNT(*) count FROM registry_identifiers`)).rows[0]!.count);
    expect(after).toBe(before);
    expect(before).toBeGreaterThan(0);
  });

  it("keeps the current slug after a rename and stays idempotent (no orphan-row ping-pong)", async () => {
    const db = await getDatabase();
    const before = await getRegistryRecord("vial:compound:bpc-157");
    expect(before).toBeTruthy();
    // Simulate rebuildCanonicalGraph leaving an orphaned OLD canonical row after a rename:
    // same source_entity_id, OLDER updated_at, a stale slug/name.
    await db.query(
      `INSERT INTO canonical_entities(id,entity_type,canonical_key,display_name,normalized_name,source_entity_type,source_entity_id,updated_at)
       VALUES('entity:compound:stale-bpc','compound','stale-bpc','Stale BPC','stale bpc','compound',$1,'2020-01-01T00:00:00Z')
       ON CONFLICT(entity_type,canonical_key) DO NOTHING`, [before!.sourceEntityId]);
    await projectMarketDataRegistry(db);
    const after1 = await getRegistryRecord("vial:compound:bpc-157");
    expect(after1!.slug).toBe("bpc-157"); // must not regress to the stale slug
    expect(after1!.provenanceUrl).toBe("/compounds/bpc-157");
    const aliasCount = after1!.aliases.length;
    await projectMarketDataRegistry(db); // rerun must be idempotent
    const after2 = await getRegistryRecord("vial:compound:bpc-157");
    expect(after2!.slug).toBe("bpc-157");
    expect(after2!.aliases.length).toBe(aliasCount); // no alias growth on rerun
  });

  it("resolves a collided second entity by its own suffixed slug", async () => {
    const db = await getDatabase();
    const a = await mintVialId(db, { entityType: "compound", sourceEntityType: "compound", sourceEntityId: "cmp:collide-a", displayName: "Collide A", slug: "collide" });
    const b = await mintVialId(db, { entityType: "compound", sourceEntityType: "compound", sourceEntityId: "cmp:collide-b", displayName: "Collide B", slug: "collide" });
    expect(a.vialId).toBe("vial:compound:collide");
    expect(b.vialId).toBe("vial:compound:collide-2");
    // The collided second entity must be resolvable by its own (suffixed) identity.
    const resolved = await resolveToRegistry("collide-2", "compound");
    expect(resolved.best?.vialId).toBe("vial:compound:collide-2");
  });

  it("does not resolve a former slug to a redirected (tombstone) identifier", async () => {
    const db = await getDatabase();
    const minted = await mintVialId(db, { entityType: "compound", sourceEntityType: "compound", sourceEntityId: "cmp:tomb", displayName: "Tomb", slug: "tomb-current" });
    await db.query(`INSERT INTO registry_identifier_aliases(id,vial_id,alias,normalized_alias,alias_type) VALUES('regalias:tomb',$1,'legacy-name','legacy name','former-slug')`, [minted.vialId]);
    await db.query(`UPDATE registry_identifiers SET status='redirected',redirects_to='vial:compound:merge-target' WHERE vial_id=$1`, [minted.vialId]);
    const resolved = await resolveToRegistry("legacy-name", "compound");
    expect(resolved.best?.vialId).not.toBe(minted.vialId); // must not surface the dead tombstone
  });
});
