import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { QueryResultRow } from "pg";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import {
  createSavedSearch,
  getSavedSearch,
  listSavedSearches,
  updateSavedSearch,
} from "@/server/consumer-intelligence/repository";
import { savedSearchPatchSchema } from "@/server/consumer-intelligence/schemas";
import { createSession } from "@/server/auth/repository";
import { encodeSessionEnvelope, SESSION_COOKIE } from "@/server/auth/session-envelope";

process.env.VIALGRADE_PGLITE_MEMORY="true";
process.env.VIALGRADE_SEED_FIXTURES="true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS="true";
process.env.VIALGRADE_SESSION_SECRET="saved-search-editing-test-secret-at-least-32";
process.env.VIALGRADE_PRIVACY_HASH_SECRET="saved-search-editing-privacy-secret-at-least-32";
const ownerId="user:customer:nora";
const intruderId="user:seller:marcus";

/**
 * The route reads its principal from the session cookie, so the handlers can only be exercised with
 * `cookies()` answering. Only the cookie jar is faked — the session row, the envelope signature and
 * `requireApiPrincipal` are all real, so these tests still run the route's own authentication.
 */
const cookieJar=vi.hoisted(()=>({name:"",value:""}));
vi.mock("next/headers",()=>({
  cookies:async()=>({get:(key:string)=>(key===cookieJar.name&&cookieJar.value?{name:key,value:cookieJar.value}:undefined)}),
  headers:async()=>new Headers(),
}));

const{PATCH,POST}=await import("@/app/api/v1/saved-searches/route");

const jsonRequest=(method:string,body:unknown)=>new Request("https://vialgrade.test/api/v1/saved-searches",{
  method,
  headers:{"content-type":"application/json"},
  body:JSON.stringify(body),
});

async function signIn(userId:string){
  const db=await getDatabase();
  const user=(await db.query<QueryResultRow&{id:string}>(`SELECT * FROM auth_users WHERE id=$1`,[userId])).rows[0]!;
  const session=await createSession({...user,roles:["customer"]} as Parameters<typeof createSession>[0],{requestId:"saved-search-editing",ipHash:"iphash",userAgentHash:"uahash"},db);
  cookieJar.name=SESSION_COOKIE;
  cookieJar.value=encodeSessionEnvelope({
    version:1,
    sessionId:session.id,
    userId,
    accountType:"customer",
    roles:["customer"],
    issuedAt:Date.now(),
    expiresAt:session.expiresAt.getTime(),
  });
}

/**
 * `created_at` has microsecond resolution and each insert is its own statement, so two saves are
 * already distinct in practice. This makes it certain, because the ordering assertion below is only
 * meaningful if the two rows are ordered by something and not tied.
 */
const separate=()=>new Promise(resolve=>setTimeout(resolve,3));

describe("saved search editing",()=>{
  beforeAll(async()=>{await resetDatabaseForTests();await getDatabase();await signIn(ownerId)});
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

  /**
   * `UNIQUE(user_id, name)` is the only refusal the create form can provoke by ordinary use, and it
   * had no test on either verb. Both handlers translate it the same way, so both are checked here.
   */
  it("answers 409, not 500, when a new saved search reuses a name",async()=>{
    const first=await POST(jsonRequest("POST",{name:"Duplicate on create",query:"bpc-157"}));
    expect(first.status).toBe(201);

    const second=await POST(jsonRequest("POST",{name:"Duplicate on create",query:"a different question"}));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({error:"A saved search already uses that name"});

    // The refusal must also be a no-op: one row, still holding the query the reader first saved.
    const matches=(await listSavedSearches(ownerId)).filter(item=>item.name==="Duplicate on create");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.query).toBe("bpc-157");
  });

  /**
   * The PATCH 409 exists and is correct, but nothing in the UI can reach it today: the client only
   * ever sends `{id, alertMode}` and there is no rename control. Tested at the route so the server
   * side stays honest either way, and so a rename control can be added later against a proven path.
   */
  it("answers 409, not 500, when a rename collides with another saved search",async()=>{
    const target=await createSavedSearch(ownerId,{name:"Rename collision target",query:"kpv"});
    const source=await createSavedSearch(ownerId,{name:"Rename collision source",query:"ghk-cu"});

    const response=await PATCH(jsonRequest("PATCH",{id:source!.id,name:"Rename collision target"}));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error:"A saved search already uses that name"});

    // A swallowed 409 would be indistinguishable from a rename that worked. Both rows kept theirs.
    expect((await getSavedSearch(ownerId,source!.id))?.name).toBe("Rename collision source");
    expect((await getSavedSearch(ownerId,target!.id))?.name).toBe("Rename collision target");
  });

  it("still accepts a rename that does not collide",async()=>{
    const saved=await createSavedSearch(ownerId,{name:"Rename accepted before",query:"tb-500"});
    const response=await PATCH(jsonRequest("PATCH",{id:saved!.id,name:"Rename accepted after"}));
    expect(response.status).toBe(200);
    expect((await response.json() as{name:string}).name).toBe("Rename accepted after");
    expect((await getSavedSearch(ownerId,saved!.id))?.name).toBe("Rename accepted after");
  });

  /**
   * The client maps a patched row in place. The list was ordered by `updated_at DESC` and every
   * patch bumps `updated_at`, so the row the reader had just touched silently jumped to the top on
   * the next load — the screen and a reload disagreed, with no way for the reader to notice.
   */
  it("leaves the list in the same order after a patch as a reload would give",async()=>{
    const older=await createSavedSearch(ownerId,{name:"Order stability older",query:"ipamorelin"});
    await separate();
    const newer=await createSavedSearch(ownerId,{name:"Order stability newer",query:"cjc-1295"});

    const before=(await listSavedSearches(ownerId)).map(item=>item.id);
    // The assertion only bites if the patched row is not already first — otherwise a list that
    // re-sorts on every write would look identical to one that does not.
    expect(before[0]).toBe(newer!.id);
    expect(before.indexOf(older!.id)).toBeGreaterThan(0);

    const patched=await updateSavedSearch(ownerId,older!.id,{alertMode:"all"});
    // Positive control: the patch really did move `updated_at`, so this is not passing because
    // nothing was written.
    expect(new Date(patched!.updatedAt).getTime()).toBeGreaterThan(new Date(older!.updatedAt).getTime());

    expect((await listSavedSearches(ownerId)).map(item=>item.id)).toEqual(before);
  });
});
