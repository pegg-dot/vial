// What the site will actually show. Computes the VialGrade for every tracked vendor from the
// REAL database and prints the distribution — the honest answer to "is this thing useful yet?"
import { getDatabase } from "../src/server/db/client.ts";
import { composeVerdictForVendorSlug } from "../src/server/verify/trust-graph.ts";
import { gradeFromVerdict } from "../src/server/verify/grade.ts";
import { getVendorBySlug } from "../src/server/catalog/repository.ts";

const db = await getDatabase();
const vendors = (await db.query(
  `SELECT slug,display_name AS name FROM organizations WHERE origin='live' AND organization_type='vendor' ORDER BY slug`,
)).rows;

console.log(`\n=== VialGrade distribution across ${vendors.length} live vendors ===\n`);

const counts = new Map();
const rows = [];
for (const { slug, name } of vendors) {
  const result = await composeVerdictForVendorSlug(slug);
  if (!result) continue;
  const vendor = await getVendorBySlug(slug);
  const grade = gradeFromVerdict(result.composed, { coaCount: vendor?.coaCount ?? 0 });
  const key = grade.letter ?? "not graded";
  counts.set(key, (counts.get(key) ?? 0) + 1);
  rows.push({ name, slug, letter: key, verdict: result.composed.verdict, coa: vendor?.coaCount ?? 0, weighed: result.composed.weighed, verified: result.composed.verifiedCount });
}

const order = ["A", "A-", "B+", "B", "C+", "C", "C-", "D", "F", "not graded"];
for (const letter of order) {
  const n = counts.get(letter) ?? 0;
  if (n === 0) continue;
  const bar = "█".repeat(Math.min(50, n));
  console.log(`  ${letter.padEnd(11)} ${String(n).padStart(4)}  ${bar}`);
}

const graded = rows.filter(r => r.letter !== "not graded").length;
console.log(`\n  graded: ${graded}/${rows.length} (${rows.length ? Math.round((graded / rows.length) * 100) : 0}%)`);

console.log(`\n=== Vendors carrying independent lab tests (the seam that can reach an A) ===\n`);
const tested = rows.filter(r => r.coa > 0).sort((a, b) => b.coa - a.coa);
for (const r of tested.slice(0, 15)) {
  console.log(`  ${r.letter.padEnd(11)} ${r.name.slice(0, 34).padEnd(36)} ${String(r.coa).padStart(4)} COAs · ${r.weighed} signals · ${r.verified} verified`);
}
console.log(`\n  ${tested.length}/${rows.length} vendors have at least one independent lab test\n`);
process.exit(0);
