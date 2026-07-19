import type { Principal, UserRole } from "./types";

export type LaboratoryPermission =
  | "lab:profile:read"
  | "lab:profile:write"
  | "lab:onboarding:write"
  | "lab:methods:read"
  | "lab:methods:write"
  | "lab:orders:read"
  | "lab:orders:write"
  | "lab:samples:read"
  | "lab:samples:accession"
  | "lab:custody:write"
  | "lab:runs:read"
  | "lab:runs:write"
  | "lab:results:write"
  | "lab:results:review"
  | "lab:reports:issue"
  | "lab:reports:revoke"
  | "lab:quality:read"
  | "lab:team:manage"
  | "lab:tokens:manage";

const all = new Set<LaboratoryPermission>([
  "lab:profile:read", "lab:profile:write", "lab:onboarding:write", "lab:methods:read", "lab:methods:write",
  "lab:orders:read", "lab:orders:write", "lab:samples:read", "lab:samples:accession", "lab:custody:write",
  "lab:runs:read", "lab:runs:write", "lab:results:write", "lab:results:review", "lab:reports:issue",
  "lab:reports:revoke", "lab:quality:read", "lab:team:manage", "lab:tokens:manage",
]);

const map: Partial<Record<UserRole, ReadonlySet<LaboratoryPermission>>> = {
  laboratory_owner: all,
  laboratory_quality: new Set([
    "lab:profile:read", "lab:profile:write", "lab:onboarding:write", "lab:methods:read", "lab:methods:write",
    "lab:orders:read", "lab:samples:read", "lab:custody:write", "lab:runs:read", "lab:results:review",
    "lab:reports:issue", "lab:reports:revoke", "lab:quality:read", "lab:team:manage", "lab:tokens:manage",
  ]),
  laboratory_analyst: new Set([
    "lab:profile:read", "lab:methods:read", "lab:orders:read", "lab:samples:read", "lab:custody:write",
    "lab:runs:read", "lab:runs:write", "lab:results:write", "lab:quality:read",
  ]),
  laboratory_accessioning: new Set([
    "lab:profile:read", "lab:orders:read", "lab:samples:read", "lab:samples:accession", "lab:custody:write",
  ]),
};

export function principalHasLaboratoryPermission(principal: Principal, permission: LaboratoryPermission) {
  return principal.accountType === "laboratory" && principal.roles.some((role) => map[role]?.has(permission));
}

export function laboratoryPermissionsForPrincipal(principal: Principal) {
  return [...all].filter((permission) => principalHasLaboratoryPermission(principal, permission));
}
