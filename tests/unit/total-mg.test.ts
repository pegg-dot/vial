import { describe, expect, it } from "vitest";
import { parseTotalMg } from "@/lib/format";

// Every case below is a real listing shape from the live catalog. The point of parseTotalMg is that
// cost-per-mg is computed from the TOTAL a listing delivers, not the first "<n>mg" in the string.
describe("parseTotalMg — total delivered milligrams", () => {
  it("uses an explicitly stated bottle total", () => {
    expect(parseTotalMg("2MG", "GHK-CU COPPER PEPTIDE POWDER (60 CAPSULES) (2MG/CAPSULE, 120MG TOTAL BOTTLE)")).toBe(120);
    expect(parseTotalMg("500MCG", "BPC-157 PEPTIDE POWDER (60 CAPSULES) (500MCG/CAPSULE, 30MG TOTAL BOTTLE)")).toBe(30);
  });

  it("multiplies per-unit strength by the capsule/tablet count", () => {
    expect(parseTotalMg("0.5mg", "TB-500 (0.5mg/capsule), 60 Capsules")).toBe(30);
    expect(parseTotalMg("10mg", "MK-677 (Ibutamoren), (10mg/capsule) 60 Capsules")).toBe(600);
    expect(parseTotalMg("500mcg", "BPC-157 500mcg (100 tabs/bottle)")).toBe(50);
  });

  it("multiplies a single strength by a pack count (N x Ymg / Ymg x N / N vials)", () => {
    expect(parseTotalMg("", "10 x 3mg TB-500")).toBe(30);
    expect(parseTotalMg("5mg", "BPC-157 5mg x 10 vials")).toBe(50);
  });

  it("computes liquid total as concentration × volume", () => {
    expect(parseTotalMg("25mg", "MK-677 25mg/ml @ 30ml")).toBe(750);
    expect(parseTotalMg("25mg", "MK-677 25mg x 30ml")).toBe(750);
    expect(parseTotalMg("5mg", "BPC-157 5mg in 5ml bacteriostatic water")).toBe(5); // dissolved total
  });

  it("returns undefined for a concentration with no volume, and multi-compound combos", () => {
    expect(parseTotalMg("25mg", "Liquid MK-677 (Ibutamoren) – 25 mg/mL")).toBeUndefined();
    expect(parseTotalMg("50MG", "SLUBAM (BAM15 50MG & SLUPP332 250MCG) 60 Capsules")).toBeUndefined();
  });

  it("trusts the declared single size even when the product title lists a size range", () => {
    // Each split variant carries its own quantity; the "2mg/5mg" in the title must not blank it.
    expect(parseTotalMg("2MG", "TESAMORELIN PEPTIDE 2MG/5MG VIAL")).toBe(2);
    expect(parseTotalMg("5MG", "GHK-CU COPPER PEPTIDE 5MG/10MG/50MG/100MG VIAL")).toBe(5);
  });

  it("returns undefined for a multi-size title with no single declared size", () => {
    expect(parseTotalMg("", "TESAMORELIN PEPTIDE 2MG/5MG VIAL")).toBeUndefined();
    expect(parseTotalMg("1 vial", "GHK-CU COPPER PEPTIDE 5MG/10MG/50MG/100MG VIAL")).toBeUndefined();
  });

  it("returns undefined for a capsule/tablet container with no stated count (unknown total)", () => {
    expect(parseTotalMg("500MCG", "BPC-157 500MCG Capsules")).toBeUndefined();
  });

  it("returns undefined when there is no strength to read (volumes, bare names)", () => {
    expect(parseTotalMg("30ML", "GHK-Cu topical 30ml")).toBeUndefined();
    expect(parseTotalMg("1 vial", "BPC-157")).toBeUndefined();
  });

  it("leaves a plain single-vial listing exactly as before (incl. legitimately-pricey small vials)", () => {
    expect(parseTotalMg("10mg", "BPC-157 10mg")).toBe(10);
    expect(parseTotalMg("600mg", "NAD+ 600mg")).toBe(600);
    expect(parseTotalMg("100mcg", "GnRH (Triptorelin) 100 mcg")).toBeCloseTo(0.1, 5);
    expect(parseTotalMg("1mg", "Epitalon 1mg")).toBe(1);
  });
});

