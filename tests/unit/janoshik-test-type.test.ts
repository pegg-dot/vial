import { describe, expect, it } from "vitest";
import { parseJanoshikFeed, classifyTestNote } from "@/server/ingest/lab-tests";

describe("classifyTestNote", () => {
  it("flags blind tests — the gold-standard independence signal", () => {
    expect(classifyTestNote("Common GLP-1 peptide blind test (Semaglutide, Tirzepatide…)")).toMatchObject({ isBlind: true });
    expect(classifyTestNote("Blind common anabolic steroid and aromatase inhibitor screening")).toMatchObject({ isBlind: true, testType: "screening" });
    expect(classifyTestNote("Blind common anabolic steroid screening - oils")).toMatchObject({ isBlind: true, testType: "screening" });
  });

  it("does not mark ordinary vendor-submitted assessments as blind", () => {
    expect(classifyTestNote("Assessment of a peptide vial or vials.")).toEqual({ testType: "purity", isBlind: false });
    expect(classifyTestNote("GHK (or GHK-Cu) analysis")).toEqual({ testType: "purity", isBlind: false });
    expect(classifyTestNote("")).toEqual({ testType: "purity", isBlind: false });
  });

  it("separates safety tests from purity tests — different evidence entirely", () => {
    expect(classifyTestNote("Sterility Testing")).toMatchObject({ testType: "sterility" });
    expect(classifyTestNote("Endotoxin Analysis")).toMatchObject({ testType: "endotoxin" });
    expect(classifyTestNote("Heavy Metals Analysis")).toMatchObject({ testType: "heavy-metals" });
  });

  it("recognizes blends, dimer, and identity/solvent checks", () => {
    expect(classifyTestNote("BPC-157/TB-500 blend analysis")).toMatchObject({ testType: "blend" });
    expect(classifyTestNote("KLOW (GHK or GHK-Cu/ TB-500/ BPC-157/ KPV) analysis")).toMatchObject({ testType: "blend" });
    expect(classifyTestNote("Human Growth Hormone amount, purity and dimer analysis")).toMatchObject({ testType: "dimer" });
    expect(classifyTestNote("BAC water (Benzyl Alcohol) analysis")).toMatchObject({ testType: "identity" });
  });
});

describe("parseJanoshikFeed extracts the test-type note", () => {
  const html = `
    <li data-test-id="900"><a href="https://verify.janoshik.com/tests/900-Semaglutide_ABCD12345678">
      <span class="sample">Semaglutide 5mg</span>
      <span class="float-right tiny">Common GLP-1 peptide blind test (Semaglutide, Tirzepatide)</span>
      <span class="client">Acme</span></a></li>
    <li data-test-id="901"><a href="https://verify.janoshik.com/tests/901-BPC157_EFGH12345678">
      <span class="sample">BPC-157</span>
      <span class="float-right tiny">Assessment of a peptide vial or vials.</span></a></li>`;
  it("captures the note verbatim on each entry", () => {
    const entries = parseJanoshikFeed(html);
    expect(entries[0].note).toBe("Common GLP-1 peptide blind test (Semaglutide, Tirzepatide)");
    expect(entries[1].note).toBe("Assessment of a peptide vial or vials.");
    expect(classifyTestNote(entries[0].note).isBlind).toBe(true);
    expect(classifyTestNote(entries[1].note).isBlind).toBe(false);
  });
});
