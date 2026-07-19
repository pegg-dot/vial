import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");
const optionalString = (minimum = 1) => z.preprocess((value) => value === "" ? undefined : value, z.string().min(minimum).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: optionalString(),
  DATABASE_SSL: booleanString.default(false),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  VIAL_SESSION_SECRET: optionalString(32),
  VIAL_PRIVACY_HASH_SECRET: optionalString(32),
  VIAL_PGLITE_MEMORY: booleanString.default(false),
  VIAL_PGLITE_PATH: optionalString(),
  VIAL_ALLOW_EMBEDDED_DB_FOR_TESTS: booleanString.default(false),
  VIAL_SEED_DEMO_ACCOUNTS: booleanString.default(false),
  VIAL_SEED_FIXTURES: booleanString.default(false),
  VIAL_BUILD_SHA: z.string().default("development"),
  VIAL_RELEASE: z.string().default("5.0.0"),
  VIAL_COMMERCE_MODE: z.enum(["sandbox", "test", "live"]).default("sandbox"),
  VIAL_PAYMENT_PROVIDER: z.enum(["mock", "stripe"]).default("mock"),
  VIAL_COMMERCE_POLICY_VERSION: z.string().default("commerce-v5.0"),
  VIAL_LIVE_COMMERCE_ENABLED: booleanString.default(false),
  VIAL_LIVE_COMMERCE_ACK: optionalString(),
  STRIPE_SECRET_KEY: optionalString(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString(),
  STRIPE_WEBHOOK_SECRET: optionalString(),
  STRIPE_CONNECT_CLIENT_ID: optionalString(),
  VIAL_PLATFORM_COUNTRY: z.string().length(2).default("US"),
  VIAL_PLATFORM_CURRENCY: z.string().length(3).default("USD"),
});

export type VialEnvironment = z.infer<typeof envSchema>;
let cached: VialEnvironment | undefined;

function isLoopbackSite(value: string) {
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function validateCommerceSafety(environment: VialEnvironment) {
  if (environment.VIAL_PAYMENT_PROVIDER === "stripe" && (!environment.STRIPE_SECRET_KEY || !environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || !environment.STRIPE_WEBHOOK_SECRET)) {
    throw new Error("Stripe secret, publishable, and webhook keys are required when VIAL_PAYMENT_PROVIDER=stripe");
  }
  if (environment.VIAL_COMMERCE_MODE !== "live" && (environment.STRIPE_SECRET_KEY?.startsWith("sk_live_") || environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_"))) {
    throw new Error("Live Stripe keys are forbidden outside VIAL_COMMERCE_MODE=live");
  }
  if (environment.VIAL_PAYMENT_PROVIDER === "stripe" && !environment.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
    throw new Error("Stripe commerce requires a webhook signing secret");
  }
  if (environment.VIAL_PAYMENT_PROVIDER === "stripe" && environment.VIAL_COMMERCE_MODE !== "live" && (!environment.STRIPE_SECRET_KEY?.startsWith("sk_test_") || !environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_"))) {
    throw new Error("Stripe test commerce requires test secret and publishable keys");
  }
  if (environment.VIAL_COMMERCE_MODE === "live") {
    if (!environment.VIAL_LIVE_COMMERCE_ENABLED) throw new Error("Live commerce is disabled");
    if (environment.VIAL_LIVE_COMMERCE_ACK !== "VIAL_LIVE_COMMERCE_APPROVED") throw new Error("Missing explicit live-commerce acknowledgement");
    if (environment.VIAL_PAYMENT_PROVIDER !== "stripe" || !environment.STRIPE_SECRET_KEY?.startsWith("sk_live_") || !environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")) {
      throw new Error("Live commerce requires an approved live payment provider configuration");
    }
  }
}

export function getEnvironment() {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid VIAL environment: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    const embedded = parsed.data.VIAL_ALLOW_EMBEDDED_DB_FOR_TESTS && parsed.data.VIAL_PGLITE_MEMORY && isLoopbackSite(parsed.data.NEXT_PUBLIC_SITE_URL);
    if (parsed.data.VIAL_ALLOW_EMBEDDED_DB_FOR_TESTS && !embedded) {
      throw new Error("VIAL_ALLOW_EMBEDDED_DB_FOR_TESTS is restricted to an in-memory database on a loopback site URL");
    }
    const missing = [
      ["VIAL_SESSION_SECRET", parsed.data.VIAL_SESSION_SECRET],
      ["VIAL_PRIVACY_HASH_SECRET", parsed.data.VIAL_PRIVACY_HASH_SECRET],
      ["DATABASE_URL", parsed.data.DATABASE_URL || (embedded ? "test-only-embedded-db" : undefined)],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  }
  validateCommerceSafety(parsed.data);
  cached = parsed.data;
  return cached;
}

export function resetEnvironmentForTests() {
  cached = undefined;
}
