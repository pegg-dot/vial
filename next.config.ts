import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
// upgrade-insecure-requests breaks production builds served over plain http
// (e.g. the local e2e server on http://localhost): the browser upgrades
// same-origin requests to https and they fail. Only emit it when the canonical
// site URL is https.
const servesOverHttps = !(process.env.NEXT_PUBLIC_SITE_URL ?? "https://vial.example").startsWith("http://");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://api.stripe.com https://r.stripe.com https://q.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  isProduction && servesOverHttps ? "upgrade-insecure-requests" : "",
].filter(Boolean).join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: process.env.VIAL_SKIP_NEXT_TYPECHECK === "1" },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  experimental: { cpus: 1, staticGenerationMaxConcurrency: 1 },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
