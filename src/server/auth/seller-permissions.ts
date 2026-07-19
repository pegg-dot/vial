import type { Principal, UserRole } from "./types";

export type SellerPermission =
  | "seller:profile:read"
  | "seller:profile:write"
  | "seller:onboarding:write"
  | "seller:integrations:manage"
  | "seller:catalog:read"
  | "seller:catalog:write"
  | "seller:batches:manage"
  | "seller:evidence:manage"
  | "seller:inventory:manage"
  | "seller:orders:read"
  | "seller:orders:write"
  | "seller:finance:read"
  | "seller:payments:manage"
  | "seller:support:manage"
  | "seller:analytics:read"
  | "seller:team:manage"
  | "seller:tokens:manage"
  | "seller:webhooks:manage";

const all = new Set<SellerPermission>([
  "seller:profile:read",
  "seller:profile:write",
  "seller:onboarding:write",
  "seller:integrations:manage",
  "seller:catalog:read",
  "seller:catalog:write",
  "seller:batches:manage",
  "seller:evidence:manage",
  "seller:inventory:manage",
  "seller:orders:read",
  "seller:orders:write",
  "seller:finance:read",
  "seller:payments:manage",
  "seller:support:manage",
  "seller:analytics:read",
  "seller:team:manage",
  "seller:tokens:manage",
  "seller:webhooks:manage",
]);

const map: Partial<Record<UserRole, ReadonlySet<SellerPermission>>> = {
  seller_owner: all,
  seller_operations: new Set([
    "seller:profile:read",
    "seller:profile:write",
    "seller:onboarding:write",
    "seller:integrations:manage",
    "seller:catalog:read",
    "seller:catalog:write",
    "seller:batches:manage",
    "seller:evidence:manage",
    "seller:inventory:manage",
    "seller:orders:read",
    "seller:orders:write",
    "seller:support:manage",
    "seller:analytics:read",
    "seller:webhooks:manage",
  ]),
  seller_finance: new Set([
    "seller:profile:read",
    "seller:orders:read",
    "seller:finance:read",
    "seller:payments:manage",
    "seller:analytics:read",
  ]),
  seller_support: new Set([
    "seller:profile:read",
    "seller:catalog:read",
    "seller:orders:read",
    "seller:support:manage",
  ]),
};

export function principalHasSellerPermission(principal: Principal, permission: SellerPermission) {
  return principal.accountType === "seller" && principal.roles.some((role) => map[role]?.has(permission));
}

export function sellerPermissionsForPrincipal(principal: Principal) {
  return [...all].filter((permission) => principalHasSellerPermission(principal, permission));
}
