// The verify-anything utility — VialGrade's answer to "is this a scam?" for ANYTHING, in or
// out of the catalog. Paste a vendor domain, a name, or a Janoshik COA code and get a
// real-time verdict. The point is that "unknown" is a LOUD answer, not a silent gap:
// for a vendor we've never indexed we run live signals (domain age, COA presence, Reddit
// mentions) so absence of data never reads as safety.

import knownVendors from "./known-vendors.json";
import { getDatabase } from "@/server/db/client";
import { searchPeptides, classifyPost } from "@/server/ingest/reddit";
import { composeVerdictForVendorSlug } from "./trust-graph";
import { withProbeCache, type ProbeOutcome } from "./probe-cache";
import { recordVerifyQuery } from "./query-log";

export type Verdict = "trusted" | "caution" | "avoid" | "high-risk" | "unproven" | "info";
// How much a signal can be trusted — its PROVENANCE tier, orthogonal to whether it's good/bad (`ok`).
// The whole point of VialGrade is that a guess must not wear a fact's clothes: a regex read off a
// storefront ("inferred") can't render identically to a public FDA conviction ("verified").
//   verified — a document / government record / hard shared identifier we can point at
//   reported — a third-party human account (buyer reviews, community mentions, tracker scores)
//   inferred — a heuristic / regex / single unretried probe (domain age, storefront copy, site status)
export type SignalConfidence = "verified" | "reported" | "inferred";
export interface Signal { ok: boolean | null; label: string; detail: string; confidence?: SignalConfidence }
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

// Public suffixes that are two labels deep. Not the full PSL — the tracked vendors are all on
// single-label TLDs (com, is, co, net, bio) — but a buyer pasting a .co.uk shop must not have its
// registrable domain read as "co.uk", which would make every .co.uk site match every other one.
const MULTI_LABEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "me.uk", "com.au", "net.au", "org.au", "co.nz", "co.za", "com.br", "com.mx",
  "co.jp", "co.kr", "com.tr", "com.sg", "co.in", "com.cn",
]);

/**
 * The name someone actually registered, which is the only safe unit to compare two hosts on.
 *
 * `shop.bluumpeptides.com` is Bluum Peptides. `bluumpeptides.scam.ru` is not — it is a subdomain of
 * scam.ru wearing their name, and telling those two apart is the whole job here.
 */
export function registrableDomain(host: string): string | null {
  const clean = host.trim().toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(clean)) return null;
  const labels = clean.split(".");
  const lastTwo = labels.slice(-2).join(".");
  const depth = MULTI_LABEL_SUFFIXES.has(lastTwo) ? 3 : 2;
  if (labels.length < depth) return null;
  return labels.slice(-depth).join(".");
}

/**
 * The COA code inside whatever the reader pasted, or null.
 *
 * The old test was `/^[A-Z0-9]{9,16}$/` against the raw string, which rejected three things a
 * person plausibly types: the code in lowercase (the lookup upper-cases it anyway, so this was pure
 * loss), the code with the spacing a copy-paste drags along, and the code with a stray # or period.
 *
 * Deleting separators is not free — "some words here" compacts to thirteen alphanumerics and would
 * become a code. So separators are only removed when what is left still reads like a key rather
 * than a sentence, which is what the digit test is for. An input that never had separators keeps
 * the old, looser rule, so no code that worked before stops working.
 */
