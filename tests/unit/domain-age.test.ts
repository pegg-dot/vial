import { describe, expect, it } from "vitest";
import { registrationDateFromRdap, domainAgeNote, YOUNG_DOMAIN_RE, fetchDomainRegistrationDate } from "@/server/collect/domain-age";

// Domain age was a signal the trust graph knew how to read and nothing ever produced. The one
// file that fed it was 18 rows written by hand, covering 18 of 82 vendors, and it was never
// loaded — so every vendor's "Business signals" dimension read empty. RDAP is the registry's own
// JSON API (the successor to WHOIS text), so this can run anywhere the app runs.

const rdap = (events: { eventAction: string; eventDate: string }[]) => ({ objectClassName: "domain", events });

describe("reading a registration date from RDAP", () => {
  it("takes the registration event", () => {
    const doc = rdap([
      { eventAction: "last changed", eventDate: "2026-06-01T00:00:00Z" },
      { eventAction: "registration", eventDate: "2025-11-29T03:17:33Z" },
      { eventAction: "expiration", eventDate: "2026-11-29T03:17:33Z" },
    ]);
    expect(registrationDateFromRdap(doc)).toBe("2025-11-29");
  });

  // Registries are inconsistent about the label; both spellings appear in the wild.
  it("accepts the 'registered' spelling too", () => {
    expect(registrationDateFromRdap(rdap([{ eventAction: "registered", eventDate: "2019-04-02T00:00:00Z" }]))).toBe("2019-04-02");
  });

  it("returns null when no registration event is present", () => {
    expect(registrationDateFromRdap(rdap([{ eventAction: "expiration", eventDate: "2026-11-29T00:00:00Z" }]))).toBeNull();
  });

  it("returns null for a malformed or empty document", () => {
    expect(registrationDateFromRdap(null)).toBeNull();
    expect(registrationDateFromRdap({})).toBeNull();
    expect(registrationDateFromRdap(rdap([{ eventAction: "registration", eventDate: "not-a-date" }]))).toBeNull();
  });
});

describe("describing a domain's age", () => {
  const NOW = new Date("2026-08-21T00:00:00Z");

  it("calls a domain under a year old very young, in months", () => {
    const note = domainAgeNote("2025-11-29", NOW);
    expect(note).toContain("2025-11-29");
    expect(note).toContain("months old");
    expect(note).toContain("VERY YOUNG");
  });

  it("calls a domain in its second year young, in years", () => {
    const note = domainAgeNote("2025-05-04", NOW);
    expect(note).toContain("1.3 yrs");
    expect(note).toContain("YOUNG");
    expect(note).not.toContain("VERY YOUNG");
  });

  it("states an established domain's age without a risk word", () => {
    const note = domainAgeNote("2020-06-25", NOW);
    expect(note).toContain("6 yrs");
    expect(note).not.toContain("YOUNG");
  });

  it("returns null for an unusable date", () => {
    expect(domainAgeNote(null, NOW)).toBeNull();
    expect(domainAgeNote("not-a-date", NOW)).toBeNull();
  });

  // A domain registered in the future is a broken registry record, not a signal. Reporting a
  // negative age as "0 months old — VERY YOUNG" would publish a risk word off a data error.
  it("returns null for a registration date in the future", () => {
    expect(domainAgeNote("2027-01-01", NOW)).toBeNull();
  });
});

// This is the contract between this collector and `composeVerdict`, which reads the note back
// out with a regex. If either side is edited alone, a vendor's domain age silently stops being
// a signal — the note keeps rendering on the page and stops counting toward the verdict.
describe("interoperability with the trust graph", () => {
  const NOW = new Date("2026-08-21T00:00:00Z");

  it("produces a note the trust graph reads as young", () => {
    expect(YOUNG_DOMAIN_RE.test(domainAgeNote("2025-11-29", NOW)!)).toBe(true);
    expect(YOUNG_DOMAIN_RE.test(domainAgeNote("2025-05-04", NOW)!)).toBe(true);
  });

  it("produces a note the trust graph does not read as young", () => {
    expect(YOUNG_DOMAIN_RE.test(domainAgeNote("2020-06-25", NOW)!)).toBe(false);
    expect(YOUNG_DOMAIN_RE.test(domainAgeNote("2016-01-01", NOW)!)).toBe(false);
  });

  // The 18 hand-written notes already in scripts/data/vendor-signals.json must keep classifying
  // the same way, or turning this collector on would silently re-grade existing vendors.
  it("classifies the existing hand-written notes unchanged", () => {
    expect(YOUNG_DOMAIN_RE.test("Domain registered 2025-12-06 (~7 months old) — VERY YOUNG, a notable risk signal")).toBe(true);
    expect(YOUNG_DOMAIN_RE.test("Domain registered 2025-05-04 (~1.2 yrs) — YOUNG, a risk signal")).toBe(true);
    expect(YOUNG_DOMAIN_RE.test("Domain registered 2020-06-25 (~6 yrs); uses .is ccTLD despite US-facing operation")).toBe(false);
  });
});

// The first live run of this collector reported 46 of 57 domains as "unknown age". They were not
// unknown — rdap.org had started refusing the requests, and a refusal was being read as an answer.
// A throttled run must look like a failure, not like a catalogue of ageless domains.
describe("asking the registry, when the registry pushes back", () => {
  const okBody = { events: [{ eventAction: "registration", eventDate: "2025-11-29T03:17:33Z" }] };
  const reply = (status: number, body: unknown = {}) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

  it("retries a rate-limited lookup and returns the date", async () => {
    const codes = [429, 200];
    let calls = 0;
    const date = await fetchDomainRegistrationDate("ascendbiolabs.com", {
      delayMs: 0,
      fetchImpl: async () => { const c = codes[calls++]; return reply(c, c === 200 ? okBody : {}); },
    });
    expect(calls).toBe(2);
    expect(date).toBe("2025-11-29");
  });

  it("gives up rather than inventing an answer", async () => {
    let calls = 0;
    const date = await fetchDomainRegistrationDate("ascendbiolabs.com", {
      delayMs: 0, retries: 2,
      fetchImpl: async () => { calls++; return reply(429); },
    });
    expect(date).toBeNull();
    expect(calls).toBe(3); // the first attempt plus two retries
  });

  // A 404 is the registry answering: there is no record here. Retrying it just burns the budget
  // that the throttled lookups need.
  it("does not retry a definitive not-found", async () => {
    let calls = 0;
    await fetchDomainRegistrationDate("nope.example", {
      delayMs: 0, fetchImpl: async () => { calls++; return reply(404); },
    });
    expect(calls).toBe(1);
  });

  it("retries a transport failure too", async () => {
    let calls = 0;
    const date = await fetchDomainRegistrationDate("ascendbiolabs.com", {
      delayMs: 0,
      fetchImpl: async () => {
        calls++;
        if (calls === 1) throw new Error("socket hang up");
        return reply(200, okBody);
      },
    });
    expect(calls).toBe(2);
    expect(date).toBe("2025-11-29");
  });
});
