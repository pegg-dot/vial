// The verify-anything utility — VIAL's answer to "is this a scam?" for ANYTHING, in or
// out of the catalog. Paste a vendor domain, a name, or a Janoshik COA code and get a
// real-time verdict. The point is that "unknown" is a LOUD answer, not a silent gap:
// for a vendor we've never indexed we run live signals (domain age, COA presence, Reddit
// mentions) so absence of data never reads as safety.

import knownVendors from "./known-vendors.json";
import { getDatabase } from "@/server/db/client";

export type Verdict = "trusted" | "caution" | "avoid" | "high-risk" | "unproven" | "info";
export interface Signal { ok: boolean | null; label: string; detail: string }
export interface VerifyResult {
  query: string;
  kind: "vendor" | "coa" | "compound" | "unknown-domain" | "nothing";
  verdict: Verdict;
  headline: string;
  summary: string;
  signals: Signal[];
  link?: { href: string; label: string };
  alternatives?: { slug: string; name: string }[];
}

// RDAP registries reject unusual agents; a browser UA is the reliable choice. (Reddit
// blocks datacenter traffic regardless of UA — that signal needs Reddit API auth in prod
// and degrades gracefully to "unavailable" until then.)
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function extractDomain(q: string): string | null {
  const t = q.trim().toLowerCase();
  const m = t.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[/?#].*)?$/);
  return m ? m[1] : null;
}

export function looksLikeCoaCode(q: string): boolean {
  return /^[A-Z0-9]{9,16}$/.test(q.trim());
}

// ---- live checks (best-effort; a failed check degrades to unknown, never throws) ----

async function checkDomainAge(domain: string): Promise<Signal> {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, { headers: { accept: "application/rdap+json", "user-agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: null, label: "Domain age", detail: "Could not look up registration date." };
    const data = (await res.json()) as { events?: { eventAction: string; eventDate: string }[] };
    const reg = data.events?.find((e) => e.eventAction === "registration");
    if (!reg) return { ok: null, label: "Domain age", detail: "Registration date not published." };
    const days = Math.floor((Date.now() - new Date(reg.eventDate).getTime()) / 86_400_000);
    if (days < 90) return { ok: false, label: "Domain age", detail: `Registered ${days} days ago — brand-new domains are a common scam pattern.` };
    if (days < 365) return { ok: null, label: "Domain age", detail: `Registered ${days} days ago — relatively new.` };
    const years = (days / 365).toFixed(1);
    return { ok: true, label: "Domain age", detail: `Registered ${years} years ago — an established domain.` };
  } catch {
    return { ok: null, label: "Domain age", detail: "Registration lookup unavailable." };
  }
}

async function checkReddit(name: string): Promise<Signal> {
  try {
    const q = encodeURIComponent(`"${name}"`);
    const res = await fetch(`https://www.reddit.com/r/Peptides/search.json?q=${q}&restrict_sr=1&limit=10&sort=relevance`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return { ok: null, label: "Community (r/Peptides)", detail: "Could not search Reddit right now." };
    const data = (await res.json()) as { data?: { children?: { data: { title: string } }[] } };
    const posts = data.data?.children ?? [];
    if (posts.length === 0) return { ok: false, label: "Community (r/Peptides)", detail: "No mentions found. Real vendors get talked about — silence is a mild warning." };
    const scammy = posts.filter((p) => /scam|fake|ripped?\s*off|didn.?t (arrive|receive|ship)|underdos|counterfeit|avoid/i.test(p.data.title));
    if (scammy.length > 0) return { ok: false, label: "Community (r/Peptides)", detail: `${posts.length} mentions, and ${scammy.length} look like scam/quality complaints. Read them before buying.` };
    return { ok: true, label: "Community (r/Peptides)", detail: `${posts.length} mentions found and none flagged as scams in the titles.` };
  } catch {
    return { ok: null, label: "Community (r/Peptides)", detail: "Reddit search unavailable." };
  }
}

async function coaSignal(domain: string): Promise<Signal> {
  const db = await getDatabase();
  const r = await db.query<{ n: string }>(
    `SELECT COUNT(*) n FROM lab_test_records WHERE LOWER(manufacturer) LIKE $1 OR LOWER(verify_url) LIKE $1`,
    [`%${domain.replace(/\.[a-z]+$/, "")}%`],
  );
  const n = Number(r.rows[0]?.n ?? 0);
  return n > 0
    ? { ok: true, label: "Independent COAs", detail: `${n} third-party test record(s) reference this name.` }
    : { ok: false, label: "Independent COAs", detail: "No third-party (Janoshik/MZ) test records found for this name." };
}

// ---- catalog lookups ----

interface KnownVendor { slug: string; name: string; domain: string; redFlag: boolean; reputationSummary?: string; publishesJanoshik?: boolean | string }

export function findKnownVendor(query: string, domain: string | null): KnownVendor | null {
  const nq = norm(query);
  const nd = domain ? norm(domain.replace(/\.[a-z]+$/, "")) : "";
  return (knownVendors as KnownVendor[]).find((v) => {
    const nn = norm(v.name), ndm = norm(v.domain.replace(/\.[a-z]+$/, ""));
    return nn === nq || ndm === nq || (nd && (ndm === nd || ndm.includes(nd) || nd.includes(ndm)));
  }) ?? null;
}

export function vendorVerdict(v: KnownVendor): VerifyResult {
  const rep = v.reputationSummary ?? "";
  const avoid = v.redFlag || /shut ?down|defunct|do not buy|scam|impersonat|dead|parked|avoid/i.test(rep);
  const caution = /mixed|complaint|questioned|caution|thin|limited|couldn.?t be verified/i.test(rep);
  const verdict: Verdict = avoid ? "avoid" : caution ? "caution" : "trusted";
  return {
    query: v.name, kind: "vendor", verdict,
    headline: avoid ? `${v.name} — do not buy` : caution ? `${v.name} — proceed with caution` : `${v.name} — generally trusted`,
    summary: rep || "A known vendor in the research-peptide market.",
    signals: [
      { ok: !avoid, label: "Status", detail: avoid ? "Flagged as defunct, an impersonator, or a scam." : "Operating vendor." },
      { ok: v.publishesJanoshik === true ? true : null, label: "Third-party testing", detail: v.publishesJanoshik === true ? "Advertises independent Janoshik/MZ COAs." : "Independent testing not confirmed." },
    ],
    link: avoid ? undefined : { href: `/vendors/${v.slug}`, label: `See ${v.name} on VIAL` },
  };
}

async function coaVerdict(code: string): Promise<VerifyResult> {
  const db = await getDatabase();
  const r = await db.query<{ sample_name: string; manufacturer: string; purity_pct: string | number | null; verify_url: string; compound_slug: string | null }>(
    `SELECT sample_name,manufacturer,purity_pct,verify_url,compound_slug FROM lab_test_records WHERE verify_key = $1 LIMIT 1`,
    [code.toUpperCase()],
  );
  const row = r.rows[0];
  if (row) {
    const purity = row.purity_pct != null ? `${Number(row.purity_pct).toFixed(2)}% purity` : "purity on the certificate";
    return {
      query: code, kind: "coa", verdict: "trusted",
      headline: `Real COA — ${row.sample_name} by ${row.manufacturer}`,
      summary: `We have this Janoshik test on record: ${purity}. It resolves to a public, vendor-immutable certificate.`,
      signals: [{ ok: true, label: "Certificate", detail: "Resolves to a real Janoshik record." }],
      link: { href: row.verify_url, label: "Open the certificate on Janoshik" },
    };
  }
  return {
    query: code, kind: "coa", verdict: "unproven",
    headline: "We don't have this COA code on record",
    summary: "That doesn't mean it's fake — verify it directly at janoshik.com/verify. If it doesn't resolve there, the certificate is fabricated.",
    signals: [{ ok: null, label: "Certificate", detail: "Not in our index. Check janoshik.com/verify to confirm it's real." }],
    link: { href: `https://janoshik.com/verify`, label: "Verify at Janoshik" },
  };
}

async function compoundOrVendorByName(query: string): Promise<VerifyResult | null> {
  const db = await getDatabase();
  const nq = norm(query);
  const comp = await db.query<{ slug: string; canonical_name: string }>(`SELECT slug,canonical_name FROM compounds`);
  const hit = comp.rows.find((c) => norm(c.canonical_name) === nq || norm(c.slug) === nq);
  if (hit) return { query, kind: "compound", verdict: "info", headline: `${hit.canonical_name} — compound`, summary: "We track this compound. See prices ranked by cost-per-mg and independent test purity.", signals: [], link: { href: `/compounds/${hit.slug}`, label: `See ${hit.canonical_name}` } };
  return null;
}

async function topAlternatives(): Promise<{ slug: string; name: string }[]> {
  return (knownVendors as KnownVendor[]).filter((v) => !v.redFlag && v.publishesJanoshik === true).slice(0, 3).map((v) => ({ slug: v.slug, name: v.name }));
}

export async function runVerification(rawQuery: string): Promise<VerifyResult> {
  const query = rawQuery.trim();
  if (!query) return { query, kind: "nothing", verdict: "info", headline: "Enter something to check", summary: "A vendor name or domain, a compound, or a Janoshik COA code.", signals: [] };

  const domain = extractDomain(query);

  // 1. Known vendor (by name or domain) — includes the flagged/defunct ones, so a scam
  //    search returns a loud "avoid", never silence.
  const known = findKnownVendor(query, domain);
  if (known) return vendorVerdict(known);

  // 2. A Janoshik COA code.
  if (looksLikeCoaCode(query)) return coaVerdict(query);

  // 3. A compound we track.
  const byName = await compoundOrVendorByName(query);
  if (byName) return byName;

  // 4. An unknown domain — run live checks so "unknown" is an informed verdict.
  if (domain) {
    const [age, community, coas] = await Promise.all([checkDomainAge(domain), checkReddit(query.replace(/^https?:\/\//, "").replace(/\/.*$/, "")), coaSignal(domain)]);
    const bad = [age, community, coas].filter((s) => s.ok === false).length;
    const verdict: Verdict = bad >= 2 ? "high-risk" : "unproven";
    return {
      query: domain, kind: "unknown-domain", verdict,
      headline: verdict === "high-risk" ? `${domain} — high risk, treat as unproven` : `${domain} — we've never seen this vendor`,
      summary: verdict === "high-risk"
        ? "Multiple warning signs on a vendor we don't track. Unknown is not the same as safe — be very careful."
        : "We don't track this vendor yet. Here's what a live check turned up so you're not flying blind.",
      signals: [age, coas, community],
      alternatives: await topAlternatives(),
    };
  }

  // 5. Nothing matched.
  return {
    query, kind: "nothing", verdict: "info",
    headline: "Nothing found for that",
    summary: "Try a vendor domain (like example.com), a compound name (like BPC-157), or a Janoshik COA code.",
    signals: [],
  };
}
