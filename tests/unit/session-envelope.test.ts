import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeSessionEnvelope, encodeSessionEnvelope, SESSION_TTL_SECONDS } from "@/server/auth/session-envelope";

describe("versioned session envelope",()=>{
 const original=process.env.VIALGRADE_SESSION_SECRET;const now=Date.now();
 beforeEach(()=>{process.env.VIALGRADE_SESSION_SECRET="unit-test-session-secret-at-least-32-characters"});
 afterEach(()=>{if(original===undefined)delete process.env.VIALGRADE_SESSION_SECRET;else process.env.VIALGRADE_SESSION_SECRET=original});
 const valid=()=>({version:1 as const,sessionId:"session-12345678901234567890",userId:"user:1",accountType:"staff" as const,roles:["administrator" as const],issuedAt:now,expiresAt:now+60_000});
 it("accepts a valid signed session",()=>expect(decodeSessionEnvelope(encodeSessionEnvelope(valid()),now)).toMatchObject({userId:"user:1",accountType:"staff"}));
 it("rejects tampering, expiry, future issuance, and excessive lifetime",()=>{
  const encoded=encodeSessionEnvelope(valid());expect(decodeSessionEnvelope(`${encoded.slice(0,-1)}x`,now)).toBeNull();
  expect(decodeSessionEnvelope(encodeSessionEnvelope({...valid(),expiresAt:now-1}),now)).toBeNull();
  expect(decodeSessionEnvelope(encodeSessionEnvelope({...valid(),issuedAt:now+120_000,expiresAt:now+180_000}),now)).toBeNull();
  expect(decodeSessionEnvelope(encodeSessionEnvelope({...valid(),expiresAt:now+(SESSION_TTL_SECONDS+120)*1000}),now)).toBeNull();
 });
});
