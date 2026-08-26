import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { getConsumerPreferences, updateConsumerPreferences } from "@/server/consumer-intelligence/repository";
import { getPersonalizedMarket } from "@/server/consumer-intelligence/service";
import { createAlert, createDomainEvent } from "@/server/intelligence/events";
import type { ConsumerPreferences } from "@/server/consumer-intelligence/types";

process.env.VIALGRADE_PGLITE_MEMORY="true";
process.env.VIALGRADE_SEED_FIXTURES="true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS="true";
process.env.VIALGRADE_SESSION_SECRET="market-preferences-test-secret-at-least-32";
process.env.VIALGRADE_PRIVACY_HASH_SECRET="market-preferences-privacy-secret-at-least-32";

const userId="user:customer:nora";

/**
 * Every preference EXCEPT the one under test is pinned flat, so the price, shipping and evidence
 * terms contribute the same amount to every listing and the only thing that can move the ranking is
 * the preference the test flips. A test that leaves the rest of the profile at its seeded values
 * cannot tell "the binding works" from "the seed happened to order it that way".
 */
function flatPreferences(overrides:Partial<ConsumerPreferences>={}):ConsumerPreferences{
  return {
    priceFloor:0,
    priceCeiling:1000,
    maxShippingDays:60,
    evidencePriorities:[],
    requiredEvidenceLevels:[],
    preferredVendorSlugs:[],
    hiddenVendorSlugs:[],
    preferredCompoundSlugs:[],
    homeView:"balanced",
    personalizationEnabled:true,
    ...overrides,
  };
}

async function marketWith(overrides:Partial<ConsumerPreferences>){
  await updateConsumerPreferences(userId,flatPreferences(overrides));
  return getPersonalizedMarket(userId);
}

type Market=Awaited<ReturnType<typeof getPersonalizedMarket>>;
const slugsOf=(market:Market)=>market.recommendations.map(item=>item.product.slug);
const reasonsOf=(market:Market)=>market.recommendations.flatMap(item=>item.reasons);
const scoreOf=(market:Market,slug:string)=>market.recommendations.find(item=>item.product.slug===slug)?.score;

/** The reasons that exist only because this reader has a profile. */
const PERSONAL_REASONS=["Followed compound","Followed vendor","Preferred vendor","On your watchlist","Within your price range","Matches shipping preference"];

/** A reviewed change on a listing, recorded the way Watchtower records one: alert hung off an event. */
async function recordReviewedChange(listingSlug:string,title:string){
  const db=await getDatabase();
  const listing=(await db.query<{id:string}>(`SELECT id FROM listings WHERE slug=$1`,[listingSlug])).rows[0];
  expect(listing?.id,`fixture listing ${listingSlug} must exist`).toBeTruthy();
  const root=await createDomainEvent(db,{eventType:"listing.updated",entityType:"listing",entityId:listing!.id,actor:"test:market-preferences"});
  await createAlert(db,{rootEventId:root.rootEventId,parentEventId:root.id,category:"price_change",entityType:"listing",entityId:listing!.id,title,message:`${title} on ${listingSlug}`});
}

