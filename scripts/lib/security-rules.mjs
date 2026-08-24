// The two rules that decide whether a page or a route is guarded — and a self-test that proves
// they can still say no.
//
// These were whole-file substring tests: `getCurrentPrincipal` anywhere, `accountType !== "staff"`
// anywhere, `redirect(` anywhere, all three counted as a guard even if they sat in three unrelated
// functions or a comment. The HMAC rule was worse and had already failed once in this session — it
// tested for /timingSafeEqual/, which matched the IMPORT line, so swapping the constant-time
// compare for a plain .equals() still passed.
//
// A check that cannot fail is worse than no check, because it also stops anyone looking. So the
// rules are proximity-based now, and the audit runs POSITIVE CONTROLS against itself on every run:
// deliberately broken sources that MUST be rejected. If a known-bad fixture ever passes, the audit
// fails on that alone, before it looks at a single real file.

/** Same-statement match: no semicolon or closing brace may sit between the two halves. */
const near = (text, first, second, window = 240) => {
  const re = new RegExp(`${first}[^;{}]{0,${window}}${second}`, "s");
  return re.test(text);
};

/**
 * Is an /admin page guarded server-side, beyond the proxy?
 *
 * Two spellings. The helper (`requireStaff()` / `requirePermission()`) must be CALLED, not merely
 * imported. The longhand must read the principal and act on it in ONE statement — checking the
 * account type and then redirecting somewhere else entirely is not a guard.
 */
export function hasStaffGuard(text) {
  if (/\brequireStaff\s*\(|\brequirePermission\s*\(/.test(text)) return true;
  if (!/getCurrentPrincipal\s*\(/.test(text)) return false;
  return near(text, String.raw`accountType\s*!==\s*"staff"`, String.raw`redirect\s*\(`);
}

/**
 * Is a mutating API route gated?
 *
 * A session gate, a signed provider webhook, or an HMAC postback. For the HMAC case all three parts
 * must be CALLS and the constant-time compare must sit near the digest it verifies — a route that
 * computes an HMAC and then compares it with == is not gated, however many crypto imports it has.
 */
export function hasMutationGate(text) {
  const sessionGated = /requireApiPrincipal\s*\(|requireApiPermission\s*\(|requireApiSellerPermission\s*\(|requireSellerBearerScope\s*\(|requireApiLaboratoryPermission\s*\(|requireLaboratoryBearerScope\s*\(|authorized\s*\(/.test(text);
  const providerSigned = /ingestProviderWebhook\s*\(/.test(text) && /signature/.test(text) && /secret/.test(text);
  const hmacSigned = /createHmac\s*\(/.test(text)
    && /timingSafeEqual\s*\(/.test(text)
    && /\b401\b/.test(text)
    // The digest and the constant-time compare must live in the same helper, not merely the same file.
    && new RegExp(String.raw`createHmac\s*\([\s\S]{0,600}?timingSafeEqual\s*\(`).test(text);
  return sessionGated || providerSigned || hmacSigned;
}

// ── Positive controls ────────────────────────────────────────────────────────────────────────────
// Every entry is a source the rule MUST reject. They are written as the near-misses that actually
// happen, not as obviously-broken straw men.
const STAFF_CONTROLS = [
  { name: "no guard at all", src: `export default async function Page(){ return <div/> }`, expect: false },
  { name: "imports the helper but never calls it", src: `import { requireStaff } from "@/server/auth/session";\nexport default async function Page(){ return <div/> }`, expect: false },
  { name: "reads the principal and ignores it", src: `const p = await getCurrentPrincipal();\nreturn <div>{p?.email}</div>;`, expect: false },
  { name: "checks the account type but redirects nowhere", src: `const p = await getCurrentPrincipal();\nconst isStaff = p?.accountType !== "staff";\nreturn <div/>;`, expect: false },
  { name: "checks and redirects in unrelated statements", src: `const p = await getCurrentPrincipal();\nif (p?.accountType !== "staff") { log("nope"); }\nif (missing) redirect("/somewhere-else");`, expect: false },
  { name: "the helper, called", src: `const s = await requireStaff();\nreturn <div/>;`, expect: true },
  { name: "the longhand, in one statement", src: `const principal = await getCurrentPrincipal();\nif (!principal || principal.accountType !== "staff") redirect("/admin/login");`, expect: true },
];

const MUTATION_CONTROLS = [
  { name: "no gate at all", src: `export async function POST(){ return NextResponse.json({ok:true}) }`, expect: false },
  { name: "imports crypto but never verifies", src: `import { createHmac, timingSafeEqual } from "node:crypto";\nexport async function POST(){ return NextResponse.json({ok:true}) }`, expect: false },
  { name: "hmac computed, compared with equals", src: `const expected = createHmac("sha256", secret).update(x).digest("hex");\nif (!a.equals(b)) return NextResponse.json({error:"Unauthorized"},{status:401});`, expect: false },
  { name: "timing-safe compare with no digest of our own", src: `if (!timingSafeEqual(a,b)) return NextResponse.json({error:"no"},{status:401});`, expect: false },
  { name: "session gate, called", src: `const p = await requireApiPrincipal(request);\nexport async function POST(){}`, expect: true },
  { name: "hmac verified properly", src: `const expected = createHmac("sha256", secret).update(\`\${ref}:\${cents}\`).digest("hex");\nconst a = Buffer.from(expected); const b = Buffer.from(provided);\nif (!(a.length === b.length && timingSafeEqual(a, b))) return NextResponse.json({error:"Unauthorized"},{status:401});`, expect: true },
];

/**
 * Prove both rules can still say no, before trusting either to say yes.
 *
 * Returns the failures rather than throwing, so the caller reports them the same way it reports a
 * real finding — a blind audit is itself a security finding.
 */
export function selfTestSecurityRules() {
  const failures = [];
  for (const c of STAFF_CONTROLS) {
    const got = hasStaffGuard(c.src);
    if (got !== c.expect) failures.push(`staff-guard rule is broken — "${c.name}" should be ${c.expect ? "guarded" : "REJECTED"} and was not`);
  }
  for (const c of MUTATION_CONTROLS) {
    const got = hasMutationGate(c.src);
    if (got !== c.expect) failures.push(`mutation-gate rule is broken — "${c.name}" should be ${c.expect ? "gated" : "REJECTED"} and was not`);
  }
  return failures;
}
