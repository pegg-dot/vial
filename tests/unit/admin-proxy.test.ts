import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "@/proxy";
import { encodeSessionEnvelope, SESSION_COOKIE } from "@/server/auth/session-envelope";

const now=Date.now();
function cookie(accountType:"customer"|"seller"|"staff",roles:string[]){return encodeSessionEnvelope({version:1,sessionId:`session-${crypto.randomUUID()}`,userId:`user-${accountType}`,accountType,roles:roles as never[],issuedAt:now,expiresAt:now+60_000})}

describe("deny-by-default route perimeter",()=>{
  const original=process.env.VIAL_SESSION_SECRET;
  beforeEach(()=>{process.env.VIAL_SESSION_SECRET="unit-test-admin-proxy-secret-at-least-32-characters"});
  afterEach(()=>{if(original===undefined)delete process.env.VIAL_SESSION_SECRET;else process.env.VIAL_SESSION_SECRET=original});
  it("runs for protected and public application routes",()=>{
    for(const url of ["/admin/users","/admin/future-page","/account","/seller","/market"])expect(unstable_doesMiddlewareMatch({config,nextConfig:{},url})).toBe(true);
  });
  it("keeps login public and redirects anonymous staff access with a safe next target",()=>{
    expect(proxy(new NextRequest("http://localhost/admin/login")).headers.get("x-middleware-next")).toBe("1");
    const response=proxy(new NextRequest("http://localhost/admin/privacy"));
    expect(response.status).toBe(307);expect(response.headers.get("location")).toBe("http://localhost/admin/login?next=%2Fadmin%2Fprivacy");expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("allows an administrator and blocks a reviewer from finance",()=>{
    const admin=proxy(new NextRequest("http://localhost/admin/finance",{headers:{cookie:`${SESSION_COOKIE}=${cookie("staff",["administrator"])}`}}));
    expect(admin.headers.get("x-middleware-next")).toBe("1");
    const reviewer=proxy(new NextRequest("http://localhost/admin/finance",{headers:{cookie:`${SESSION_COOKIE}=${cookie("staff",["reviewer"])}`}}));
    expect(reviewer.status).toBe(307);expect(reviewer.headers.get("location")).toBe("http://localhost/admin?error=forbidden");
  });
  it("enforces account-family boundaries and denies cross-origin mutations",()=>{
    const customerCookie=`${SESSION_COOKIE}=${cookie("customer",["customer"])}`;
    const sellerCookie=`${SESSION_COOKIE}=${cookie("seller",["seller_owner"])}`;
    const customerAtSeller=proxy(new NextRequest("http://localhost/seller",{headers:{cookie:customerCookie}}));
    expect(customerAtSeller.status).toBe(307);
    const sellerAtForYou=proxy(new NextRequest("http://localhost/for-you",{headers:{cookie:sellerCookie}}));
    expect(sellerAtForYou.status).toBe(307);
    const customerAtForYou=proxy(new NextRequest("http://localhost/for-you",{headers:{cookie:customerCookie}}));
    expect(customerAtForYou.headers.get("x-middleware-next")).toBe("1");
    const crossOrigin=proxy(new NextRequest("http://localhost/api/v1/account/preferences",{method:"POST",headers:{origin:"https://evil.example"}}));
    expect(crossOrigin.status).toBe(403);
  });
  it("returns 401 JSON (not an HTML redirect) when an anonymous caller hits a protected API route",async()=>{
    const response=proxy(new NextRequest("http://localhost/api/v1/notifications"));
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect((await response.json()).error).toBeTruthy();
  });
  it("still redirects an anonymous caller to login for a protected page route",()=>{
    const response=proxy(new NextRequest("http://localhost/internal-export"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Finternal-export");
  });
});
