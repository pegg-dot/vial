process.env.VIAL_PGLITE_MEMORY="true";
process.env.VIAL_SEED_FIXTURES="true";
process.env.VIAL_SEED_DEMO_ACCOUNTS="true";
process.env.VIAL_SESSION_SECRET="evidence-v6-audit-session-secret-at-least-32";
process.env.VIAL_PRIVACY_HASH_SECRET="evidence-v6-audit-privacy-secret-at-least-32";

const { getDatabase, resetDatabaseForTests } = await import("../src/server/db/client.ts");
const {
  ensureEvidenceNetworkSeed,
  getEvidenceNetworkDashboard,
  getLaboratoryContext,
  getPublicPassport,
  verifyCustodyChain,
} = await import("../src/server/evidence-network/repository.ts");

const failures = [];
try {
  await resetDatabaseForTests();
  globalThis.__vialEvidenceSeedPromise = undefined;
  await ensureEvidenceNetworkSeed();
  const db = await getDatabase();
  const version = Number((await db.query(`SELECT MAX(version) version FROM schema_migrations`)).rows[0]?.version ?? 0);
  if (version < 8) failures.push(`Expected schema version 8, got ${version}`);

  const dashboard = await getEvidenceNetworkDashboard();
  const counts = dashboard.counts ?? {};
  for (const [field, minimum] of Object.entries({ laboratories: 1, methods: 5, samples: 2, custody_events: 8, issued_reports: 2, passports: 1, conflicts: 1, programs: 1 })) {
    if (Number(counts[field] ?? 0) < minimum) failures.push(`Expected at least ${minimum} ${field}, got ${counts[field] ?? 0}`);
  }

  const context = await getLaboratoryContext("elena@aperture.test");
  if (!context) failures.push("Demo laboratory context missing");
  if (context && context.methods.length !== 5) failures.push(`Expected five method-scoped records, got ${context.methods.length}`);
  if (context && context.methods.filter((row) => row.accreditation_covered).length !== 3) failures.push("Accreditation coverage was not separated by method");

  for (const sample of context?.samples ?? []) {
    const verification = await verifyCustodyChain(String(sample.id));
    if (!verification.valid) failures.push(`Custody chain invalid for ${sample.id} at ${verification.brokenAt}`);
  }

  const passport = await getPublicPassport("hx-bpc-2607");
  if (!passport) failures.push("Published batch passport missing");
  if (passport) {
    const dimensions = typeof passport.passport.dimensions === "string" ? JSON.parse(passport.passport.dimensions) : passport.passport.dimensions;
    if (dimensions?.identity?.status !== "established") failures.push("Identity dimension was not established");
    if (dimensions?.quantity?.status !== "conflicting") failures.push("Quantity conflict was not preserved");
    const limitations = typeof passport.passport.limitations === "string" ? JSON.parse(passport.passport.limitations) : passport.passport.limitations;
    if (!JSON.stringify(limitations).toLowerCase().includes("sterility")) failures.push("Passport did not preserve the sterility unknown");
    if (!JSON.stringify(limitations).toLowerCase().includes("endotoxin")) failures.push("Passport did not preserve the endotoxin unknown");
    if (passport.reports.length < 2) failures.push("Passport did not retain its report history");
    if (passport.conflicts.length < 1) failures.push("Passport conflict record missing");
  }

  const invalidActiveLinks = Number((await db.query(`SELECT COUNT(*) count FROM passport_evidence_links pel JOIN laboratory_reports lr ON lr.id=pel.report_id WHERE pel.status='active' AND lr.status IN ('revoked','superseded')`)).rows[0]?.count ?? 0);
  if (invalidActiveLinks > 0) failures.push(`${invalidActiveLinks} active passport links point to inactive reports`);

  const directPublishedProposals = Number((await db.query(`SELECT COUNT(*) count FROM laboratory_work_proposals WHERE status IN ('issued','published','approved')`)).rows[0]?.count ?? 0);
  if (directPublishedProposals > 0) failures.push("Proposal-only laboratory automation bypassed human issue controls");

  if (failures.length) {
    console.error("VIAL 6.0 evidence-network audit failed:\n- " + failures.join("\n- "));
    process.exitCode = 1;
  } else {
    console.log("VIAL 6.0 evidence-network audit passed: method scope, custody integrity, structured reports, report lifecycle, multidimensional passports, conflict preservation, explicit unknowns, and proposal-only automation are intact.");
  }
} finally {
  await resetDatabaseForTests();
  globalThis.__vialEvidenceSeedPromise = undefined;
}
