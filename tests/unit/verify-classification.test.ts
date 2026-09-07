import { describe, expect, it } from "vitest";
import { findKnownVendor, looksLikeCoaCode, normalizeCoaCode, registrableDomain, extractDomain } from "@/server/verify";

// The router in front of every verdict. Until 2026-09-07 it had no end-to-end coverage at all:
// `extractDomain` and `looksLikeCoaCode` were unit-tested on four inputs between them, and nothing
// checked what the chain of if-statements did with a real query. The composed verdict underneath is
// exhaustively tested; the question of WHICH verdict a query reaches was not tested at all.

describe("registrableDomain", () => {
  it("reduces a host to the name someone actually registered", () => {
    expect(registrableDomain("bluumpeptides.com")).toBe("bluumpeptides.com");
    expect(registrableDomain("www.bluumpeptides.com")).toBe("bluumpeptides.com");
    expect(registrableDomain("shop.bluumpeptides.com")).toBe("bluumpeptides.com");
    expect(registrableDomain("a.b.c.bluumpeptides.com")).toBe("bluumpeptides.com");
  });

  it("keeps a multi-part public suffix whole, so a .co.uk site is not read as 'co.uk'", () => {
    expect(registrableDomain("someshop.co.uk")).toBe("someshop.co.uk");
    expect(registrableDomain("www.someshop.co.uk")).toBe("someshop.co.uk");
    expect(registrableDomain("shop.someshop.com.au")).toBe("someshop.com.au");
  });

  it("returns null for things that are not hosts", () => {
    expect(registrableDomain("BPC-157")).toBeNull();
    expect(registrableDomain("")).toBeNull();
    expect(registrableDomain("com")).toBeNull();
  });
});

// The defect this file was opened for.
//
// Matching was `ndm.includes(nd) || nd.includes(ndm)` on the domain with its TLD stripped, so any
// domain CONTAINING a tracked vendor's name inherited that vendor's verdict. On the site's headline
// anti-scam tool, a typosquat of a trusted shop was answered "generally trusted" — the tool
// endorsing the exact attack it exists to catch. It ran the other way too: a domain containing a
// red-flagged vendor's name would have been published as "do not buy" by name.
describe("findKnownVendor — a domain matches the vendor that registered it, and nothing else", () => {
  const KNOWN = "bluumpeptides.com";

  it("matches the vendor's own domain, with or without www or a path", () => {
    expect(findKnownVendor(KNOWN, extractDomain(KNOWN))?.slug).toBe("bluum-peptides");
    expect(findKnownVendor(`https://www.${KNOWN}/products/x`, extractDomain(`https://www.${KNOWN}/products/x`))?.slug).toBe("bluum-peptides");
  });

  it("matches a subdomain the vendor legitimately controls", () => {
    expect(findKnownVendor(`shop.${KNOWN}`, extractDomain(`shop.${KNOWN}`))?.slug).toBe("bluum-peptides");
  });

  it("refuses a typosquat that merely contains the vendor's name", () => {
    for (const impostor of ["bluumpeptides-shop.com", "buy-bluumpeptides.net", "bluumpeptides2.com"]) {
      expect(findKnownVendor(impostor, extractDomain(impostor)), impostor).toBeNull();
    }
  });

  it("refuses a domain that only puts the vendor's name in a subdomain of someone else's site", () => {
    // The registrable domain here is scam.ru. Reading it as Bluum Peptides is how a phishing link
    // gets a trusted verdict from us.
    expect(findKnownVendor("bluumpeptides.scam.ru", extractDomain("bluumpeptides.scam.ru"))).toBeNull();
  });

  it("refuses a generic domain that happens to be a substring of a tracked one", () => {
    expect(findKnownVendor("peptides.com", extractDomain("peptides.com"))).toBeNull();
    expect(findKnownVendor("amino.com", extractDomain("amino.com"))).toBeNull();
  });

  it("still matches a vendor by its exact name", () => {
    expect(findKnownVendor("Bluum Peptides", null)?.slug).toBe("bluum-peptides");
    expect(findKnownVendor("bluumpeptides", null)?.slug).toBe("bluum-peptides");
  });
});

describe("normalizeCoaCode — what a person actually pastes", () => {
  const CODE = "F8IKXANLGX1R";

  it("accepts the code as printed", () => {
    expect(normalizeCoaCode(CODE)).toBe(CODE);
  });

  it("accepts it lowercase — the lookup upper-cases anyway, so rejecting it was pure loss", () => {
    expect(normalizeCoaCode(CODE.toLowerCase())).toBe(CODE);
  });

  it("accepts it with the whitespace and punctuation a copy-paste drags along", () => {
    expect(normalizeCoaCode(`  ${CODE}  `)).toBe(CODE);
    expect(normalizeCoaCode("F8IK XANL GX1R")).toBe(CODE);
    expect(normalizeCoaCode("F8IK-XANL-GX1R")).toBe(CODE);
    expect(normalizeCoaCode(`#${CODE}`)).toBe(CODE);
  });

  it("does not turn an ordinary phrase into a code by deleting its spaces", () => {
    // "some words here" compacts to 13 alnum characters, which the raw length test would accept.
    expect(normalizeCoaCode("some words here")).toBeNull();
    expect(normalizeCoaCode("peptide sciences")).toBeNull();
  });

  it("rejects lengths outside the code format", () => {
    expect(normalizeCoaCode("SHORT")).toBeNull();
    expect(normalizeCoaCode("A".repeat(17))).toBeNull();
  });

  it("looksLikeCoaCode agrees with it", () => {
    expect(looksLikeCoaCode(CODE.toLowerCase())).toBe(true);
    expect(looksLikeCoaCode("some words here")).toBe(false);
  });
});