// The cases below are quoted verbatim from live listings and from the WooCommerce Store API
// payloads those listings are built from. Each one was returning NO cost-per-mg (or, in the
// capsule case, a 60×-wrong one) before the size units and separators here were read.
describe("parseTotalMg — sizes vendors really publish", () => {
  it("reads bulk powders sold in grams", () => {
    expect(parseTotalMg("1 vial", "DIHEXA POWDER (1 GRAM)")).toBe(1000);
    expect(parseTotalMg("1 vial", "GLUTATHIONE POWDER (10 GRAMS)")).toBe(10000);
    expect(parseTotalMg("1 vial", "NAD+ (Nicotinamide Adenine Dinucleotide) &#8211; Powder, 10 grams")).toBe(10000);
    expect(parseTotalMg("1 Gram", "MK-677 Powder")).toBe(1000);
    expect(parseTotalMg("10 Grams", "5 Amino 1MQ")).toBe(10000);
  });

  it("reads a size attribute spelled out in words (umbrellalabs.is writes every option this way)", () => {
    expect(parseTotalMg("10 Milligrams", "GLP-3R (LY-3437943) PEPTIDE VIAL")).toBe(10);
    expect(parseTotalMg("2 Milligrams", "GLP-3R (LY-3437943) PEPTIDE VIAL")).toBe(2);
    expect(parseTotalMg("500 Micrograms", "Tesofensine Powder")).toBe(0.5);
  });

  it("prefers the vendor's own stated TOTAL over a per-capsule strength", () => {
    // Was 250 — the per-capsule figure — which priced a 15-gram bottle 60× too high per mg.
    expect(parseTotalMg("250MG", "GLUTATHIONE POWDER (60 CAPSULES) (250MG/CAPSULE, 15 GRAMS TOTAL)")).toBe(15000);
  });

  it("multiplies a per-unit strength by a count written as 'ct' or with a hyphen", () => {
    expect(parseTotalMg("50mg capsule/60ct/3000mg", "5 Amino 1MQ")).toBe(3000);              // purerawz.co
    expect(parseTotalMg("300mcg per tablet/100ct/30mg", "Semax(ACTH (4-7) Pro-Gly-Pro)")).toBe(30);
    expect(parseTotalMg("10mg · 10-vial kit", "Tesamorelin")).toBe(100);                     // chameleonpeptides.com
    expect(parseTotalMg("10mg · Single vial", "Tesamorelin")).toBe(10);
    expect(parseTotalMg("5mg/vial × 50 vials", "BPC 157 &#8211; 50 VIALS AT 30 PERCENT OFF")).toBe(250);
  });

  it("reads a concentration written as 'per mL', not only as 'mg/mL'", () => {
    // The vendor's own arithmetic confirms this one: 545 mg/mL × 50 mL is the 27.25 g it states.
    expect(parseTotalMg("50ml/545mg per ml/27.25g", "Carnitine MAX Injectable")).toBe(27250);
    expect(parseTotalMg("100mcg+ per spray (10mL bottle @ 1mg per mL)", "N-Acetyl Selank Spray")).toBe(10);
    expect(parseTotalMg("300mcg/spray = 30mg total", "Semax(ACTH (4-7) Pro-Gly-Pro)")).toBe(30);
  });

  it("still returns NOTHING when the size is genuinely ambiguous or absent", () => {
    // A blend states two strengths and a combined total; which one a price buys is unknowable.
    expect(parseTotalMg("5mg + 5mg (10mg)", "BPC-157 & TB-500 Blend")).toBeUndefined();
    expect(parseTotalMg("GHK/KPV Blend 50MG/10MG", "GHK-Cu/KPV Blend")).toBeUndefined();
    // A size RANGE with no single declared size.
    expect(parseTotalMg("1 vial", "BPC-157 5mg/10mg")).toBeUndefined();
    // A capsule bottle with a count but no per-capsule strength.
    expect(parseTotalMg("100 Capsules", "Tesofensine")).toBeUndefined();
    expect(parseTotalMg("1 vial", "SLU-PP-332 POWDER (60 CAPSULES)")).toBeUndefined();
    // A concentration with no stated volume.
    expect(parseTotalMg("300MCG/ML - Liquid", "SLU-PP-332")).toBeUndefined();
    // Vendors publish no size at all for these; they must keep showing no cost-per-mg.
    expect(parseTotalMg("1 vial", "GHRP-2")).toBeUndefined();
    expect(parseTotalMg("1 vial", "IPAM (Indolepropionamide)")).toBeUndefined();
    expect(parseTotalMg("1 vial", "RAD-140 + MK-677 + GW-501516 Value Pack")).toBeUndefined();
  });

  it("never mistakes a molecular weight for a size", () => {
    // peptidepros.net prints "Molecular Weight 1419.556 g/mol" in the same spec block as the size.
    expect(parseTotalMg("", "Molecular Weight 1419.556 g/mol")).toBeUndefined();
    expect(parseTotalMg("", "Molecular Weight BPC 157 C 62 H 98 N 15 O 22 1419.556 g/mol")).toBeUndefined();
  });
});
