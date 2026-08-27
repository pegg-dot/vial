import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { upsertLiveVendor } from "@/server/ingest/live-sources";
import { listEnforcementPage, recordRegulatoryAction, getRegulatoryStats } from "@/server/regulatory/repository";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "enforcement-search-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "enforcement-search-privacy-secret-at-least-32-ch";

const VENDORS = [
  { slug: "swiss-chems", name: "Swiss Chems", domains: ["swisschems.is"] },
  { slug: "paradigm-peptides", name: "Paradigm Peptides", domains: ["paradigmpeptides.com"] },
];

// Nine real-shaped records: two naming a tracked vendor (one severe, one caution), and seven
// unmatched openFDA-style recalls — the ratio the live feed actually has, which is why the page
// pages at all. "Titan Sarms" exists twice so a search can be shown to return MORE than one row.
const ACTIONS = [
  { actionType: "doj_action" as const, agency: "DOJ" as const, subjectName: "Operator of paradigmpeptides.com", outcome: "guilty_plea" as const, title: "Guilty plea — misbranded drugs", summary: "Pleaded guilty to selling misbranded SARMs.", actionDate: "2025-12-01", sourceUrl: "https://www.justice.gov/paradigm-plea" },
  { actionType: "warning_letter" as const, agency: "FDA" as const, subjectName: "Operator of swisschems.is", title: "FDA warning letter", summary: "Unapproved new drugs sold as research chemicals.", actionDate: "2024-12-10", sourceUrl: "https://www.fda.gov/swisschems-695663" },
  { actionType: "warning_letter" as const, agency: "FDA" as const, subjectName: "Titan Sarms LLC", title: "FDA warning letter", summary: "SARMs marketed as unapproved drugs.", actionDate: "2025-12-12", sourceUrl: "https://www.fda.gov/titan-1" },
  { actionType: "import_alert" as const, agency: "FDA" as const, subjectName: "Titan Sarms LLC", title: "Import alert 66-41", summary: "Detention without physical examination.", actionDate: "2025-12-20", sourceUrl: "https://www.fda.gov/titan-2" },
  { actionType: "recall" as const, agency: "FDA" as const, subjectName: "Optimal Balance Pharmacy", title: "Voluntary nationwide recall of compounded glutathione", summary: "Elevated bacterial endotoxin levels.", actionDate: "2026-01-05", sourceUrl: "https://www.fda.gov/optimal-balance" },
  { actionType: "recall" as const, agency: "FDA" as const, subjectName: "Endo Sterile Solutions", title: "Recall of sterile injectables", summary: "Sterility assurance failure.", actionDate: "2026-01-06", sourceUrl: "https://www.fda.gov/endo-sterile" },
  { actionType: "recall" as const, agency: "FDA" as const, subjectName: "Vista Compounding", title: "Recall of compounded semaglutide", summary: "Subpotent product.", actionDate: "2026-01-07", sourceUrl: "https://www.fda.gov/vista" },
  { actionType: "ftc_action" as const, agency: "FTC" as const, subjectName: "Peak Wellness Group", outcome: "settlement" as const, title: "FTC settlement over deceptive health claims", summary: "Deceptive advertising of peptide products.", actionDate: "2026-01-08", sourceUrl: "https://www.ftc.gov/peak-wellness" },
  { actionType: "advisory" as const, agency: "FDA" as const, subjectName: "Market-wide", title: "Advisory on research-chemical peptides", summary: "General advisory naming no specific seller.", actionDate: "2026-01-09", sourceUrl: "https://www.fda.gov/advisory-1" },
];

