// What query reaches what verdict.
//
// The composed verdict under /verify is exhaustively unit-tested; the routing in FRONT of it had no
// end-to-end coverage at all, and that is where the defects were. These run against a real database
// because every branch past the first reads one.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDatabase, resetDatabaseForTests, type SqlConnection } from "@/server/db/client";
import { runVerification } from "@/server/verify";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "verify-router-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "verify-router-test-privacy-secret-at-least-32-ch";

// The unknown-domain path makes live RDAP/Reddit/COA requests by design. Every one of them
// degrades to "unavailable" rather than throwing, so stubbing fetch keeps these deterministic and
// offline without changing which branch a query reaches — which is all this file is about.
const fetchStub = vi.fn(async () => { throw new Error("offline in tests"); });
vi.stubGlobal("fetch", fetchStub);

let db: SqlConnection;

beforeAll(async () => {
  await resetDatabaseForTests();
  db = await getDatabase();
  // A compound whose name is exactly the shape the COA test matches.
  await db.query(
    `INSERT INTO compounds (id, slug, canonical_name, shorthand, category, description)
     VALUES ('cmp-glut','glutathione','Glutathione','GSH','Longevity & Anti-aging','t')
     ON CONFLICT (slug) DO NOTHING`,
  );
  await db.query(
    `INSERT INTO compounds (id, slug, canonical_name, shorthand, category, description)
     VALUES ('cmp-bpc','bpc-157','BPC-157','BPC','Healing & Recovery','t')
     ON CONFLICT (slug) DO NOTHING`,
  );
});
afterAll(async () => { await resetDatabaseForTests(); });

describe("a compound reaches its compound page however it is capitalised", () => {
  // The defect: eleven tracked compounds are 9-16 letters, which is exactly the COA code shape.
  // While the shape was tested before the name, GLUTATHIONE returned "we don't have this COA code
  // on record" for a compound with a full market page on this site.
  it.each(["Glutathione", "glutathione", "GLUTATHIONE", "  Glutathione  "])("%s", async (query) => {
    const r = await runVerification(query);
    expect(r.kind).toBe("compound");
    expect(r.link?.href).toBe("/compounds/glutathione");
  });

  it("still resolves a compound whose name could never be mistaken for a code", async () => {
    const r = await runVerification("BPC-157");
    expect(r.kind).toBe("compound");
    expect(r.link?.href).toBe("/compounds/bpc-157");
  });
});

describe("a known vendor reaches its own verdict, and an impostor never inherits it", () => {
  it("resolves the vendor from its own domain", async () => {
    const r = await runVerification("bluumpeptides.com");
    expect(r.kind).toBe("vendor");
    expect(r.link?.href).toBe("/vendors/bluum-peptides");
  });

  it("resolves the vendor from a subdomain it controls", async () => {
    const r = await runVerification("https://shop.bluumpeptides.com/product/1");
    expect(r.kind).toBe("vendor");
    expect(r.link?.href).toBe("/vendors/bluum-peptides");
  });

  // The verdict this whole file exists for. A lookalike must never be answered with the trusted
  // verdict of the shop it is imitating.
  it.each(["bluumpeptides-shop.com", "buy-bluumpeptides.net", "bluumpeptides.scam.ru", "peptides.com"])(
    "does not answer %s as a tracked vendor",
    async (impostor) => {
      const r = await runVerification(impostor);
      expect(r.kind).toBe("unknown-domain");
      expect(r.verdict).not.toBe("trusted");
      // The impostor must not be ANSWERED as the vendor: no vendor verdict, no link to its page.
      // (Bluum may still appear under "trusted vendors instead" — that is a suggestion, not a
      // claim about the domain that was pasted, and it is the correct thing to offer here.)
      expect(r.link?.href).not.toBe("/vendors/bluum-peptides");
      expect(r.headline).toContain(impostor.replace(/^https?:\/\//, ""));
    },
  );

  it("names a flagged vendor loudly rather than staying silent", async () => {
    const r = await runVerification("Peptide Sciences");
    expect(r.kind).toBe("vendor");
    expect(r.verdict).toBe("avoid");
  });
});

describe("empty and junk input never crash and never read as safe", () => {
  it.each(["", "   ", "!!!", "a", "?????????"])("%s", async (query) => {
    const r = await runVerification(query);
    expect(r).toBeTruthy();
    expect(r.verdict).not.toBe("trusted");
  });

  it("survives input that looks like an injection attempt", async () => {
    const r = await runVerification("'; DROP TABLE organizations; --");
    expect(r).toBeTruthy();
    expect((await db.query<{ c: string }>(`SELECT COUNT(*) c FROM compounds`)).rows[0]).toBeTruthy();
  });

  it("survives a very long query without matching anything", async () => {
    const r = await runVerification("x".repeat(200));
    expect(r.verdict).not.toBe("trusted");
  });
});
