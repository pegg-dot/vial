import type { Principal, UserRole } from "./types";

export type StaffPermission =
  | "catalog:read" | "catalog:write" | "review:decide"
  | "commerce:read" | "commerce:write" | "finance:read" | "finance:write"
  | "evidence:read" | "evidence:write" | "laboratories:manage"
  | "privacy:read" | "privacy:write" | "security:read" | "security:write" | "admin:manage";

const all = new Set<StaffPermission>([
  "catalog:read", "catalog:write", "review:decide", "commerce:read", "commerce:write",
  "finance:read", "finance:write", "evidence:read", "evidence:write", "laboratories:manage",
  "privacy:read", "privacy:write", "security:read", "security:write", "admin:manage",
]);

const map: Partial<Record<UserRole, ReadonlySet<StaffPermission>>> = {
  reviewer: new Set(["catalog:read", "review:decide", "evidence:read"]),
  compliance_analyst: new Set([
    "catalog:read", "review:decide", "commerce:read", "evidence:read", "evidence:write",
    "laboratories:manage", "privacy:read", "privacy:write", "security:read",
  ]),
  finance_analyst: new Set(["commerce:read", "finance:read", "finance:write"]),
  administrator: all,
  super_administrator: all,
};

export function principalHasPermission(principal: Principal, permission: StaffPermission) {
  return principal.accountType === "staff" && principal.roles.some((role) => map[role]?.has(permission));
}
export function permissionsForPrincipal(principal: Principal) {
  return [...all].filter((permission) => principalHasPermission(principal, permission));
}
export function roleHasPermission(role: "admin" | "reviewer", permission: StaffPermission) {
  return role === "admin" ? all.has(permission) : map.reviewer?.has(permission) ?? false;
}
export function rolesHavePermission(roles: UserRole[], permission: StaffPermission) {
  return roles.some((role) => map[role]?.has(permission));
}