describe("enforcement search", () => {
  beforeAll(async () => {
    await resetDatabaseForTests();
    const db = await getDatabase();
    for (const v of VENDORS) await upsertLiveVendor(db, { slug: v.slug, name: v.name, domains: v.domains, description: "t" });
    for (const a of ACTIONS) await recordRegulatoryAction(db, { ...a, isPrimarySource: true }, VENDORS);
  });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("holds the corpus the rest of these assertions are measured against", async () => {
    const db = await getDatabase();
    const stats = await getRegulatoryStats(db);
    expect(stats.total).toBe(ACTIONS.length);
    const page = await listEnforcementPage({ connection: db, filter: "all" });
    expect(page.total).toBe(ACTIONS.length);
    expect(page.all).toBe(ACTIONS.length);
  });

  it("narrows the record to the company the buyer typed", async () => {
    const db = await getDatabase();
    const all = await listEnforcementPage({ connection: db, filter: "all" });
    const hit = await listEnforcementPage({ connection: db, filter: "all", q: "titan" });
    expect(hit.total).toBeLessThan(all.total);
    expect(hit.total).toBe(2);
    expect(hit.items).toHaveLength(2);
    expect(hit.items.every((a) => a.subject_name === "Titan Sarms LLC")).toBe(true);
  });

  it("keeps the total truthful when the search spans more than one page", async () => {
    // The "Showing N-M of T" line is the page's honesty about what it is not showing. T must be the
    // count of everything the search matches, not the length of the slice that came back.
    const db = await getDatabase();
    const first = await listEnforcementPage({ connection: db, filter: "all", q: "recall", perPage: 10 });
    expect(first.total).toBe(3);   // 2 titled "Recall...", 1 titled "Voluntary nationwide recall..."
    expect(first.items).toHaveLength(3);

    const paged = await listEnforcementPage({ connection: db, filter: "all", q: "recall", perPage: 10, page: 1 });
    expect(paged.total).toBe(3);
    // perPage is floored at 10 by the repository, so page 2 of a 3-row result is deliberately empty
    // while the TOTAL stays 3 — the count must describe the result set, never the current slice.
    const second = await listEnforcementPage({ connection: db, filter: "all", q: "recall", perPage: 10, page: 2 });
    expect(second.total).toBe(3);
    expect(second.items).toHaveLength(0);
  });

  it("matches the company as WE know it, not only as the agency named it", async () => {
    // The DOJ record names "Operator of paradigmpeptides.com". A buyer types "Paradigm Peptides",
    // which is the organizations.display_name we resolved it to. Both must find the record.
    const db = await getDatabase();
    const byOurName = await listEnforcementPage({ connection: db, filter: "all", q: "Paradigm Peptides" });
    expect(byOurName.total).toBe(1);
    expect(byOurName.items[0].vendor_slug).toBe("paradigm-peptides");
    const bySubject = await listEnforcementPage({ connection: db, filter: "all", q: "paradigmpeptides.com" });
    expect(bySubject.items.map((a) => a.id)).toEqual(byOurName.items.map((a) => a.id));
  });

  it("matches the title of an action, not only a company", async () => {
    const db = await getDatabase();
    const page = await listEnforcementPage({ connection: db, filter: "all", q: "import alert" });
    expect(page.total).toBe(1);
    expect(page.items[0].title).toBe("Import alert 66-41");
  });

  it("intersects the search with the filter rather than widening it", async () => {
    const db = await getDatabase();
    const searched = await listEnforcementPage({ connection: db, filter: "all", q: "titan" });
    const both = await listEnforcementPage({ connection: db, filter: "severe", q: "titan" });
    expect(both.total).toBeLessThanOrEqual(searched.total);
    expect(both.total).toBe(0);   // Titan's records are warning letter + import alert, neither severe
    const matched = await listEnforcementPage({ connection: db, filter: "matched", q: "swiss" });
    expect(matched.total).toBe(1);
    expect(matched.items[0].vendor_slug).toBe("swiss-chems");
  });

  it("scopes each chip's count to the active search, so a chip cannot promise rows it will not show", async () => {
    const db = await getDatabase();
    const unsearched = await listEnforcementPage({ connection: db, filter: "all" });
    expect(unsearched.matched).toBe(2);
    expect(unsearched.severe).toBe(2);   // DOJ guilty plea + FTC settlement

    const searched = await listEnforcementPage({ connection: db, filter: "all", q: "titan" });
    expect(searched.all).toBe(2);
    expect(searched.matched).toBe(0);
    expect(searched.severe).toBe(0);
    // And the chip count is exactly what selecting that chip returns.
    expect((await listEnforcementPage({ connection: db, filter: "matched", q: "titan" })).total).toBe(searched.matched);
    expect((await listEnforcementPage({ connection: db, filter: "severe", q: "titan" })).total).toBe(searched.severe);
  });

  it("treats LIKE wildcards as literal characters, not as a pattern", async () => {
    // The term is bound as a parameter and compared with strpos(). If it were ever interpolated
    // into a LIKE pattern, "%" would match the entire record and "_" would match any single
    // character — a search box that silently returns everything is worse than none.
    const db = await getDatabase();
    expect((await listEnforcementPage({ connection: db, filter: "all", q: "%" })).total).toBe(0);
    expect((await listEnforcementPage({ connection: db, filter: "all", q: "_" })).total).toBe(0);
    expect((await listEnforcementPage({ connection: db, filter: "all", q: "Tita_" })).total).toBe(0);
  });

  it("does not let a quote or a semicolon in the search term change the query", async () => {
    const db = await getDatabase();
    const injected = await listEnforcementPage({ connection: db, filter: "all", q: "'; DROP TABLE regulatory_actions; --" });
    expect(injected.total).toBe(0);
    // The table is still there and still holds everything.
    expect((await listEnforcementPage({ connection: db, filter: "all" })).total).toBe(ACTIONS.length);
  });

  it("ignores case and surrounding whitespace, and treats a blank search as no search", async () => {
    const db = await getDatabase();
    expect((await listEnforcementPage({ connection: db, filter: "all", q: "  TiTaN  " })).total).toBe(2);
    expect((await listEnforcementPage({ connection: db, filter: "all", q: "   " })).total).toBe(ACTIONS.length);
    expect((await listEnforcementPage({ connection: db, filter: "all", q: "" })).total).toBe(ACTIONS.length);
  });

  it("returns nothing rather than everything for a company with no record", async () => {
    const db = await getDatabase();
    const page = await listEnforcementPage({ connection: db, filter: "all", q: "a-company-with-no-record" });
    expect(page.total).toBe(0);
    expect(page.items).toEqual([]);
    expect(page.all).toBe(0);
  });
});
