/**
 * Evidence-only read mode. Prevent *new* collection of research interests while
 * legal/consent mechanisms are reviewed. Existing customer access and deletion
 * requests must remain possible; staff and data-remediation pathways stay open.
 */
const DISABLED_ALL_METHODS = new Set([
  "/api/track/view",
  "/api/v1/decision-events",
  "/api/v1/auth/register",
  "/api/v1/consumer/preferences",
  "/api/v1/saved-searches",
  "/api/v1/follows",
  "/api/v1/notifications",
  "/api/v1/verify",
  "/api/v1/verify/document",
  "/api/v1/push/subscribe",
]);
const DISABLED_WRITE_METHODS = new Set([
  "/api/v1/watchlist",
  "/api/v1/comparisons",
  "/api/v1/account/preferences",
]);
export function isPausedPersonalDataEndpoint(pathname: string, method: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (DISABLED_ALL_METHODS.has(path)) return true;
  if (DISABLED_WRITE_METHODS.has(path) && ["POST","PUT","PATCH"].includes(method.toUpperCase())) return true;
  return false;
}
