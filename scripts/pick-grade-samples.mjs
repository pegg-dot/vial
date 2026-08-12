// Step 1 of the grade screenshot flow: choose one real vendor per grade band and write the
// picks to disk. Runs as its own process so the single-writer PGlite file lock is released
// before the dev server opens the same database.
import { writeFile } from "node:fs/promises";
import { getDatabase, resetDatabaseForTests } from "../src/server/db/client.ts";
import { composeVerdictForVendorSlug } from "../src/server/verify/trust-graph.ts";
import { gradeFromVerdict } from "../src/server/verify/grade.ts";
import { getVendorBySlug } from "../src/server/catalog/repository.ts";

const out = process.argv[2] ?? "audits/screenshots/grade/picks.json";
const db = await getDatabase();
const vendors = (await db.query(
  `SELECT slug FROM organizations WHERE origin='live' AND organization_type='vendor' ORDER BY slug`,
)).rows;

const picks = {};
for (const { slug } of vendors) {
  const result = await composeVerdictForVendorSlug(slug);
  if (!result) continue;
  const vendor = await getVendorBySlug(slug);
  const grade = gradeFromVerdict(result.composed, { coaCount: vendor?.coaCount ?? 0 });
  const key = grade.letter ?? "ungraded";
  if (!picks[key]) picks[key] = { slug, name: vendor?.name ?? slug, coa: vendor?.coaCount ?? 0, verdict: result.composed.verdict };
}

await writeFile(out, JSON.stringify(picks, null, 2));
for (const [letter, v] of Object.entries(picks)) {
  console.log(`  ${letter.padEnd(9)} ${v.name} (/vendors/${v.slug}, ${v.coa} COAs, ${v.verdict})`);
}
// Release the file lock so the dev server can take it.
await resetDatabaseForTests();
process.exit(0);
