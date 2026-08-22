import { describe, expect, it } from "vitest";
import { unknownDomainVerdict } from "@/server/verify/index";
import type { Signal } from "@/server/verify/index";

// /verify is the site's headline action, and for a domain it has never seen it was publishing
// "{domain} — high risk, treat as unproven" / "Multiple warning signs on a vendor we don't track"
// off a count of `ok === false` signals. Two of the three are ABSENCES:
//
//   "No mentions found. Real vendors get talked about — silence is a mild warning."
//   "No third-party (Janoshik/MZ) test records found for this name."
//
// And the COA check only runs after the known-vendor list AND the organizations table have both
// missed — so for exactly the domains that reach it, it returns zero by construction. `bad >= 2`
// therefore meant "any ONE other false signal", and a real business whose domain was registered
// 89 days ago was enough to publish a high-risk verdict about it by name.
//
// The rest of the codebase already refuses this: grade.ts declines to publish a letter when every
// adverse signal is `inferred`, and trust-graph treats one inferred concern as context and two as
// a pattern. This path never got the same treatment.

const sig = (over: Partial<Signal>): Signal => ({ ok: null, label: "x", detail: "d", ...over });

const establishedDomain = sig({ ok: true, label: "Domain age", detail: "Registered 6.2 years ago", confidence: "inferred" });
const youngDomain = sig({ ok: false, label: "Domain age", detail: "Registered 12 days ago", confidence: "inferred" });
const noCoas = sig({ ok: false, label: "Independent COAs", detail: "No third-party test records found" });      // absence: untagged
const noMentions = sig({ ok: false, label: "Community (r/Peptides)", detail: "No mentions found" });            // absence: untagged
const scamReports = sig({ ok: false, label: "Community (r/Peptides)", detail: "2 look like scam complaints", confidence: "reported" });

describe("verdict for a domain we have never seen", () => {
  it("does not call an established vendor high risk for being absent from our records", () => {
    expect(unknownDomainVerdict([establishedDomain, noCoas, noMentions])).toBe("unproven");
  });

  // The exact live case: a real storefront, registered recently, that we simply do not track.
  it("does not call a new domain high risk on inference alone", () => {
    expect(unknownDomainVerdict([youngDomain, noCoas, noMentions])).toBe("unproven");
  });

  it("still says high risk when something was actually reported", () => {
    expect(unknownDomainVerdict([youngDomain, noCoas, scamReports])).toBe("high-risk");
  });

  it("says high risk on a reported concern even with an established domain", () => {
    expect(unknownDomainVerdict([establishedDomain, noCoas, scamReports])).toBe("high-risk");
  });

  // Absences must never accumulate into a verdict, however many of them there are.
  it("never reaches high risk by stacking absences", () => {
    expect(unknownDomainVerdict([noCoas, noMentions, sig({ ok: false, label: "Another gap", detail: "nothing on record" })])).toBe("unproven");
  });

  it("is unproven when nothing is known at all", () => {
    expect(unknownDomainVerdict([])).toBe("unproven");
  });
});
