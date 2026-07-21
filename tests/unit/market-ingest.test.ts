import { describe, expect, it } from "vitest";
import { matchCompound } from "@/server/ingest/shopify-import";
import { parseJanoshikFeed, matchVendor } from "@/server/ingest/lab-tests";

const COMPOUNDS = [
  { slug: "bpc-157", name: "BPC-157", aliases: ["BPC 157", "Body Protection Compound 157"] },
  { slug: "tb-500", name: "TB-500", aliases: ["TB500", "Thymosin Beta-4 fragment"] },
  { slug: "cjc-1295", name: "CJC-1295", aliases: ["CJC 1295", "Mod GRF 1-29"] },
  { slug: "semaglutide", name: "Semaglutide", aliases: ["Ozempic", "Wegovy"] },
  { slug: "gonadorelin", name: "Gonadorelin", aliases: ["GnRH"] },
];

describe("Shopify title → compound matching", () => {
  it("matches single compounds, handles variants, rejects blends and non-peptides", () => {
    expect(matchCompound("BPC-157 5mg", COMPOUNDS)).toBe("bpc-157");
    expect(matchCompound("Gonadorelin", COMPOUNDS)).toBe("gonadorelin");
    expect(matchCompound("CJC-1295 DAC", COMPOUNDS)).toBe("cjc-1295"); // variant, still one compound
    expect(matchCompound("Ozempic (Semaglutide)", COMPOUNDS)).toBe("semaglutide"); // alias
    expect(matchCompound("BPC-157 + TB-500 blend", COMPOUNDS)).toBeNull(); // blend
    expect(matchCompound("Phosphate Buffered Saline (PBS)", COMPOUNDS)).toBeNull(); // non-peptide
    expect(matchCompound("Bacteriostatic Water", COMPOUNDS)).toBeNull();
  });
});

describe("Janoshik feed parsing", () => {
  const html = `
    <li data-test-id="202438"><a href="https://verify.janoshik.com/tests/202438-BPC157_F8IKXANLGX1R">
      <span class="sample">BPC-157</span>
      <span class="client">https://alphabiopharma.info</span>
      <span class="float-right manufacturer">Made By Alpha BioPharma</span></a></li>
    <li data-test-id="149759"><a href="https://verify.janoshik.com/tests/149759-Retatrutide_20mg_N7MTRFA575RS">
      <span class="sample">Retatrutide 20mg</span>
      <span class="float-right manufacturer">Made By www.LLYbio.com</span></a></li>`;

  it("extracts test id, compound, manufacturer, verify url, and key", () => {
    const entries = parseJanoshikFeed(html);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ testId: "202438", sampleName: "BPC-157", manufacturer: "Alpha BioPharma", verifyKey: "F8IKXANLGX1R" });
    expect(entries[1].sampleName).toBe("Retatrutide 20mg");
    expect(entries[1].verifyUrl).toContain("149759");
  });
});

describe("manufacturer → vendor matching", () => {
  const vendors = [{ slug: "bluum-peptides", name: "Bluum Peptides", domain: "bluumpeptides.com" }];
  it("resolves a manufacturer name to a known vendor, or null", () => {
    expect(matchVendor("Bluum Peptides", vendors)).toBe("bluum-peptides");
    expect(matchVendor("www.LLYbio.com", vendors)).toBeNull();
  });
});
