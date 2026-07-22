// The verify-anything utility — VIAL's answer to "is this a scam?" for ANYTHING, in or
// out of the catalog. Paste a vendor domain, a name, or a Janoshik COA code and get a
// real-time verdict. The point is that "unknown" is a LOUD answer, not a silent gap:
// for a vendor we've never indexed we run live signals (domain age, COA presence, Reddit
// mentions) so absence of data never reads as safety.

import knownVendors from "./known-vendors.json";
import { getDatabase } from "@/server/db/client";
import { searchPeptides, classifyPost } from "@/server/ingest/reddit";

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
  // Uses authenticated Reddit search when credentials are configured (the public endpoint
  // blocks datacenter IPs); degrades to "unavailable" rather than a false all-clear.
  const result = await searchPeptides(name, { limit: 10 });
  if (!result) return { ok: null, label: "Community (r/Peptides)", detail: "Reddit search unavailable right now." };
  const posts = result.posts;
  if (posts.length === 0) return { ok: false, label: "Community (r/Peptides)", detail: "No mentions found. Real vendors get talked about — silence is a mild warning." };
  const scammy = posts.filter((p) => classifyPost(p) === "negative");
  if (scammy.length > 0) return { ok: false, label: "Community (r/Peptides)", detail: `${posts.length} mentions, and ${scammy.length} look like scam/quality complaints. Read them before buying.` };
  return { ok: true, label: "Community (r/Peptides)", detail: `${posts.length} mentions found and none flagged as scams.` };
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

export function findKnownVendorBySlug(slug: string): KnownVendor | null {
  return (knownVendors as KnownVendor[]).find((v) => v.slug === slug) ?? null;
}

/** A compact vendor verdict for surfacing on the vendor page. Null for vendors we don't rate. */
export function verdictForVendorSlug(slug: string): { verdict: Verdict; headline: string; summary: string } | null {
  const v = findKnownVendorBySlug(slug);
  if (!v) return null;
  const r = vendorVerdict(v);
  return { verdict: r.verdict, headline: r.headline, summary: r.summary };
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

function coaIsStale(testedAt: string | null): boolean {
  if (!testedAt) return false;
  const m = testedAt.match(/(20\d{2})/);
  return m ? new Date().getUTCFullYear() - Number(m[1]) >= 2 : false;
}

// Live existence check for a pasted Janoshik verify URL we don't hold — does it resolve to a
// real certificate image? Confirms authenticity even for codes outside our index.
async function janoshikResolves(url: string): Promise<boolean | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, "x-requested-with": "XMLHttpRequest" }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return false;
    const html = await res.text();
    return /img\/[a-f0-9]+\.png/i.test(html);
  } catch {
    return null;
  }
}

async function coaVerdict(code: string, url?: string): Promise<VerifyResult> {
  const db = await getDatabase();
  const r = await db.query<{ sample_name: string; manufacturer: string; purity_pct: string | number | null; verify_url: string; compound_slug: string | null; vendor_slug: string | null; tested_at: string | null }>(
    `SELECT sample_name,manufacturer,purity_pct,verify_url,compound_slug,vendor_slug,tested_at FROM lab_test_records WHERE verify_key = $1 LIMIT 1`,
    [code.toUpperCase()],
  );
  const row = r.rows[0];
  if (row) {
    const purity = row.purity_pct != null ? `${Number(row.purity_pct).toFixed(2)}% purity` : "the purity printed on the certificate";
    const stale = coaIsStale(row.tested_at);
    const signals: Signal[] = [
      { ok: true, label: "Certificate", detail: "Resolves to a real, public, vendor-immutable lab record." },
      { ok: true, label: "Attribution", detail: `Made by ${row.manufacturer}${row.vendor_slug ? ` — a vendor VIAL tracks.` : "."}` },
    ];
    if (row.tested_at) signals.push({ ok: !stale, label: "Freshness", detail: stale ? `Analyzed ${row.tested_at} — years old, so it describes an old batch, not necessarily current stock.` : `Analyzed ${row.tested_at}.` });
    return {
      query: code, kind: "coa", verdict: "trusted",
      headline: `Real COA — ${row.sample_name} by ${row.manufacturer}`,
      summary: `This resolves to a genuine lab record: ${purity}. Confirm the compound and the “Made By” name match the product you're buying — a real certificate for someone else's product proves nothing about yours.`,
      signals,
      link: row.vendor_slug ? { href: `/vendors/${row.vendor_slug}`, label: `See ${row.manufacturer} on VIAL` } : { href: row.verify_url, label: "Open the certificate on the lab" },
    };
  }
  // Not in our index — if a full URL was pasted, check whether it resolves live.
  if (url) {
    const resolves = await janoshikResolves(url);
    if (resolves === true) {
      return {
        query: code || url, kind: "coa", verdict: "unproven",
        headline: "Real certificate — but check who it belongs to",
        summary: "This certificate resolves at the lab, so it's genuine. We don't have it indexed, so open it and confirm the compound and the manufacturer match the exact product you're buying — a borrowed or reused certificate is the most common trick.",
        signals: [{ ok: true, label: "Certificate", detail: "Resolves to a live lab record." }, { ok: null, label: "Attribution", detail: "Not in our index — verify the “Made By” name and compound yourself." }],
        link: { href: url, label: "Open the certificate" },
      };
    }
    if (resolves === false) {
      return {
        query: code || url, kind: "coa", verdict: "high-risk",
        headline: "This certificate does NOT resolve at the lab",
        summary: "The URL you pasted doesn't return a real certificate. A COA that won't verify at the issuing lab is fabricated — do not trust it.",
        signals: [{ ok: false, label: "Certificate", detail: "Does not resolve to a real lab record — fabricated." }],
      };
    }
  }
  return {
    query: code, kind: "coa", verdict: "unproven",
    headline: "We don't have this COA code on record",
    summary: "That doesn't mean it's fake — verify it directly at janoshik.com/verify. If it doesn't resolve there, the certificate is fabricated. Paste the full verify URL here and we'll check it live.",
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
  if (!query) return { query, kind: "nothing", verdict: "info", headline: "Enter something to check", summary: "A vendor name or domain, a compound, a Janoshik COA code, or a pasted COA verify link.", signals: [] };

  // 0. A pasted Janoshik verify URL — extract the code and check it (live if we don't hold it).
  const janoUrl = query.match(/https?:\/\/(?:www\.)?verify\.janoshik\.com\/tests\/\S+/i)?.[0];
  if (janoUrl) return coaVerdict(janoUrl.match(/_([A-Za-z0-9]{8,})\/?$/)?.[1] ?? "", janoUrl);

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
