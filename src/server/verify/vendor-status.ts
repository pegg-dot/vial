// Vendor liveness / exit-scam probe. probeVendorStatus() does a live fetch (used offline in the
// collector); recordVendorStatus / getVendorStatus persist and serve the result to the page.

import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

export type VendorStatusKind = "operating" | "offline" | "redirected" | "parked" | "blocked" | "unknown";
export interface VendorStatus { status: VendorStatusKind; httpCode: number | null; redirectHost: string | null; detail: string; checkedAt?: string | null; consecutiveFailures?: number }

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
// Registrable-ish domain: last two labels (good enough for the .com/.is/.co TLDs here).
function registrable(host: string): string {
  const h = host.replace(/^www\./i, "").toLowerCase();
  const parts = h.split(".");
  return parts.length <= 2 ? h : parts.slice(-2).join(".");
}
const PARKED = /this domain (is|may be) for sale|buy this domain|domain is parked|sedoparking|hugedomains|parked free|godaddy\.com\/domainsearch|afternic/i;

/** Probe a vendor domain's operational status. Never throws — a failure is itself the signal. */
export async function probeVendorStatus(domain: string): Promise<VendorStatus> {
  try {
    const res = await fetch(`https://${domain}`, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(14000) });
    const finalHost = (() => { try { return new URL(res.url).host; } catch { return domain; } })();
    if (res.status >= 500) return { status: "offline", httpCode: res.status, redirectHost: null, detail: `Server error (${res.status}) — the site isn't serving.` };
    if (res.status === 403 || res.status === 429 || res.status === 503) return { status: "blocked", httpCode: res.status, redirectHost: null, detail: `Bot protection returned ${res.status} — can't confirm status automatically; likely still operating.` };
    if (res.status >= 400) return { status: "offline", httpCode: res.status, redirectHost: null, detail: `Returns ${res.status} — the storefront isn't reachable.` };
    if (registrable(finalHost) !== registrable(domain)) return { status: "redirected", httpCode: res.status, redirectHost: finalHost, detail: `Now redirects to ${registrable(finalHost)} — a domain change or takeover; verify it's the same operator before trusting it.` };
    const body = (await res.text()).slice(0, 20000);
    if (body.length < 600 || PARKED.test(body)) return { status: "parked", httpCode: res.status, redirectHost: null, detail: `Resolves to a parked or near-empty page, not a working storefront — a common exit-scam end state.` };
    return { status: "operating", httpCode: res.status, redirectHost: null, detail: `Live storefront responding normally.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "offline", httpCode: null, redirectHost: null, detail: /timeout|abort/i.test(msg) ? "No response before timeout — the site may be down." : "Domain did not resolve or refused the connection — the site appears to be down." };
  }
}

export async function recordVendorStatus(db: SqlConnection, vendorSlug: string, s: VendorStatus): Promise<void> {
  await db.query(
    `INSERT INTO vendor_status (id, vendor_slug, status, http_code, redirect_host, detail, origin, checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,'live',NOW())
     ON CONFLICT (vendor_slug) DO UPDATE SET status=EXCLUDED.status, http_code=EXCLUDED.http_code, redirect_host=EXCLUDED.redirect_host, detail=EXCLUDED.detail, checked_at=NOW(),
       -- Count consecutive NOT-operating answers. A blocked status is bot protection, not absence,
       -- and must not accumulate: that mistake once sank live vendors as defunct. Recovery resets.
       consecutive_failures = CASE
         WHEN EXCLUDED.status IN ('operating','blocked','unknown') THEN 0
         ELSE vendor_status.consecutive_failures + 1
       END`,
    [newId("vstat"), vendorSlug, s.status, s.httpCode, s.redirectHost, s.detail],
  );
}

export async function getVendorStatus(db: SqlConnection, vendorSlug: string): Promise<VendorStatus | null> {
  const r = (await db.query<{ status: VendorStatusKind; http_code: number | null; redirect_host: string | null; detail: string; checked_at: string | null; consecutive_failures?: number }>(
    `SELECT status, http_code, redirect_host, detail, checked_at, consecutive_failures FROM vendor_status WHERE vendor_slug=$1`,
    [vendorSlug],
  )).rows[0];
  return r ? { status: r.status, httpCode: r.http_code, redirectHost: r.redirect_host, detail: r.detail, checkedAt: r.checked_at, consecutiveFailures: Number(r.consecutive_failures ?? 0) } : null;
}
