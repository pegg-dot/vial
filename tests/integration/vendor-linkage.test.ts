import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordFingerprint, computeAndStoreLinkages, getVendorLinks } from "@/server/verify/vendor-linkage";
import { newId } from "@/server/db/ids";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "vendor-linkage-test-secret-at-least-32-characters";
process.env.VIAL_PRIVACY_HASH_SECRET = "vendor-linkage-privacy-secret-at-least-32-characters";

async function seedLab(vendor: string, compound: string, lot: string | null, maker: string) {
  const db = await getDatabase();
  await db.query(
    `INSERT INTO lab_test_records (id,lab,verify_url,compound_slug,sample_name,manufacturer,vendor_slug,batch_code,origin)
     VALUES ($1,'L',$2,$3,$3,$4,$5,$6,'live')`,
    [newId("lt"), `https://x/${newId("u")}`, compound, maker, vendor, lot],
  );
}

describe("vendor linkage engine", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("links two vendors that share a Google Analytics ID (strong, same operator)", async () => {
    const db = await getDatabase();
    await recordFingerprint(db, "shop-a", "ga", "G-SHARED123");
    await recordFingerprint(db, "shop-b", "ga", "G-SHARED123");
    await recordFingerprint(db, "shop-c", "ga", "G-DIFFERENT9");
    await computeAndStoreLinkages(db);
    const a = await getVendorLinks(db, "shop-a");
    expect(a.find((l) => l.linkedSlug === "shop-b" && l.basis === "web-id")?.strength).toBe("strong");
    expect(await getVendorLinks(db, "shop-c")).toHaveLength(0);
  });

  it("links vendors that share a specific COA lot number (strong), ignoring stub lots", async () => {
    const db = await getDatabase();
    await seedLab("auro", "bpc-157", "RT-260513-01", "Auro Bio");
    await seedLab("nova", "bpc-157", "RT-260513-01", "Nova Bio");     // same real lot → linked
    await seedLab("x1", "tb-500", "2026", "X One");
    await seedLab("x2", "tb-500", "2026", "X Two");                    // bare year → NOT linked
    await computeAndStoreLinkages(db);
    expect((await getVendorLinks(db, "auro")).some((l) => l.linkedSlug === "nova" && l.basis === "shared-lot" && l.strength === "strong")).toBe(true);
    expect((await getVendorLinks(db, "x1")).some((l) => l.basis === "shared-lot")).toBe(false);
  });

  it("links vendors sharing an upstream manufacturer as an informational same-source edge", async () => {
    const db = await getDatabase();
    await seedLab("reseller-1", "ghk-cu", "L-1", "Shengtai Chemical Co");
    await seedLab("reseller-2", "ghk-cu", "L-2", "Shengtai Chemical Co");
    await computeAndStoreLinkages(db);
    const links = await getVendorLinks(db, "reseller-1");
    expect(links.find((l) => l.linkedSlug === "reseller-2")?.basis).toBe("shared-source");
    expect(links.find((l) => l.linkedSlug === "reseller-2")?.strength).toBe("info");
  });
});
