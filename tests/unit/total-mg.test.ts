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

  it("returns undefined for an ambiguous multi-size bundle (split at ingestion instead)", () => {
    expect(parseTotalMg("2MG", "TESAMORELIN PEPTIDE 2MG/5MG VIAL")).toBeUndefined();
    expect(parseTotalMg("5MG", "GHK-CU COPPER PEPTIDE 5MG/10MG/50MG/100MG VIAL")).toBeUndefined();
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
