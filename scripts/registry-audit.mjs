process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SEED_FIXTURES = "true";
process.env.VIAL_SEED_DEMO_ACCOUNTS = "true";
process.env.VIAL_SESSION_SECRET = "registry-audit-session-secret-at-least-32-chars";
process.env.VIAL_PRIVACY_HASH_SECRET = "registry-audit-privacy-secret-at-least-32-chars";

const { getDatabase, resetDatabaseForTests } = await import("../src/server/db/client.ts");
const { CURRENT_SCHEMA_VERSION } = await import("../src/server/db/migrations.ts");
const { getRegistryRecord, resolveToRegistry } = await import("../src/server/registry/repository.ts");
const { ensureEvidenceNetworkSeed, recomputePassport, getBatchStandardRecord } = await import("../src/server/evidence-network/repository.ts");
const { getReputationRecord, getVendorReputationBySlug } = await import("../src/server/reputation/repository.ts");
const { API_SCOPES } = await import("../src/server/api-access/keys.ts");

const failures = [];
const check = (cond, message) => { if (!cond) failures.push(message); };

try {
  await resetDatabaseForTests();
  globalThis.__vialEvidenceSeedPromise = undefined;
  globalThis.__vialSellerOpsSeedPromise = undefined;
  await ensureEvidenceNetworkSeed();
  const db = await getDatabase();

  // 1. Contract discipline — schema version + contiguous migrations.
  const versions = (await db.query(`SELECT version FROM schema_migrations ORDER BY version`)).rows.map(r => Number(r.version));
  check(versions.length === CURRENT_SCHEMA_VERSION, `Migration count ${versions.length} != CURRENT_SCHEMA_VERSION ${CURRENT_SCHEMA_VERSION}`);
  check(versions.every((v, i) => v === i + 1), `Migration versions are not contiguous: ${versions.join(",")}`);
  check(CURRENT_SCHEMA_VERSION >= 13, `Expected schema >= 13, got ${CURRENT_SCHEMA_VERSION}`);

  // 2. Identity registry — one authoritative VIAL ID per real entity, spines unified.
  const compound = await getRegistryRecord("vial:compound:bpc-157");
  check(compound && compound.provenanceUrl === "/compounds/bpc-157", "Compound VIAL ID did not resolve");
  const vendor = await getRegistryRecord("vial:vendor:northstar-research");
  check(vendor && vendor.entityType === "vendor", "Vendor VIAL ID did not resolve");
  const lab = await getRegistryRecord("vial:lab:aperture-analytical");
  check(lab && lab.sourceEntityType === "laboratory_profile", "Lab VIAL ID not sourced from the real laboratory record (spines not unified)");
  const batch = await getRegistryRecord("vial:batch:hx-bpc-2607");
  check(batch && batch.sourceEntityType === "batch_passport", "Batch VIAL ID not sourced from the real passport");

  // 3. Resolution flywheel — a messy alias maps to the canonical ID.
  const resolved = await resolveToRegistry("BPC157", "compound");
  check(resolved.best?.vialId === "vial:compound:bpc-157", "Alias resolution did not reach the canonical compound ID");

  // 4. Versioned batch history + decomposed confidence (no black box).
  const batchRecord = await getBatchStandardRecord("vial:batch:hx-bpc-2607");
  check(batchRecord && batchRecord.versions.length >= 1, "Batch passport has no immutable version history");
  check(batchRecord && batchRecord.confidenceBasis && batchRecord.confidenceBasis.samplingLevel, "Confidence was not decomposed into its basis");
  check(batchRecord && batchRecord.confidenceBasis.dimensionSummary.conflicting.includes("quantity"), "Conflict-preserving doctrine lost from the batch standard");
  const beforeVersions = Number((await db.query(`SELECT MAX(version) v FROM passport_versions WHERE passport_id='passport:hx-bpc-2607'`)).rows[0]?.v ?? 0);
  await recomputePassport("passport:hx-bpc-2607");
  const afterVersions = Number((await db.query(`SELECT MAX(version) v FROM passport_versions WHERE passport_id='passport:hx-bpc-2607'`)).rows[0]?.v ?? 0);
  check(beforeVersions === afterVersions, "Idempotent recompute appended a spurious passport version");

  // 5. Reputation standard — decomposable, provenance-linked, NEVER a composite score.
  const rep = await getVendorReputationBySlug("northstar-research");
  check(rep && rep.methodologyVersion === "reputation-v1", "Vendor reputation methodology version missing");
  check(rep && !("score" in rep) && !("overallScore" in rep) && !("rating" in rep), "Reputation record exposed a composite score — doctrine violation");
  const dims = rep ? Object.fromEntries(rep.dimensions.map(d => [d.key, d])) : {};
  check(dims.documentation_currency?.status === "established", "Documentation currency dimension missing/not established");
  check(dims.operational_reliability?.status === "unknown", "Operational reliability should be 'unknown' for a non-storefront vendor (fabricated-score fix)");
  for (const d of rep?.dimensions ?? []) check(d.provenance && d.basis && d.basis.length > 0, `Reputation dimension ${d.key} lacks provenance/basis`);
  const labRep = await getReputationRecord("vial:lab:aperture-analytical");
  check(labRep && labRep.subjectType === "lab" && !("score" in labRep), "Lab integrity record missing or scored");

  // 6. Boundary — every public standard scope is read-only (no bearer publish path).
  check(API_SCOPES.every(s => s.endsWith(":read")), `A non-read public scope exists: ${API_SCOPES.join(",")}`);
  check(API_SCOPES.includes("identity:read") && API_SCOPES.includes("reputation:read"), "Standard scopes identity:read/reputation:read missing");

  // 7. The fabricated vendor scores must no longer be rendered as authoritative.
  const vendorPage = await (await import("node:fs/promises")).readFile(new URL("../src/app/vendors/[slug]/page.tsx", import.meta.url), "utf8");
  check(!/Support signal/.test(vendorPage) && !/Median shipping/.test(vendorPage), "Vendor page still renders a fabricated support/shipping score");

  if (failures.length) {
    console.error("VIAL 10.0 registry/standards audit FAILED:\n- " + failures.join("\n- "));
    process.exitCode = 1;
  } else {
    console.log("VIAL 10.0 registry/standards audit passed: unified identity spine, resolvable VIAL IDs, alias flywheel, versioned batch history with decomposed confidence, conflict preservation, composed reputation records with no black-box score, read-only public scopes, and contract-discipline migrations are intact.");
  }
} finally {
  await resetDatabaseForTests();
  globalThis.__vialEvidenceSeedPromise = undefined;
  globalThis.__vialSellerOpsSeedPromise = undefined;
}
