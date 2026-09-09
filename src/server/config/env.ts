import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");
const optionalString = (minimum = 1) => z.preprocess((value) => value === "" ? undefined : value, z.string().min(minimum).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: optionalString(),
  DATABASE_SSL: booleanString.default(false),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  VIALGRADE_SESSION_SECRET: optionalString(32),
  VIALGRADE_PRIVACY_HASH_SECRET: optionalString(32),
  VIALGRADE_PGLITE_MEMORY: booleanString.default(false),
  VIALGRADE_PGLITE_PATH: optionalString(),
  VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS: booleanString.default(false),
  VIALGRADE_SEED_DEMO_ACCOUNTS: booleanString.default(false),
  VIALGRADE_SEED_FIXTURES: booleanString.default(false),
  VIALGRADE_BUILD_SHA: z.string().default(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "development"),
  VIALGRADE_RELEASE: z.string().default(""), // empty -> callers fall back to lib/release (package.json)
  VIALGRADE_COMMERCE_MODE: z.enum(["sandbox", "test", "live"]).default("sandbox"),
  VIALGRADE_PAYMENT_PROVIDER: z.enum(["mock", "stripe"]).default("mock"),
  VIALGRADE_COMMERCE_POLICY_VERSION: z.string().default("commerce-v5.0"),
  VIALGRADE_LIVE_COMMERCE_ENABLED: booleanString.default(false),
  VIALGRADE_LIVE_COMMERCE_ACK: optionalString(),
  STRIPE_SECRET_KEY: optionalString(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString(),
  STRIPE_WEBHOOK_SECRET: optionalString(),
  STRIPE_CONNECT_CLIENT_ID: optionalString(),
  VIALGRADE_PLATFORM_COUNTRY: z.string().length(2).default("US"),
  VIALGRADE_PLATFORM_CURRENCY: z.string().length(3).default("USD"),
});

export type VialGradeEnvironment = z.infer<typeof envSchema>;
let cached: VialGradeEnvironment | undefined;

function isLoopbackSite(value: string) {
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function validateCommerceSafety(environment: VialGradeEnvironment) {
  if (environment.VIALGRADE_PAYMENT_PROVIDER === "stripe" && (!environment.STRIPE_SECRET_KEY || !environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || !environment.STRIPE_WEBHOOK_SECRET)) {
    throw new Error("Stripe secret, publishable, and webhook keys are required when VIALGRADE_PAYMENT_PROVIDER=stripe");
  }
  if (environment.VIALGRADE_COMMERCE_MODE !== "live" && (environment.STRIPE_SECRET_KEY?.startsWith("sk_live_") || environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_"))) {
    throw new Error("Live Stripe keys are forbidden outside VIALGRADE_COMMERCE_MODE=live");
  }
  if (environment.VIALGRADE_PAYMENT_PROVIDER === "stripe" && !environment.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
    throw new Error("Stripe commerce requires a webhook signing secret");
  }
  if (environment.VIALGRADE_PAYMENT_PROVIDER === "stripe" && environment.VIALGRADE_COMMERCE_MODE !== "live" && (!environment.STRIPE_SECRET_KEY?.startsWith("sk_test_") || !environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_"))) {
    throw new Error("Stripe test commerce requires test secret and publishable keys");
  }
  if (environment.VIALGRADE_COMMERCE_MODE === "live") {
    if (!environment.VIALGRADE_LIVE_COMMERCE_ENABLED) throw new Error("Live commerce is disabled");
    if (environment.VIALGRADE_LIVE_COMMERCE_ACK !== "VIALGRADE_LIVE_COMMERCE_APPROVED") throw new Error("Missing explicit live-commerce acknowledgement");
    if (environment.VIALGRADE_PAYMENT_PROVIDER !== "stripe" || !environment.STRIPE_SECRET_KEY?.startsWith("sk_live_") || !environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")) {
      throw new Error("Live commerce requires an approved live payment provider configuration");
    }
  }
}

export function getEnvironment() {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid VialGrade environment: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    const embedded = parsed.data.VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS && parsed.data.VIALGRADE_PGLITE_MEMORY && isLoopbackSite(parsed.data.NEXT_PUBLIC_SITE_URL);
    if (parsed.data.VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS && !embedded) {
      throw new Error("VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS is restricted to an in-memory database on a loopback site URL");
    }
    const missing = [
      ["VIALGRADE_SESSION_SECRET", parsed.data.VIALGRADE_SESSION_SECRET],
      ["VIALGRADE_PRIVACY_HASH_SECRET", parsed.data.VIALGRADE_PRIVACY_HASH_SECRET],
      ["DATABASE_URL", parsed.data.DATABASE_URL || (embedded ? "test-only-embedded-db" : undefined)],
      ["NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL?.trim() || (embedded ? parsed.data.NEXT_PUBLIC_SITE_URL : undefined)],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
    if (!embedded && new URL(parsed.data.NEXT_PUBLIC_SITE_URL).protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_SITE_URL must use https in production");
    }
    if (parsed.data.VIALGRADE_SESSION_SECRET === parsed.data.VIALGRADE_PRIVACY_HASH_SECRET) {
      throw new Error("Session and privacy hash secrets must be independent values");
    }
  }
  validateCommerceSafety(parsed.data);
  cached = parsed.data;
  return cached;
}

export function resetEnvironmentForTests() {
  cached = undefined;
}
