// Domain age, collected rather than hand-written.
//
// `composeVerdict` has always known how to read a domain-age note: a young domain is a real risk
// signal in a market where scam storefronts appear and vanish inside a year. What it never had
// was a producer. The only source was `scripts/data/vendor-signals.json` — 18 rows typed by hand,
// covering 18 of 82 vendors, and never loaded into the live database. So the "Business signals"
// dimension rendered empty for every vendor on the site, and domain age counted for nothing.
//
// This reads the registry's own record over RDAP (the JSON successor to WHOIS text), which needs
// no shelling out to a `whois` binary and therefore works in the same places the app does.

/**
 * The single definition of "young" for a domain.
 *
 * `composeVerdict` imports this rather than restating it. When the note format and the reader
 * were two separate regexes, editing either one alone would leave the note rendering on the
 * vendor page while silently no longer counting toward the verdict — a signal that looks alive
 * and is not. One definition, one behaviour.
 */
export const YOUNG_DOMAIN_RE = /~?\s*(months old|VERY YOUNG|\b[0-1]\.\d\s*yr)/i;

interface RdapEvent { eventAction?: string; eventDate?: string }

/** The domain's registration date as `YYYY-MM-DD`, or null if the registry did not report one. */
export function registrationDateFromRdap(doc: unknown): string | null {
  const events = (doc as { events?: RdapEvent[] } | null)?.events;
  if (!Array.isArray(events)) return null;
  for (const e of events) {
    const action = typeof e?.eventAction === "string" ? e.eventAction.toLowerCase() : "";
    if (action !== "registration" && action !== "registered") continue;
    const parsed = e.eventDate ? new Date(e.eventDate) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) continue;
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;
const DAYS_PER_YEAR = 365.25;

/**
 * A human sentence describing how old a domain is, in the same shape as the notes already on
 * file — so the 18 hand-written rows and everything this collects read identically.
 *
 * Returns null for an unusable or future-dated registration. A registry record that puts a
 * domain's creation in the future is broken data, and rendering it as "0 months old — VERY
 * YOUNG" would publish a risk word about a real business on the strength of a glitch.
 */
export function domainAgeNote(registeredIso: string | null | undefined, now: Date = new Date()): string | null {
  if (!registeredIso) return null;
  const registered = new Date(registeredIso);
  if (Number.isNaN(registered.getTime())) return null;

  const days = (now.getTime() - registered.getTime()) / MS_PER_DAY;
  if (days < 0) return null;

  const date = registered.toISOString().slice(0, 10);
  const years = days / DAYS_PER_YEAR;

  if (years < 1) {
    const months = Math.max(1, Math.round(days / DAYS_PER_MONTH));
    return `Domain registered ${date} (~${months} months old) — VERY YOUNG, a notable risk signal`;
  }
  if (years < 2) return `Domain registered ${date} (~${years.toFixed(1)} yrs) — YOUNG, a risk signal`;
  return `Domain registered ${date} (~${Math.round(years)} yrs)`;
}

const UA = "VialGrade-Signals/1.0 (+https://vial.local/how-we-check)";
const RDAP_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_DELAY_MS = 1_500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 404 and 422 are the registry ANSWERING "no record here"; anything else is it not answering. */
const isDefinitive = (status: number) => status === 404 || status === 422;

export interface RdapLookupOptions {
  /** Injected in tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  retries?: number;
  delayMs?: number;
}

/**
 * Ask the registry when a domain was created.
 *
 * `rdap.org` redirects to whichever registry is authoritative for the TLD (Verisign for .com,
 * ISNIC for .is, and so on), so one URL covers every vendor.
 *
 * The retry loop is not decoration. The first live run of this collector reported 46 of 57
 * domains as having an unknown age; every one of them in fact had a public record, and what had
 * actually happened is that rdap.org started refusing requests partway down the list. Because a
 * refusal returned null exactly like a genuine absence, a throttled run produced a plausible,
 * quiet, completely wrong picture of the market — the failure mode this codebase already has a
 * rule about. A definitive not-found is still one call; everything else is retried with backoff,
 * and an exhausted budget returns null rather than an invented date.
 */
export async function fetchDomainRegistrationDate(domain: string, opts: RdapLookupOptions = {}): Promise<string | null> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!clean || !clean.includes(".")) return null;

  const doFetch = opts.fetchImpl ?? fetch;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const baseDelay = opts.delayMs ?? DEFAULT_DELAY_MS;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(baseDelay * attempt);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RDAP_TIMEOUT_MS);
    try {
      const res = await doFetch(`https://rdap.org/domain/${encodeURIComponent(clean)}`, {
        headers: { "user-agent": UA, accept: "application/rdap+json, application/json" },
        redirect: "follow",
        signal: controller.signal,
      });
      if (res.ok) return registrationDateFromRdap(await res.json());
      if (isDefinitive(res.status)) return null;
    } catch {
      /* transport failure — retry */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