export function normalizeCoaCode(q: string): string | null {
  const trimmed = q.trim();
  const compact = trimmed.replace(/[\s.\-#_]+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{9,16}$/.test(compact)) return null;
  if (compact !== trimmed.toUpperCase() && !/\d/.test(compact)) return null;
  return compact;
}

export function looksLikeCoaCode(q: string): boolean {
  return normalizeCoaCode(q) !== null;
}

// ---- live checks (best-effort; a failed check degrades to unknown, never throws) ----

/**
 * The verdict for a domain VialGrade has never seen.
 *
 * This used to count `ok === false` signals and publish "high risk" at two. Two of the three
 * signals on this path are ABSENCES — no Reddit mentions, no third-party test records — and the
 * COA check only runs after the known-vendor list and the organizations table have both missed, so
 * it returns zero by construction for exactly these domains. The threshold therefore collapsed to
 * "any one other false signal", and a real business whose domain was registered 89 days ago was
 * enough to publish a high-risk verdict about it by name, on the site's headline action.
 *
 * An absence is recorded untagged precisely so it cannot vote — the same convention trust-graph.ts
 * uses. High risk now requires something a person actually reported; inference alone stays
 * `unproven`, which is the honest answer and already what the rest of the codebase does.
 */
export function unknownDomainVerdict(signals: Signal[]): Verdict {
  const substantiated = signals.filter((s) => s.ok === false && s.confidence && s.confidence !== "inferred");
  return substantiated.length > 0 ? "high-risk" : "unproven";
}

/**
 * The registration date a registry publishes for a domain, or why we have none.
 *
 * Split from the signal it feeds so the CACHE holds the date rather than the sentence. A domain
 * registered on a given day is registered on that day forever, while "registered 89 days ago" is
 * true for one day — caching the rendered signal would have frozen a vendor at the age it had when
 * first checked, right across the 90-day threshold the verdict turns on.
 */
type DomainRegistration = { registeredAt: string } | { registeredAt: null; reason: "not-published" | "unavailable" };

const DOMAIN_AGE_TTL = { okSeconds: 30 * 86_400, failSeconds: 3_600 };

async function fetchDomainRegistration(domain: string): Promise<ProbeOutcome<DomainRegistration>> {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, { headers: { accept: "application/rdap+json", "user-agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { value: { registeredAt: null, reason: "unavailable" }, ok: false };
    const data = (await res.json()) as { events?: { eventAction: string; eventDate: string }[] };
    const reg = data.events?.find((e) => e.eventAction === "registration");
    // "The registry published no date" is an ANSWER and caches like one. "We could not ask" is not.
    if (!reg) return { value: { registeredAt: null, reason: "not-published" }, ok: true };
    return { value: { registeredAt: reg.eventDate }, ok: true };
  } catch {
    return { value: { registeredAt: null, reason: "unavailable" }, ok: false };
  }
}

async function checkDomainAge(domain: string): Promise<Signal> {
  const registration = await withProbeCache("domain-age", domain, DOMAIN_AGE_TTL, () => fetchDomainRegistration(domain));
  if (registration.registeredAt === null) {
    return { ok: null, label: "Domain age", detail: registration.reason === "not-published" ? "Registration date not published." : "Registration lookup unavailable." };
  }
  const days = Math.floor((Date.now() - new Date(registration.registeredAt).getTime()) / 86_400_000);
  // `inferred`: a registry date was read. Nobody examined this business. One inferred concern is
  // context, never a verdict on its own — the same rule trust-graph.ts and grade.ts already apply.
  if (days < 90) return { ok: false, label: "Domain age", detail: `Registered ${days} days ago — brand-new domains are a common scam pattern.`, confidence: "inferred" };
  if (days < 365) return { ok: null, label: "Domain age", detail: `Registered ${days} days ago — relatively new.` };
  const years = (days / 365).toFixed(1);
  return { ok: true, label: "Domain age", detail: `Registered ${years} years ago — an established domain.` };
}

// Post COUNTS are what gets cached, not the sentence built from them, for the same reason the
// registration date is. Twelve hours: long enough that a scam domain doing the rounds is not
// re-searched on every share of the link, short enough that a thread posted this morning is found
// this evening.
const COMMUNITY_TTL = { okSeconds: 12 * 3_600, failSeconds: 900 };

type CommunityCounts = { mentions: number; scammy: number } | null;

async function fetchCommunityCounts(name: string): Promise<ProbeOutcome<CommunityCounts>> {
  const result = await searchPeptides(name, { limit: 10 });
  if (!result) return { value: null, ok: false };
  const posts = result.posts;
  return { value: { mentions: posts.length, scammy: posts.filter((p) => classifyPost(p) === "negative").length }, ok: true };
}

async function checkReddit(name: string): Promise<Signal> {
  // Uses authenticated Reddit search when credentials are configured (the public endpoint
  // blocks datacenter IPs); degrades to "unavailable" rather than a false all-clear.
  const counts = await withProbeCache("community", name, COMMUNITY_TTL, () => fetchCommunityCounts(name));
  if (!counts) return { ok: null, label: "Community (r/Peptides)", detail: "Reddit search unavailable right now." };
  const posts = { length: counts.mentions };
  if (posts.length === 0) return { ok: false, label: "Community (r/Peptides)", detail: "No mentions found. Real vendors get talked about — silence is a mild warning." };
  const scammy = { length: counts.scammy };
  // Require corroboration before this reads as a red signal — a single negative-classified post
  // (which can be a mis-scored post DEFENDING a vendor) must not flag, matching the composed
  // community seam's neg>=2 gate. One lone complaint is a "read it yourself," not a verdict.
  // `reported`: real posts by real people, corroborated at 2+. This is the one signal on this path
  // substantiated enough to carry a verdict.
  if (scammy.length >= 2) return { ok: false, label: "Community (r/Peptides)", detail: `${posts.length} mentions, and ${scammy.length} look like scam/quality complaints. Read them before buying.`, confidence: "reported" };
  if (scammy.length === 1) return { ok: null, label: "Community (r/Peptides)", detail: `${posts.length} mentions; 1 looks like a complaint — thin, read it yourself before judging.` };
  return { ok: true, label: "Community (r/Peptides)", detail: `${posts.length} mentions found and none flagged as scams.` };
}

async function coaSignal(domain: string): Promise<Signal> {
  const db = await getDatabase();
  const r = await db.query<{ n: string }>(
    // is_independent so a self-published certificate can never render as a green "Independent COAs /
    // third-party" affirmation — the same T1 filter every other "independent" surface applies.
    `SELECT COUNT(*) n FROM lab_test_records WHERE is_independent AND (LOWER(manufacturer) LIKE $1 OR LOWER(verify_url) LIKE $1)`,
    [`%${domain.replace(/\.[a-z]+$/, "")}%`],
  );
  const n = Number(r.rows[0]?.n ?? 0);
  return n > 0
    ? { ok: true, label: "Independent COAs", detail: `${n} third-party test record(s) reference this name.` }
    : { ok: false, label: "Independent COAs", detail: "No third-party (Janoshik/MZ) test records found for this name." };
}

// ---- catalog lookups ----

interface KnownVendor { slug: string; name: string; domain: string; redFlag: boolean; reputationSummary?: string; publishesJanoshik?: boolean | string }

/**
 * A tracked vendor for a free-text query, matched on its name or the domain it registered.
 *
 * Domain matching used to be `ndm.includes(nd) || nd.includes(ndm)` against the domain with its
 * TLD stripped, so ANY domain containing a tracked vendor's name inherited that vendor's verdict.
 * On this site's headline anti-scam tool that meant `bluumpeptides-shop.com` and
 * `bluumpeptides.scam.ru` were both answered "Bluum Peptides — generally trusted": the tool
 * endorsing the exact impersonation it exists to catch, by name, with a link. It ran the other way
 * too — a domain containing a red-flagged vendor's name would have been published "do not buy".
 * And it fired on innocent overlap: `peptides.com` matched Bluum Peptides, `amino.com` matched
 * Modern Aminos.
 *
 * Hosts now compare on their registrable domain and must be equal. A real subdomain still matches;
 * a lookalike falls through to the unknown-domain path, which is the honest answer for it.
 */
export function findKnownVendor(query: string, domain: string | null): KnownVendor | null {
  const nq = norm(query);
  const queryDomain = domain ? registrableDomain(domain) : null;
  return (knownVendors as KnownVendor[]).find((v) => {
    const nn = norm(v.name), ndm = norm(v.domain.replace(/\.[a-z]+$/, ""));
    if (nn === nq || ndm === nq) return true;
    return Boolean(queryDomain) && registrableDomain(v.domain) === queryDomain;
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
    link: avoid ? undefined : { href: `/vendors/${v.slug}`, label: `See ${v.name} on VialGrade` },
  };
}

// The rich path: turn a cross-seam ComposedVerdict into a verify result. This is what makes the
// verify tool as deep as the vendor page — its signals ARE the trust-graph factors, each traceable.
// We always link to VialGrade's own evidence page (even for "avoid"): it's where the "why" lives, and it
// never sells — the vendor's storefront is only reachable from a live listing's explicit handoff.
function verifyResultFromComposed(vendorName: string, slug: string, composed: Awaited<ReturnType<typeof composeVerdictForVendorSlug>>): VerifyResult {
  const c = composed!.composed;
  return {
    query: vendorName, kind: "vendor", verdict: c.verdict,
    headline: c.headline, summary: c.summary, signals: c.factors,
    link: { href: `/vendors/${slug}`, label: `See ${vendorName} on VialGrade` },
  };
}

// Resolve a free-text query to a tracked DB vendor slug (organizations table), covering the many
// vendors we track that aren't in the curated known-vendors.json. Name/slug match only — domain
// resolution stays with the curated list, which is the app's domain→vendor map.
async function resolveTrackedVendorSlug(query: string): Promise<string | null> {
  const nq = norm(query);
  if (!nq) return null;
  const db = await getDatabase();
  const r = await db.query<{ slug: string }>(
    `SELECT slug FROM organizations WHERE organization_type='vendor'
       AND (REGEXP_REPLACE(LOWER(display_name),'[^a-z0-9]','','g')=$1 OR REGEXP_REPLACE(LOWER(slug),'[^a-z0-9]','','g')=$1)
     LIMIT 1`, [nq],
  );
  return r.rows[0]?.slug ?? null;
}

function coaIsStale(testedAt: string | null): boolean {
  if (!testedAt) return false;
  const m = testedAt.match(/(20\d{2})/);
  return m ? new Date().getUTCFullYear() - Number(m[1]) >= 2 : false;
}

/**
 * Can we see this certificate at the lab?
 *
 * Three answers, and the third one is why this function was rewritten.
 *
 * It used to return a boolean: `!res.ok` meant `false`, and `false` published "This certificate
 * does NOT resolve at the lab ... it is fabricated — do not trust it." Janoshik's edge answers 403
 * to server-side clients — this repo already knew that and says so in janoshik-verify.ts — and a
 * 403 is not ok, so it was false, so it was fabricated. Probed 2026-09-07 from two networks: a
 * REAL certificate URL and an invented one both return 403. They are indistinguishable to us.
 *
 * So the tool was accusing genuine documents of being forged, on the strength of our own request
 * being turned away, and could not have told a real forgery from a real certificate if it tried.
 * An accusation of fraud is the heaviest thing this product says about anything. It may not rest
 * on a request we were not allowed to make.
 *
 * "unreachable" is now its own answer and it never votes. Only a page we actually read and found
 * empty of a certificate can be evidence of absence.
 */
type CertificateReach = "resolved" | "absent" | "unreachable";

const CERT_REACH_TTL = { okSeconds: 7 * 86_400, failSeconds: 1_800 };

async function fetchCertificateReach(url: string): Promise<ProbeOutcome<CertificateReach>> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, "x-requested-with": "XMLHttpRequest" }, signal: AbortSignal.timeout(9000) });
    // Anything that is not a clean 200 tells us about our access, not about the document. 404
    // included: the lab's edge returns its block page with whatever status it likes.
    if (!res.ok) return { value: "unreachable", ok: false };
    const html = await res.text();
    return /img\/[a-f0-9]+\.png/i.test(html) ? { value: "resolved", ok: true } : { value: "absent", ok: true };
  } catch {
    return { value: "unreachable", ok: false };
  }
}

