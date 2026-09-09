const LEGACY_NODE_PG_STRICT_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * node-postgres currently treats prefer, require, and verify-ca as aliases for verify-full.
 * Its next major version adopts libpq semantics, where those modes are weaker. Make the current
 * certificate-verifying behavior explicit so an eventual dependency upgrade cannot silently
 * reduce transport security.
 */
export function normalizePostgresUrl(raw: string) {
  const url = new URL(raw);
  const sslmode = url.searchParams.get("sslmode")?.toLowerCase();

  if (sslmode && LEGACY_NODE_PG_STRICT_MODES.has(sslmode)) {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}
