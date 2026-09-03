// Google's side of the story, read straight from Search Console.
//
// The site can prove what happens ON vialgrade.com (readers, clicks out, the /go handoff) but it
// cannot see the step before: how often Google showed us, for which queries, and how many people
// chose us. That lives in Search Console, and this module reads it with a Google service account —
// no SDK, no new dependency: a service-account JWT signed with node:crypto, exchanged for a
// token, then the searchanalytics query endpoint.
//
// Configuration (all server-side env; absent = the admin page shows setup instructions instead):
//   VIALGRADE_GSC_CLIENT_EMAIL  service account's client_email
//   VIALGRADE_GSC_PRIVATE_KEY   service account's private_key (literal \n sequences accepted)
//   VIALGRADE_GSC_SITE          optional property id; otherwise sc-domain:vialgrade.com is tried
//                               first, then https://vialgrade.com/
//
// Failures return null and are NEVER cached (the sitemap incident rule: never cache a failure) —
// the admin page renders "could not reach Search Console" for one load and tries again next time.

import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
// Search Console data lags ~2 days; asking up to "today" silently reads zeros for the newest days.
const DATA_LAG_DAYS = 2;
const WINDOW_DAYS = 28;

export interface SearchQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface SearchConsoleSummary {
  clicks: number;
  impressions: number;
  ctr: number;       // 0..1
  position: number;  // average
  topQueries: SearchQueryRow[];
  windowDays: number;
  site: string;
}

export function isSearchConsoleConfigured(): boolean {
  return Boolean(process.env.VIALGRADE_GSC_CLIENT_EMAIL?.trim() && process.env.VIALGRADE_GSC_PRIVATE_KEY?.trim());
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/**
 * The signed JWT a service account trades for an access token. Pure given (email, key, now) —
 * the unit test generates its own RSA pair, verifies the signature, and pins the claims.
 */
/**
 * The private key exactly as OpenSSL needs it, from the value however it was pasted. The live
 * failure this absorbs: a key pasted into Vercel WITH its surrounding JSON quotes produced
 * error:1E08010C:DECODER routines::unsupported — the PEM header wasn't at byte zero. Wrapping
 * quotes are stripped, literal \n sequences become real newlines, edges are trimmed.
 */
export function normalizePrivateKey(raw: string): string {
  let k = (raw ?? "").trim();
  if (k.length > 1 && ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'")))) k = k.slice(1, -1);
  return k.replace(/\\n/g, "\n").trim();
}

export function buildServiceAccountAssertion(clientEmail: string, privateKey: string, nowSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(normalizePrivateKey(privateKey)).toString("base64url");
  return `${header}.${claims}.${signature}`;
}

interface AnalyticsRow { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }

/** Totals + top queries from the two searchanalytics responses. Pure; unit-tested. */
export function summarizeSearchAnalytics(totalRows: AnalyticsRow[], queryRows: AnalyticsRow[], site: string): SearchConsoleSummary {
  const t = totalRows[0] ?? {};
  return {
    clicks: Number(t.clicks ?? 0),
    impressions: Number(t.impressions ?? 0),
    ctr: Number(t.ctr ?? 0),
    position: Number(t.position ?? 0),
    topQueries: queryRows.map((r) => ({
      query: r.keys?.[0] ?? "",
      clicks: Number(r.clicks ?? 0),
      impressions: Number(r.impressions ?? 0),
      position: Number(r.position ?? 0),
    })).filter((r) => r.query),
    windowDays: WINDOW_DAYS,
    site,
  };
}

async function accessToken(): Promise<string> {
  const email = process.env.VIALGRADE_GSC_CLIENT_EMAIL!.trim();
  const key = process.env.VIALGRADE_GSC_PRIVATE_KEY!;
  const assertion = buildServiceAccountAssertion(email, key, Math.floor(Date.now() / 1000));
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("token exchange returned no access_token");
  return body.access_token;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function queryAnalytics(token: string, site: string, body: Record<string, unknown>): Promise<AnalyticsRow[]> {
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`searchanalytics for ${site}: HTTP ${res.status}`);
  const parsed = (await res.json()) as { rows?: AnalyticsRow[] };
  return parsed.rows ?? [];
}

function candidateSites(): string[] {
  const configured = process.env.VIALGRADE_GSC_SITE?.trim();
  if (configured) return [configured];
  const host = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://vialgrade.com").host.replace(/^www\./, ""); }
    catch { return "vialgrade.com"; }
  })();
  return [`sc-domain:${host}`, `https://${host}/`];
}

/**
 * The last 28 full days of Google Search performance, or null when unconfigured/unreachable.
 * One token + two queries per call; the admin page is the only caller and is owner-only.
 */
export async function getSearchConsoleSummary(): Promise<SearchConsoleSummary | null> {
  if (!isSearchConsoleConfigured()) return null;
  try {
    const token = await accessToken();
    const startDate = isoDaysAgo(DATA_LAG_DAYS + WINDOW_DAYS);
    const endDate = isoDaysAgo(DATA_LAG_DAYS);
    let lastError: unknown = null;
    for (const site of candidateSites()) {
      try {
        const [totals, queries] = await Promise.all([
          queryAnalytics(token, site, { startDate, endDate }),
          queryAnalytics(token, site, { startDate, endDate, dimensions: ["query"], rowLimit: 10 }),
        ]);
        return summarizeSearchAnalytics(totals, queries, site);
      } catch (error) {
        lastError = error; // wrong property type — try the next candidate
      }
    }
    throw lastError ?? new Error("no Search Console property matched");
  } catch (error) {
    console.error("[search-console] summary unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}