async function janoshikReach(url: string): Promise<CertificateReach> {
  return withProbeCache("coa-reachability", url, CERT_REACH_TTL, () => fetchCertificateReach(url));
}

async function coaVerdict(code: string, url?: string): Promise<VerifyResult> {
  const db = await getDatabase();
  const r = await db.query<{ sample_name: string; manufacturer: string; purity_pct: string | number | null; verify_url: string; compound_slug: string | null; vendor_slug: string | null; tested_at: string | null }>(
    // Two ways in. verify_key is the extracted column, but the key is also the tail of the stored
    // URL (".../tests/112184-Retatrutide_10mg_9D1HBMNJ411S"), and a record whose key was never
    // extracted is still a record we hold. Matching both turns "we don't have this on file" into a
    // real answer for rows the exact-column lookup walked straight past. The code is [A-Z0-9] by
    // construction, so it carries no LIKE wildcards.
    `SELECT sample_name,manufacturer,purity_pct,verify_url,compound_slug,vendor_slug,tested_at
       FROM lab_test_records
      WHERE verify_key = $1 OR UPPER(verify_url) LIKE '%' || $1
      ORDER BY (verify_key = $1) DESC
      LIMIT 1`,
    [code.toUpperCase()],
  );
  const row = r.rows[0];
  if (row) {
    const purity = row.purity_pct != null ? `${Number(row.purity_pct).toFixed(2)}% purity` : "the purity printed on the certificate";
    const stale = coaIsStale(row.tested_at);
    const signals: Signal[] = [
      { ok: true, label: "Certificate", detail: "Resolves to a real, public, vendor-immutable lab record." },
      { ok: true, label: "Attribution", detail: `Made by ${row.manufacturer}${row.vendor_slug ? ` — a vendor VialGrade tracks.` : "."}` },
    ];
    if (row.tested_at) signals.push({ ok: !stale, label: "Freshness", detail: stale ? `Analyzed ${row.tested_at} — years old, so it describes an old batch, not necessarily current stock.` : `Analyzed ${row.tested_at}.` });
    return {
      query: code, kind: "coa", verdict: "trusted",
      headline: `Real COA — ${row.sample_name} by ${row.manufacturer}`,
      summary: `This resolves to a genuine lab record: ${purity}. Confirm the compound and the “Made By” name match the product you're buying — a real certificate for someone else's product proves nothing about yours.`,
      signals,
      link: row.vendor_slug ? { href: `/vendors/${row.vendor_slug}`, label: `See ${row.manufacturer} on VialGrade` } : { href: row.verify_url, label: "Open the certificate on the lab" },
    };
  }
  // Not in our index — if a full URL was pasted, check whether it resolves live.
  if (url) {
    const reach = await janoshikReach(url);
    if (reach === "resolved") {
      return {
        query: code || url, kind: "coa", verdict: "unproven",
        headline: "Real certificate — but check who it belongs to",
        summary: "This certificate resolves at the lab, so it's genuine. We don't have it indexed, so open it and confirm the compound and the manufacturer match the exact product you're buying — a borrowed or reused certificate is the most common trick.",
        signals: [{ ok: true, label: "Certificate", detail: "Resolves to a live lab record." }, { ok: null, label: "Attribution", detail: "Not in our index — verify the “Made By” name and compound yourself." }],
        link: { href: url, label: "Open the certificate" },
      };
    }
    if (reach === "absent") {
      return {
        query: code || url, kind: "coa", verdict: "high-risk",
        headline: "This certificate does NOT resolve at the lab",
        summary: "We reached the lab's page for this certificate and it returned no record. A COA that won't verify at the issuing lab is fabricated — do not trust it.",
        signals: [{ ok: false, label: "Certificate", detail: "The lab's page for this certificate holds no record.", confidence: "verified" }],
      };
    }
    // unreachable. The reader gets the one thing that does work: their own browser, which the lab
    // does not block. Handing them a link and the exact test to apply beats an answer we cannot
    // stand behind — and beats the accusation this used to make.
    return {
      query: code || url, kind: "coa", verdict: "unproven",
      headline: "We couldn't check this one at the lab",
      summary: "Janoshik's site refuses automated checks, so we can't confirm this certificate from here — and we don't have it indexed. Open it yourself: if it loads a certificate, it's real, and if it doesn't load at all, it's fabricated. Then check the compound and the “Made By” name match the product you're buying.",
      signals: [
        { ok: null, label: "Certificate", detail: "The lab blocks automated checks, so we could not read this page. That is about our access, not about the document." },
        { ok: null, label: "Attribution", detail: "Not in our index — verify the “Made By” name and compound yourself." },
      ],
      link: { href: url, label: "Open the certificate at the lab" },
    };
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

/**
 * Resolve a query to a verdict, then remember that it was asked.
 *
 * Recording sits here rather than in any single branch so no future branch can forget it, and it is
 * awaited but never allowed to fail a verdict — see query-log.ts for what is and is not kept.
 */
export async function runVerification(rawQuery: string): Promise<VerifyResult> {
  const result = await resolveVerification(rawQuery);
  await recordVerifyQuery(result);
  return result;
}

async function resolveVerification(rawQuery: string): Promise<VerifyResult> {
  const query = rawQuery.trim();
  if (!query) return { query, kind: "nothing", verdict: "info", headline: "Enter something to check", summary: "A vendor name or domain, a compound, a Janoshik COA code, or a pasted COA verify link.", signals: [] };

  // 0. A pasted Janoshik verify URL — extract the code and check it (live if we don't hold it).
  const janoUrl = query.match(/https?:\/\/(?:www\.)?verify\.janoshik\.com\/tests\/\S+/i)?.[0];
  if (janoUrl) return coaVerdict(janoUrl.match(/_([A-Za-z0-9]{8,})\/?$/)?.[1] ?? "", janoUrl);

  const domain = extractDomain(query);

  // 1. Known vendor (by name or domain) — includes the flagged/defunct ones, so a scam
  //    search returns a loud "avoid", never silence. If we also track this vendor in the DB,
  //    compose the full cross-seam verdict (as rich as the vendor page); else fall back to the
  //    curated static verdict.
  const known = findKnownVendor(query, domain);
  if (known) {
    const rich = await composeVerdictForVendorSlug(known.slug);
    return rich ? verifyResultFromComposed(rich.vendorName, rich.slug, rich) : vendorVerdict(known);
  }

  // 1b. A tracked DB vendor that isn't in the curated list — resolve by name/slug and compose.
  const trackedSlug = await resolveTrackedVendorSlug(query);
  if (trackedSlug) {
    const rich = await composeVerdictForVendorSlug(trackedSlug);
    if (rich) return verifyResultFromComposed(rich.vendorName, rich.slug, rich);
  }

  // 2. A compound we track.
  //
  // Named things resolve before pattern-matched ones, and this is why. The COA test is a SHAPE —
  // 9 to 16 alphanumerics — and eleven of the compounds on this site match it when typed in capital
  // letters: GLUTATHIONE, SEMAGLUTIDE, TIRZEPATIDE, EPITHALON and the rest. While the shape was
  // tested first, a reader typing the name of a compound we hold a whole market page for was told
  // "we don't have this COA code on record". The same shadow fell over 23 of the 34 tracked vendor
  // names, which is why step 1b used to carry a `!looksLikeCoaCode` guard to escape it.
  //
  // A COA key is random, so it will not collide with a name we actually hold; a name will collide
  // with the shape constantly. Identity first, shape last.
  const byName = await compoundOrVendorByName(query);
  if (byName) return byName;

  // 3. A Janoshik COA code.
  const coaCode = normalizeCoaCode(query);
  if (coaCode) return coaVerdict(coaCode);

  // 4. An unknown domain — run live checks so "unknown" is an informed verdict.
  if (domain) {
    const [age, community, coas] = await Promise.all([checkDomainAge(domain), checkReddit(query.replace(/^https?:\/\//, "").replace(/\/.*$/, "")), coaSignal(domain)]);
    const verdict: Verdict = unknownDomainVerdict([age, community, coas]);
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
