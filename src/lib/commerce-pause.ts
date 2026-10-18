/**
 * Non-negotiable purchase/affiliate suspension, even when a legacy UI or a
 * different release-mode flag is accidentally enabled. Historical refunds,
 * returns, disputes, signed payment callbacks and read-only order views remain
 * separately authenticated so preexisting obligations are not abandoned.
 */
const NEW_TRANSACTION_ROOTS = [
  "/go",
  "/api/partner/conversion",
  "/api/v1/commerce/cart",
  "/api/v1/commerce/checkout",
  "/api/v1/commerce/approved-checkout",
  "/api/v1/commerce/activation",
  "/api/v1/commerce/provider/onboarding",
  "/api/v1/commerce/provider/sync",
] as const;

export function isPausedTransactionEndpoint(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  // A future nested endpoint must not accidentally inherit a buy capability.
  return NEW_TRANSACTION_ROOTS.some(root => path === root || path.startsWith(root + "/"));
}
