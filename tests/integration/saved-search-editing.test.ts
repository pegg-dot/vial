import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import {
  createSavedSearch,
  getSavedSearch,
  listSavedSearches,
  updateSavedSearch,
} from "@/server/consumer-intelligence/repository";
import { savedSearchPatchSchema } from "@/server/consumer-intelligence/schemas";

process.env.VIALGRADE_PGLITE_MEMORY="true";
process.env.VIALGRADE_SEED_FIXTURES="true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS="true";
process.env.VIALGRADE_SESSION_SECRET="saved-search-editing-test-secret-at-least-32";
process.env.VIALGRADE_PRIVACY_HASH_SECRET="saved-search-editing-privacy-secret-at-least-32";
const ownerId="user:customer:nora";
const intruderId="user:seller:marcus";

describe("saved search editing",()=>{
  beforeAll(async()=>{await resetDatabaseForTests();await getDatabase()});
  afterAll(async()=>{await resetDatabaseForTests()});

  it("round-trips a changed alert mode through the repository",async()=>{
    const saved=await createSavedSearch(ownerId,{name:"Alert mode round trip",query:"bpc-157",alertMode:"off"});
    expect(saved?.alertMode).toBe("off");
    const updated=await updateSavedSearch(ownerId,saved!.id,{alertMode:"all"});
    expect(updated?.alertMode).toBe("all");
    expect((await getSavedSearch(ownerId,saved!.id))?.alertMode).toBe("all");
    const renamed=await updateSavedSearch(ownerId,saved!.id,{name:"Alert mode renamed"});
    expect(renamed?.name).toBe("Alert mode renamed");
    expect(renamed?.alertMode).toBe("all");
    expect((await listSavedSearches(ownerId)).find(item=>item.id===saved!.id)?.name).toBe("Alert mode renamed");
  });

  it("cannot patch a saved search that belongs to another account",async()=>{
    const saved=await createSavedSearch(ownerId,{name:"Owner only",query:"kpv",alertMode:"important"});
    const stolen=await updateSavedSearch(intruderId,saved!.id,{alertMode:"off",name:"Hijacked"});
    expect(stolen).toBeNull();
    // A null return proves nothing on its own: a query that dropped the tenant predicate would still
    // read back nothing for the intruder. Assert the stored row itself never moved.
    const db=await getDatabase();
    const raw=(await db.query<{user_id:string;name:string;alert_mode:string}>(`SELECT user_id,name,alert_mode FROM saved_searches WHERE id=$1`,[saved!.id])).rows[0];
    expect(raw).toEqual({user_id:ownerId,name:"Owner only",alert_mode:"important"});
    const owned=await getSavedSearch(ownerId,saved!.id);
    expect(owned?.alertMode).toBe("important");
    expect(owned?.name).toBe("Owner only");
    expect((await listSavedSearches(intruderId)).some(item=>item.id===saved!.id)).toBe(false);
  });

  it("returns null when the saved search does not exist",async()=>{
    expect(await updateSavedSearch(ownerId,"saved-search:00000000-0000-4000-8000-000000000000",{alertMode:"all"})).toBeNull();
  });

  it("rejects an invalid alert mode at the schema boundary",async()=>{
    expect(savedSearchPatchSchema.safeParse({id:"saved-search:1",alertMode:"urgent"}).success).toBe(false);
    expect(savedSearchPatchSchema.safeParse({id:"saved-search:1",alertMode:"all"}).success).toBe(true);
    expect(savedSearchPatchSchema.safeParse({id:"saved-search:1",name:"Renamed only"}).success).toBe(true);
    expect(savedSearchPatchSchema.safeParse({id:"saved-search:1"}).success).toBe(false);
    expect(savedSearchPatchSchema.safeParse({alertMode:"all"}).success).toBe(false);
  });
});
