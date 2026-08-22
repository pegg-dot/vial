import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordVendorSignals, recordDomainAge, getVendorSignals } from "@/server/external/repository";

// `recordVendorSignals` upserts EVERY column from its argument, so calling it to stamp a freshly
// collected domain age would null out the curated fields already on the row — payment rails, the
// research-use flag, the notable-copy quote. That is a silent data loss on the exact seam this
// work exists to populate, so the collector writes through a narrow updater instead, and this
// test is what stops anyone from pointing it back at the wide one.

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  await resetDatabaseForTests();
});

const CURATED = {
  vendorSlug: "swiss-chems",
  checkoutStatus: "open",
  paymentMethods: ["card", "crypto", "zelle", "ach"],
  domainAgeNote: "Domain registered 2020-06-25 (~6 yrs); uses .is ccTLD despite US-facing operation",
  shipsFrom: "US domestic (2–5 business days)",
  guarantees: "Free shipping >$100 US / >$300 intl",
  researchDisclaimer: false,
  notableCopy: "Own FAQ: PayPal/Stripe/Amazon Pay don't accept research chemicals; recommends BTC.",
  sourceUrl: "https://swisschems.is/how-to-pay/",
};

describe("recording a collected domain age", () => {
  it("updates the note without discarding the rest of the curated row", async () => {
    const db = await getDatabase();
    await recordVendorSignals(db, CURATED);

    await recordDomainAge(db, "swiss-chems", "Domain registered 2020-06-25 (~6 yrs)");

    const after = await getVendorSignals("swiss-chems", db);
    expect(after?.domain_age_note).toBe("Domain registered 2020-06-25 (~6 yrs)");
    expect(after?.payment_methods).toEqual(["card", "crypto", "zelle", "ach"]);
    expect(after?.ships_from).toBe(CURATED.shipsFrom);
    expect(after?.guarantees).toBe(CURATED.guarantees);
    expect(after?.checkout_status).toBe("open");
    expect(after?.research_disclaimer).toBe(false);
    expect(after?.notable_copy).toBe(CURATED.notableCopy);
    expect(after?.source_url).toBe(CURATED.sourceUrl);
  });

  it("creates a row for a vendor that has no signals yet", async () => {
    const db = await getDatabase();
    await recordDomainAge(db, "ascendbiolabs", "Domain registered 2025-11-29 (~9 months old) — VERY YOUNG, a notable risk signal");

    const after = await getVendorSignals("ascendbiolabs", db);
    expect(after?.domain_age_note).toContain("VERY YOUNG");
    expect(after?.payment_methods).toEqual([]);
  });

  // Collectors re-run daily. A second run with the same answer must not churn the row's other
  // fields, and must remain safe to repeat.
  it("is idempotent across repeated runs", async () => {
    const db = await getDatabase();
    await recordVendorSignals(db, CURATED);
    await recordDomainAge(db, "swiss-chems", "Domain registered 2020-06-25 (~6 yrs)");
    await recordDomainAge(db, "swiss-chems", "Domain registered 2020-06-25 (~6 yrs)");

    const after = await getVendorSignals("swiss-chems", db);
    expect(after?.domain_age_note).toBe("Domain registered 2020-06-25 (~6 yrs)");
    expect(after?.payment_methods).toEqual(["card", "crypto", "zelle", "ach"]);
  });

  // Not knowing a domain's age must read as unknown. Overwriting a good note with null because
  // one RDAP lookup timed out would erase collected signal on a transient network failure.
  it("refuses to erase an existing note with an empty answer", async () => {
    const db = await getDatabase();
    await recordVendorSignals(db, CURATED);

    await recordDomainAge(db, "swiss-chems", null);

    const after = await getVendorSignals("swiss-chems", db);
    expect(after?.domain_age_note).toBe(CURATED.domainAgeNote);
  });
});
