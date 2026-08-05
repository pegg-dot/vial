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

  it("parses pinned entries whose <li> carries other attributes before data-test-id", () => {
    // The live portal pins blind-test results as <li class="sticky" data-test-id="…">.
    const sticky = `
      <li class="sticky" data-test-id="101083"><a href="https://verify.janoshik.com/tests/101083-Retatrutide_20mg_N7PPUVKCQ7GD">
        <span class="sample">Retatrutide 20mg</span>
        <span class="client">InnoPeptide</span>
        <span class="float-right manufacturer">Made By www.innopeptide.com</span></a></li>`;
    const entries = parseJanoshikFeed(sticky);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ testId: "101083", sampleName: "Retatrutide 20mg", client: "InnoPeptide", verifyKey: "N7PPUVKCQ7GD" });
  });

  it("collapses a pinned duplicate of a main-list entry to one record", () => {
    const dup = `
      <li class="sticky" data-test-id="202438"><a href="https://verify.janoshik.com/tests/202438-BPC157_F8IKXANLGX1R">
        <span class="sample">BPC-157</span></a></li>
      ${html}`;
    const entries = parseJanoshikFeed(dup);
    expect(entries.filter((e) => e.testId === "202438")).toHaveLength(1);
    expect(entries).toHaveLength(2);
  });
});

describe("manufacturer → vendor matching", () => {
  const vendors = [{ slug: "bluum-peptides", name: "Bluum Peptides", domain: "bluumpeptides.com" }];
  it("resolves a manufacturer name to a known vendor, or null", () => {
    expect(matchVendor("Bluum Peptides", vendors)).toBe("bluum-peptides");
    expect(matchVendor("www.LLYbio.com", vendors)).toBeNull();
  });

  it("attributes to the MOST SPECIFIC vendor, not the first that happens to overlap", () => {
    // Manufacturer "Amino Asylum" overlaps a broad "Amino" (key contained in it) and the specific
    // "Amino Asylum". First-match-wins would grab whichever iterates first; best-match picks the longer key.
    const vs = [
      { slug: "amino-generic", name: "Amino", domain: "amino.com" },              // key "amino" (5) — broad
      { slug: "amino-asylum", name: "Amino Asylum", domain: "aminoasylum.com" },  // key "aminoasylum" (11)
    ];
    expect(matchVendor("Amino Asylum", vs)).toBe("amino-asylum");
    // order-independence: the specific vendor wins regardless of list order.
    expect(matchVendor("Amino Asylum", [...vs].reverse())).toBe("amino-asylum");
  });

  it("a short manufacturer token inside two different vendor keys is ambiguous → null (overlap, not key length)", () => {
    // "Core" sits inside both "corepeptides" and "corelabs"; the real overlap is 4 for both, so it's a
    // tie and must not be confidently attributed to the longer-keyed vendor.
    const vs = [
      { slug: "core-peptides", name: "Core Peptides", domain: "corepeptides.com" },
      { slug: "core-labs", name: "Core Labs", domain: "corelabs.com" },
    ];
    expect(matchVendor("Core", vs)).toBeNull();
    expect(matchVendor("Core", [...vs].reverse())).toBeNull();
  });

  it("fails toward null on a genuine tie — never confidently mis-attributes a certificate", () => {
    // Two DIFFERENT vendors whose keys match the manufacturer equally well (same length) — ambiguous,
    // so the COA must not be handed to either; it stays attributed at the compound level.
    const vs = [
      { slug: "peptide-co-a", name: "Peptide Co", domain: "peptideco.com" },
      { slug: "peptide-co-b", name: "Peptide Co", domain: "peptidehub.com" },
    ];
    expect(matchVendor("Peptide Co", vs)).toBeNull();
  });
});
