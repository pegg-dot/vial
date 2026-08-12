import type { SqlConnection } from "@/server/db/client";
import { getEnvironment } from "@/server/config/env";
import type { CommerceMode } from "./types";

// The `commerce_production` feature flag is the "real money movement hard stop".
// It is a DB-backed interlock: even when the environment is fully configured for live
// Stripe charges, no real charge proceeds unless the flag is explicitly enabled.
// This closes the 6.0 audit finding where the flag was seeded and displayed but read
// nowhere — the only real gate was environment config controllable by deploy access.

export function liveChargeBlocked(params: { mode: CommerceMode; provider: string; flagEnabled: boolean }): boolean {
  // A real charge is only ever attempted by the Stripe adapter in live mode.
  const wouldMoveRealMoney = params.provider === "stripe" && params.mode === "live";
  return wouldMoveRealMoney && !params.flagEnabled;
}

export async function isFeatureFlagEnabled(db: SqlConnection, key: string): Promise<boolean> {
  const result = await db.query<{ enabled: boolean }>(`SELECT enabled FROM feature_flags WHERE key = $1`, [key]);
  return result.rows[0]?.enabled === true;
}

// Call at every real-money choke point before contacting the payment provider.
// No-ops in sandbox/mock (no DB read) so ordinary checkout is unaffected.
export async function assertLiveCommerceEnabled(db: SqlConnection): Promise<void> {
  const env = getEnvironment();
  if (!(env.VIALGRADE_PAYMENT_PROVIDER === "stripe" && env.VIALGRADE_COMMERCE_MODE === "live")) return;
  const flagEnabled = await isFeatureFlagEnabled(db, "commerce_production");
  if (liveChargeBlocked({ mode: env.VIALGRADE_COMMERCE_MODE, provider: env.VIALGRADE_PAYMENT_PROVIDER, flagEnabled })) {
    throw new Error("commerce_production is disabled: live payment movement is blocked by the production hard stop");
  }
}
