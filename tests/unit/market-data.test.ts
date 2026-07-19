import { describe, expect, it } from "vitest";
import { combinedSimilarity, compactTerm, normalizeTerm, trigramSimilarity } from "@/server/market-data/normalize";

describe("market data normalization",()=>{
 it("normalizes punctuation, spacing, and accents",()=>{expect(normalizeTerm("  BPC–157 Acetate  ")).toBe("bpc 157 acetate");expect(compactTerm("MOTS-c")).toBe("motsc");});
 it("recognizes compact aliases and typo-near strings",()=>{expect(combinedSimilarity("BPC157","BPC-157")).toBeGreaterThan(.95);expect(trigramSimilarity("epitalon","epithalon")).toBeGreaterThan(.7);});
 it("does not overmatch unrelated labels",()=>{expect(combinedSimilarity("BPC-157","Northstar Research")).toBeLessThan(.35);});
});
