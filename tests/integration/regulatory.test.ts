import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { upsertLiveVendor } from "@/server/ingest/live-sources";
import { recordRegulatoryAction, getVendorRegulatoryActions, getVendorRegulatoryVerdict, listRegulatoryActions } from "@/server/regulatory/repository";
import { getVendorReputationBySlug } from "@/server/reputation/repository";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "regulatory-test-secret-at-least-32-characters-long";
process.env.VIAL_PRIVACY_HASH_SECRET = "regulatory-test-privacy-secret-at-least-32-chars";

describe("regulatory actions", () => {
  beforeAll(async () => {
    await resetDatabaseForTests();
    const db = await getDatabase();
    await upsertLiveVendor(db, { slug: "swiss-chems", name: "Swiss Chems", domains: ["swisschems.is"], description: "t" });
    await upsertLiveVendor(db, { slug: "paradigm-peptides", name: "Paradigm Peptides", domains: ["paradigmpeptides.com"], description: "t" });
  });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("records a warning letter, resolving it to the right vendor by domain", async () => {
    const db = await getDatabase();
    const res = await recordRegulatoryAction(db, {
      actionType: "warning_letter", agency: "FDA", subjectName: "Swisschems", title: "FDA warning letter",
      summary: "Unapproved new drugs (semaglutide, retatrutide) sold as research chemicals.",
      actionDate: "2024-12-10", sourceUrl: "https://www.fda.gov/.../swisschems-695663", isPrimarySource: true,
    }, [{ slug: "swiss-chems", name: "Swiss Chems", domains: ["swisschems.is"] }]);
    expect(res.vendorSlug).toBeNull(); // "Swisschems" (one word) doesn't domain- or exact-name-match "Swiss Chems"
    // With the domain present in the subject, it resolves:
    const res2 = await recordRegulatoryAction(db, {
      actionType: "warning_letter", agency: "FDA", subjectName: "Operator of swisschems.is", title: "FDA warning letter",
      summary: "Unapproved new drugs.", actionDate: "2024-12-10", sourceUrl: "https://www.fda.gov/.../swisschems-2", isPrimarySource: true,
    }, [{ slug: "swiss-chems", name: "Swiss Chems", domains: ["swisschems.is"] }]);
    expect(res2).toEqual({ vendorSlug: "swiss-chems", severity: "caution" });
    const rows = await getVendorRegulatoryActions("swiss-chems", db);
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("caution");
  });

  it("a severe DOJ outcome drives the verdict to avoid and shows in reputation", async () => {
    const db = await getDatabase();
    await recordRegulatoryAction(db, {
      actionType: "doj_action", agency: "DOJ", subjectName: "Operator of paradigmpeptides.com", outcome: "guilty_plea",
      title: "Guilty plea — misbranded drugs", summary: "Pleaded guilty to selling misbranded SARMs.",
      actionDate: "2025-12-01", sourceUrl: "https://www.justice.gov/.../paradigm", isPrimarySource: true,
    }, [{ slug: "paradigm-peptides", name: "Paradigm Peptides", domains: ["paradigmpeptides.com"] }]);
    expect(await getVendorRegulatoryVerdict("paradigm-peptides", db)).toBe("avoid");
    const rep = await getVendorReputationBySlug("paradigm-peptides", db);
    const flags = rep!.dimensions.find((d) => d.key === "open_risk_flags");
    expect(flags?.status).toBe("disputed");
    expect(flags?.value).toMatch(/enforcement record/i);
  });

  it("keeps an unmatched action in the market-wide feed but pinned to no vendor", async () => {
    const db = await getDatabase();
    await recordRegulatoryAction(db, {
      actionType: "warning_letter", agency: "FDA", subjectName: "Titan Sarms LLC", title: "FDA warning letter",
      summary: "SARMs marketed as unapproved drugs.", actionDate: "2025-12-12", sourceUrl: "https://www.fda.gov/.../titan", isPrimarySource: true,
    }, [{ slug: "swiss-chems", name: "Swiss Chems", domains: ["swisschems.is"] }]);
    const feed = await listRegulatoryActions(db);
    const titan = feed.find((a) => a.subject_name === "Titan Sarms LLC");
    expect(titan).toBeTruthy();
    expect(titan!.vendor_slug).toBeNull();
    // It must NOT appear on any specific vendor's page.
    expect(await getVendorRegulatoryActions("swiss-chems", db)).not.toContainEqual(expect.objectContaining({ subject_name: "Titan Sarms LLC" }));
  });
});