describe("market preferences bind to the ranked feed",()=>{
  beforeAll(async()=>{
    await resetDatabaseForTests();
    const db=await getDatabase();
    // The watchlist is a personal signal of its own; an empty one keeps the arithmetic below
    // readable and does not weaken any assertion (item 1 still exercises follows, price and
    // shipping).
    await db.query(`DELETE FROM user_watchlists WHERE user_id=$1`,[userId]);
  });
  afterAll(async()=>{await resetDatabaseForTests()});

  it("1. personalizationEnabled=false strips the personal signals from the ranking",async()=>{
    // "semax" is preferred and "meridian-biosciences" is a preferred vendor, so with the profile ON
    // a weakly-evidenced semax listing outranks strong evidence. With the profile OFF it must not.
    const overrides={preferredCompoundSlugs:["semax"],preferredVendorSlugs:["meridian-biosciences"]};
    const on=await marketWith({...overrides,personalizationEnabled:true});
    const off=await marketWith({...overrides,personalizationEnabled:false});

    expect(slugsOf(on)).not.toEqual(slugsOf(off));
    expect(on.recommendations[0]?.product.slug).not.toBe(off.recommendations[0]?.product.slug);

    // The preferred compound's listing rides the profile into the feed and leaves with it.
    expect(slugsOf(on)).toContain("northstar-semax-5mg");
    expect(slugsOf(off)).not.toContain("northstar-semax-5mg");

    // With the profile off the ranking is evidence quality and availability: the top record carries
    // the strongest evidence level in the catalogue.
    expect(off.recommendations[0]?.product.evidenceLevel).toBe("independent");

    // Reasons have to reflect the switch, not keep claiming a profile the reader turned off.
    expect(reasonsOf(on).some(reason=>PERSONAL_REASONS.includes(reason))).toBe(true);
    expect(reasonsOf(off).filter(reason=>PERSONAL_REASONS.includes(reason))).toEqual([]);
    expect(off.recommendations.every(item=>item.reasons.length>0)).toBe(true);
  });

  it("2. homeView='changes-first' ranks listings with recent reviewed change activity higher",async()=>{
    // signal-ghk-cu-50mg is the weakest record in the fixture catalogue: public-only, no confirmed
    // report, no batch link, unnamed issuer. Nothing but change activity can lift it.
    const quiet=await marketWith({homeView:"balanced"});
    expect(slugsOf(quiet)).not.toContain("signal-ghk-cu-50mg");

    const stillQuiet=await marketWith({homeView:"changes-first"});
    expect(slugsOf(stillQuiet)).not.toContain("signal-ghk-cu-50mg");

    for(let index=0;index<4;index+=1)await recordReviewedChange("signal-ghk-cu-50mg",`Observed price moved (${index+1})`);

    const changed=await marketWith({homeView:"changes-first"});
    expect(slugsOf(changed)).toContain("signal-ghk-cu-50mg");
    expect(slugsOf(changed)).not.toEqual(slugsOf(quiet));
    const lifted=changed.recommendations.find(item=>item.product.slug==="signal-ghk-cu-50mg");
    expect(lifted?.reasons.some(reason=>/reviewed change/i.test(reason))).toBe(true);

    // The change activity is what lifted it, not the switch: the same listing stays out of the
    // balanced feed even now that the alerts exist.
    const balancedAgain=await marketWith({homeView:"balanced"});
    expect(slugsOf(balancedAgain)).not.toContain("signal-ghk-cu-50mg");
  });

  it("3. evidence priorities 'quantity' and 'issuer' change the ranking",async()=>{
    // QUANTITY — "is the dose really there". Narrowed to two vendors so the flip is unambiguous.
    // helix-bpc-157-10mg leads on the followed compound; arcwell-kpv-10mg is the record whose
    // declared amount is backed by a confirmed, batch-linked report.
    const quantityScope={hiddenVendorSlugs:["northstar-research","lattice-research","meridian-biosciences","signal-science"],preferredCompoundSlugs:["bpc-157"]};
    const withoutQuantity=await marketWith(quantityScope);
    const withQuantity=await marketWith({...quantityScope,evidencePriorities:["quantity"]});

    expect(withoutQuantity.recommendations[0]?.product.slug).toBe("helix-bpc-157-10mg");
    expect(withQuantity.recommendations[0]?.product.slug).toBe("arcwell-kpv-10mg");
    expect(slugsOf(withQuantity)).not.toEqual(slugsOf(withoutQuantity));
    // A backed dose claim gains more than a merely legible one.
    const backedGain=scoreOf(withQuantity,"arcwell-kpv-10mg")!-scoreOf(withoutQuantity,"arcwell-kpv-10mg")!;
    const legibleGain=scoreOf(withQuantity,"helix-bpc-157-10mg")!-scoreOf(withoutQuantity,"helix-bpc-157-10mg")!;
    expect(backedGain).toBeGreaterThan(legibleGain);
    expect(legibleGain).toBeGreaterThan(0);

    // ISSUER — "which lab did it". Narrowed to the two vendors that carry the fixture's only
    // records with no named issuer, so the chip's effect cannot be confused with anything else.
    const issuerScope={hiddenVendorSlugs:["northstar-research","lattice-research","helix-science","arcwell-analytics"],preferredCompoundSlugs:["bpc-157"]};
    const withoutIssuer=await marketWith(issuerScope);
    const withIssuer=await marketWith({...issuerScope,evidencePriorities:["issuer"]});

    // meridian-bpc-157-5mg names no lab ("Unknown"); meridian-mots-c-10mg names one.
    expect(withoutIssuer.recommendations[0]?.product.slug).toBe("meridian-bpc-157-5mg");
    expect(withIssuer.recommendations[0]?.product.slug).toBe("meridian-mots-c-10mg");
    expect(scoreOf(withIssuer,"meridian-bpc-157-5mg")).toBe(scoreOf(withoutIssuer,"meridian-bpc-157-5mg"));
    expect(scoreOf(withIssuer,"meridian-mots-c-10mg")!).toBeGreaterThan(scoreOf(withoutIssuer,"meridian-mots-c-10mg")!);
  });

  it("4. requiredEvidenceLevels excludes records below the bar instead of down-ranking them",async()=>{
    const unfiltered=await marketWith({});
    expect(slugsOf(unfiltered)).toContain("northstar-bpc-157-10mg");
    expect(unfiltered.recommendations.some(item=>item.product.evidenceLevel!=="independent")).toBe(true);

    // Requiring the strongest level leaves only the records that hold it. Excluded, not ranked
    // low: the feed comes back SHORTER than its six-record cap.
    const independentOnly=await marketWith({requiredEvidenceLevels:["independent"]});
    expect(independentOnly.recommendations.every(item=>item.product.evidenceLevel==="independent")).toBe(true);
    expect(independentOnly.recommendations.length).toBe(unfiltered.catalog.products.filter(product=>product.evidenceLevel==="independent").length);
    expect(independentOnly.recommendations.length).toBeLessThan(6);
    expect(slugsOf(independentOnly)).not.toContain("northstar-bpc-157-10mg");

    // A required level is a FLOOR, not an exact match: requiring issuer-confirmed keeps the
    // independent records too, and still drops everything weaker.
    const issuerConfirmedFloor=await marketWith({requiredEvidenceLevels:["issuer-confirmed"]});
    const kept=new Set(slugsOf(issuerConfirmedFloor));
    expect(kept.has("northstar-bpc-157-10mg")).toBe(true);
    expect(kept.has("lattice-mots-c-10mg")).toBe(true);
    expect(issuerConfirmedFloor.recommendations.every(item=>["independent","issuer-confirmed"].includes(item.product.evidenceLevel))).toBe(true);
    expect(kept.has("helix-bpc-157-10mg")).toBe(false);
  });

  it("5. hiddenVendorSlugs removes a vendor from the feed and un-hiding brings it back",async()=>{
    const visible=await marketWith({});
    expect(visible.recommendations.some(item=>item.product.vendorSlug==="northstar-research")).toBe(true);
    const before=slugsOf(visible);

    const hidden=await marketWith({hiddenVendorSlugs:["northstar-research"]});
    expect(hidden.recommendations.some(item=>item.product.vendorSlug==="northstar-research")).toBe(false);
    expect(slugsOf(hidden)).not.toEqual(before);
    // The vendor is still in the catalogue — the reader hid it from their own feed, they did not
    // delete the record.
    expect(hidden.catalog.products.some(product=>product.vendorSlug==="northstar-research")).toBe(true);

    const unhidden=await marketWith({hiddenVendorSlugs:[]});
    expect(unhidden.recommendations.some(item=>item.product.vendorSlug==="northstar-research")).toBe(true);
    expect(slugsOf(unhidden)).toEqual(before);
    expect((await getConsumerPreferences(userId)).hiddenVendorSlugs).toEqual([]);
  });
});
