import { describe,expect,it } from "vitest";
import { permissionsForPrincipal, principalHasPermission, rolesHavePermission } from "@/server/auth/permissions";
import type { Principal } from "@/server/auth/types";
function principal(roles:Principal["roles"]):Principal{return{id:"u",email:"u@test",displayName:"U",accountType:"staff",roles,status:"active",sessionId:"s",expiresAt:Date.now()+1000}}
describe("staff capability matrix",()=>{
 it("keeps reviewer, finance, and administrator privileges distinct",()=>{
  expect(principalHasPermission(principal(["reviewer"]),"review:decide")).toBe(true);expect(principalHasPermission(principal(["reviewer"]),"finance:read")).toBe(false);
  expect(rolesHavePermission(["finance_analyst"],"finance:write")).toBe(true);expect(rolesHavePermission(["finance_analyst"],"admin:manage")).toBe(false);
  expect(permissionsForPrincipal(principal(["administrator"]))).toContain("admin:manage");
 });
});
