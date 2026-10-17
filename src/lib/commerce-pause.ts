/**
 * Freeze public sales and referrals while VialGrade operates as a research registry.
 * Keep existing customer refund, return, dispute, reconciliation and authenticated
 * payment-provider webhook paths available for preexisting customer obligations.
 * Never use a wildcard against the entire commerce namespace.
 */
const PAUSED_PATHS = new Set([
  "/go",
  "/api/partner/conversion",
  "/api/v1/commerce/cart",
  "/api/v1/commerce/checkout",
  "/api/v1/commerce/approved-checkout",
  "/api/v1/commerce/activation",
  "/api/v1/commerce/provider/onboarding",
]);

export function isPausedTransactionEndpoint(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return PAUSED_PATHS.has(path);
}
