// Live truth-check: does the site contradict ITSELF about a real, named company?
//
// For a trust product the business-ending failure is confidently publishing something false about
// a real vendor. Green unit tests cannot catch this class — the code is correct and the DATA
// disagrees with itself. This walks every live vendor and reports contradictions between the
// composed verdict, the published description, and the underlying records.
import { getDatabase, resetDatabaseForTests } from "../src/server/db/client.ts";
import { composeVerdictForVendorSlug } from "../src/server/verify/trust-graph.ts";
import { gradeFromVerdict } from "../src/server/verify/grade.ts";
import { getVendorBySlug } from "../src/server/catalog/repository.ts";

// Phrases in a published profile blurb that assert the vendor is fine. Harmless next to a clean
// verdict; actively misleading next to "avoid".
const REASSURING = [
  /generally considered legitimate/i,
  /no consistent scam reports/i,
  /broadly reputable/i,
  /generally well-regarded/i,
  /well[- ]regarded for reliability/i,
  /long[- ]standing .{0,30}vendor known for/i,
  /generally trusted/i,
];

const db = await getDatabase();
const vendors = (await db.query(
  `SELECT slug,display_name,description FROM organizations
   WHERE origin='live' AND organization_type='vendor' ORDER BY slug`,
)).rows;

const findings = [];
let checked = 0;

for (const row of vendors) {
  const result = await composeVerdictForVendorSlug(row.slug);
  if (!result) continue;
  checked += 1;
  const vendor = await getVendorBySlug(row.slug);
  const grade = gradeFromVerdict(result.composed, { coaCount: vendor?.coaCount ?? 0 });
  const description = String(row.description ?? "");
  const adverse = result.composed.verdict === "avoid" || result.composed.verdict === "high-risk";

  // 1. The headline contradiction: an adverse verdict beside a reassuring blurb.
  const reassurance = REASSURING.find(re => re.test(description));
  if (adverse && reassurance) {
    findings.push({
      severity: "HIGH",
      slug: row.slug,
      name: row.display_name,
      issue: `Grade ${grade.letter} (${result.composed.verdict}) but the published profile still reads as reassuring`,
      evidence: description.match(reassurance)?.[0] ?? "",
    });
  }

  // 2. An adverse verdict must rest on a record a reader can open. An "avoid" with no primary
  //    source is the highest-liability statement the product can make about a named business.
  if (adverse) {
    const sourced = Number((await db.query(
      `SELECT COUNT(*) c FROM regulatory_actions WHERE vendor_slug=$1 AND source_url IS NOT NULL AND source_url <> ''`,
      [row.slug],
    )).rows[0].c);
    const reviews = Number((await db.query(
      `SELECT COUNT(*) c FROM vendor_reviews WHERE vendor_slug=$1`, [row.slug],
    )).rows[0].c);
    if (sourced === 0 && reviews === 0) {
      findings.push({
        severity: "CRITICAL",
        slug: row.slug,
        name: row.display_name,
        issue: `Grade ${grade.letter} — "avoid" published with no citable enforcement record and no review record`,
        evidence: "",
      });
    }
  }

  // 3. A display name that is obviously not a company name (ingestion leakage).
  if (/@|^https?:|^www\./i.test(String(row.display_name))) {
    findings.push({
      severity: "MEDIUM",
      slug: row.slug,
      name: row.display_name,
      issue: "Vendor display name looks like scraped contact/URL text, not a company name",
      evidence: String(row.display_name),
    });
  }

  // 4. A graded vendor whose grade rests on zero independently-verified signals.
  if (grade.letter && result.composed.verifiedCount === 0) {
    findings.push({
      severity: "MEDIUM",
      slug: row.slug,
      name: row.display_name,
      issue: `Grade ${grade.letter} published with 0 independently-verified signals`,
      evidence: `${result.composed.weighed} signals weighed`,
    });
  }
}

const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.slug.localeCompare(b.slug));

console.log(`\n=== Truth-check across ${checked} live vendors ===\n`);
if (findings.length === 0) console.log("  no contradictions found\n");
for (const f of findings) {
  console.log(`  [${f.severity}] ${f.name} (/vendors/${f.slug})`);
  console.log(`      ${f.issue}`);
  if (f.evidence) console.log(`      evidence: "${f.evidence.slice(0, 110)}"`);
}
console.log(`\n  ${findings.length} finding(s): ${["CRITICAL", "HIGH", "MEDIUM"].map(s => `${findings.filter(f => f.severity === s).length} ${s}`).join(" · ")}\n`);

await resetDatabaseForTests();
process.exit(0);
