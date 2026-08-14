import { describe, expect, it } from "vitest";
import rawRecords from "@/server/data/compound-regulatory-status.json";

interface CompoundRecord { slug: string; regulatoryStatus: string; fdaApproved: boolean; sourceUrls: string[] }
const records = rawRecords as CompoundRecord[];

// `regulatory_status` is one of the most decision-relevant facts on a compound page.
//
// The badge above it USED to be inferred from this free text with /FDA-approved/i && !/Not FDA/i,
// so "Not AN FDA-approved drug" defeated the negation and painted GHK-Cu — an unapproved
// substance — with the green approved card. The panel now reads the stored `fdaApproved` boolean
// and has no green state at all, so prose can no longer decide the badge.
//
// This check survives for a different reason: a record whose sentence says "not approved" while
// its flag says approved is a RESEARCH error, and these tests are the last gate before it reaches
// a page. It asserts the two agree — not that the badge depends on the words.
const proseReadsApproved = (text: string) =>
  /FDA-approved/i.test(text) && !/\b(?:not|no|never|nor|isn't|aren't|without)\b[^.;]{0,24}FDA-approved/i.test(text);

describe("curated compound regulatory status", () => {
  it("has a unique slug per record", () => {
    const slugs = records.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps the prose and the stored flag saying the same thing", () => {
    const wrong = records.filter((r) => proseReadsApproved(r.regulatoryStatus) !== r.fdaApproved);
    expect(wrong.map((r) => r.slug)).toEqual([]);
  });

  it("catches the exact wording that defeated the old negation", () => {
    // The GHK-Cu sentence, verbatim in shape. If this ever reads `true` again, the guard has
    // regressed to the version that shipped a false approval.
    expect(proseReadsApproved("Not an FDA-approved drug for any indication.")).toBe(false);
    expect(proseReadsApproved("There is no FDA-approved product containing it.")).toBe(false);
    expect(proseReadsApproved("FDA-approved as Victoza (2010) for type 2 diabetes.")).toBe(true);
  });

  it("never states an approved drug is the thing sold here", () => {
    // Where an approved drug exists it is never the online vial — SCENESSE is an implant a
    // clinician places; Forzinity treats Barth syndrome. Every approved record must say so, or the
    // page reads as "this product is FDA-approved", which is the false claim the site exists to catch.
    for (const r of records.filter((r) => r.fdaApproved)) {
      expect(r.regulatoryStatus, `${r.slug} claims approval without distinguishing the sold material`)
        .toMatch(/is not (?:that|an approved) product|not the approved product|falls outside any approved product/i);
    }
  });

  it("carries at least one https source for every claim", () => {
    for (const r of records) {
      expect(r.sourceUrls.length, `${r.slug} has no source`).toBeGreaterThan(0);
      for (const u of r.sourceUrls) expect(u, `${r.slug} source is not https`).toMatch(/^https:\/\//);
    }
  });

  it("stays within the short factual house voice", () => {
    for (const r of records) {
      expect(r.regulatoryStatus.length, `${r.slug} is too terse`).toBeGreaterThan(20);
      expect(r.regulatoryStatus.length, `${r.slug} is too long for the card`).toBeLessThan(420);
    }
  });

  it("gives no dosing, safety endorsement, or use advice", () => {
    // The product boundary: this field states regulatory fact only. It must never read as a
    // recommendation, a safety clearance, or an instruction for human use.
    const banned = /\b(safe for|proven safe|recommended dose|dosage|how to (?:use|inject)|you should|we recommend)\b/i;
    for (const r of records) expect(r.regulatoryStatus, `${r.slug} reads as advice`).not.toMatch(banned);
  });
});
