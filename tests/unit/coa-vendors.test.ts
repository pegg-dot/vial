import { describe, expect, it } from "vitest";
import { cleanVendorString, looksLikeVendor, deriveCoaVendors, canonicalizeVendorSlug, canonicalizeVendorName } from "@/server/ingest/coa-vendors";

describe("COA vendor derivation", () => {
  it("strips marketing cruft to a clean vendor name", () => {
    expect(cleanVendorString("CertaPeptides | EU VENDOR | 99.3% Average Purity")?.name).toBe("CertaPeptides");
    expect(cleanVendorString("HM Peptide| Wholesale | OEM service")?.name).toBe("HM Peptide");
    expect(cleanVendorString("Crystal Peptides EU (de. / fr. / it.)")?.name).toBe("Crystal Peptides EU");
  });

  it("builds a name and domain from a URL", () => {
    const v = cleanVendorString("https://alphabiopharma.info");
    expect(v?.domain).toBe("alphabiopharma.info");
    expect(v?.name).toBe("Alphabiopharma");
    const w = cleanVendorString("www.certapeptides.com");
    expect(w?.domain).toBe("certapeptides.com");
    expect(w?.slug).toBe("certapeptides");
  });

  it("rejects noise", () => {
    expect(cleanVendorString("Unknown")).toBeNull();
    expect(cleanVendorString("")).toBeNull();
    expect(cleanVendorString("  ")).toBeNull();
  });

  it("scrubs Cloudflare email-protection artifacts and contact tails out of the name", () => {
    expect(cleanVendorString("ReinzielBiotech Email: [email&#160;protected]")).toMatchObject({ name: "ReinzielBiotech", slug: "reinzielbiotech" });
    expect(cleanVendorString("HTRA Peptides [email protected]")).toMatchObject({ slug: "htra-peptides" });
    expect(cleanVendorString("Meipeptide WhatsApp: +8613800000000")).toMatchObject({ slug: "meipeptide" });
    // A string that is ONLY contact cruft resolves to nothing, not a junk vendor.
    expect(cleanVendorString("Email: [email protected]")).toBeNull();
  });

  it("resolves an e-mail address to its host, and a freemail address to nothing", () => {
    // The feed's clients often sign with an address. The person is not the vendor; the host is —
    // and it must land on the same profile the manufacturer field already names.
    expect(cleanVendorString("admin@reta-peptide.com")).toMatchObject({ slug: "reta-peptide", domain: "reta-peptide.com" });
    expect(cleanVendorString("RETA-PEPTIDE")?.slug).toBe("reta-peptide");
    expect(cleanVendorString("www.reta-peptide.com")?.slug).toBe("reta-peptide");
    expect(cleanVendorString("info@peptidegurus.com")?.slug).toBe("peptidegurus");
    expect(cleanVendorString("PEPTIDEGURUS.COM")?.slug).toBe("peptidegurus");
    expect(cleanVendorString("Acme Peptides sales@acme-peptides.com")).toMatchObject({ name: "Acme Peptides", domain: "acme-peptides.com" });
    // A freemail address names nobody: noise, so the manufacturer decides.
    expect(cleanVendorString("agoodpeptide@gmail.com")).toBeNull();
    expect(cleanVendorString("nouvepen@protonmail.com")).toBeNull();
    const { vendorByTestId, vendors } = deriveCoaVendors([
      { testId: "1", client: "agoodpeptide@gmail.com", manufacturer: "www.agoodpeptide.com" },
      { testId: "2", client: "admin@reta-peptide.com", manufacturer: "www.reta-peptide.com" },
      { testId: "3", client: "RETA-PEPTIDE", manufacturer: "www.reta-peptide.com" },
    ]);
    expect(vendorByTestId.get("1")).toBe("agoodpeptide");
    expect(vendorByTestId.get("2")).toBe("reta-peptide");
    expect(vendorByTestId.get("3")).toBe("reta-peptide");
    expect(vendors.map((v) => v.slug).sort()).toEqual(["agoodpeptide", "reta-peptide"]);
  });

  it("only treats domain-or-keyword strings as vendors", () => {
    expect(looksLikeVendor({ name: "Cocer Peptides", slug: "cocer-peptides" })).toBe(true);
    expect(looksLikeVendor({ name: "Alpha", slug: "alpha", domain: "alpha.com" })).toBe(true);
    expect(looksLikeVendor({ name: "Mandy", slug: "mandy" })).toBe(false);
  });

  it("canonicalizes near-duplicate vendor names onto one slug (legal suffix + admin handle)", () => {
    // The real dupes we found: a legal suffix on one cert but not another, and an "admin" handle.
    expect(cleanVendorString("Zztai Peptide Ltd")?.slug).toBe("zztai-peptide");
    expect(cleanVendorString("Zztai Peptide")?.slug).toBe("zztai-peptide");
    expect(cleanVendorString("Admin Rayshine Peptide")?.slug).toBe("rayshine-peptide");
    expect(cleanVendorString("Rayshine Peptide")?.slug).toBe("rayshine-peptide");
    // slug-level canonicalization (used to merge already-stored dupes) agrees.
    expect(canonicalizeVendorSlug("zztai-peptide-ltd")).toBe("zztai-peptide");
    expect(canonicalizeVendorSlug("admin-rayshine-peptide")).toBe("rayshine-peptide");
    expect(canonicalizeVendorName("Lilipetide Technology Co., Ltd.")).toBe("Lilipetide Technology");
  });

  it("never fuses genuinely distinct vendors", () => {
    // "co"/"corp" only strip as a trailing legal token — not inside a real name.
    expect(canonicalizeVendorSlug("cocer-peptides")).toBe("cocer-peptides");
    expect(canonicalizeVendorSlug("nova-peptide")).toBe("nova-peptide");
    expect(canonicalizeVendorSlug("aurobiopeptide")).toBe("aurobiopeptide");
    expect(cleanVendorString("Cocer Peptides")?.slug).toBe("cocer-peptides");
    // distinct makers stay on distinct slugs
    const { vendors } = deriveCoaVendors([
      { testId: "a", client: "Nova Peptide", manufacturer: "x" },
      { testId: "b", client: "Auro Bio Peptide", manufacturer: "y" },
    ]);
    expect(vendors.map((v) => v.slug).sort()).toEqual(["auro-bio-peptide", "nova-peptide"]);
  });

  it("merges duplicate clients in deriveCoaVendors", () => {
    const { vendors, vendorByTestId } = deriveCoaVendors([
      { testId: "1", client: "Zztai Peptide Ltd", manufacturer: "m" },
      { testId: "2", client: "Zztai Peptide", manufacturer: "m" },
    ]);
    expect(vendorByTestId.get("1")).toBe("zztai-peptide");
    expect(vendorByTestId.get("2")).toBe("zztai-peptide");
    expect(vendors).toHaveLength(1);
  });

  it("derives a de-duplicated vendor set and ties each COA to a vendor (client preferred)", () => {
    const entries = [
      { testId: "1", client: "CertaPeptides | EU VENDOR", manufacturer: "Alpha BioPharma" },
      { testId: "2", client: "CertaPeptides", manufacturer: "Some Raw Co" },
      { testId: "3", client: "Mandy", manufacturer: "PeptideGurus" },   // client is noise → falls back to maker
    ];
    const { vendors, vendorByTestId } = deriveCoaVendors(entries);
    expect(vendorByTestId.get("1")).toBe("certapeptides");
    expect(vendorByTestId.get("2")).toBe("certapeptides");
    expect(vendorByTestId.get("3")).toBe("peptidegurus");   // fell back to manufacturer
    expect(vendors.map((v) => v.slug).sort()).toEqual(["certapeptides", "peptidegurus"]);
  });
});
