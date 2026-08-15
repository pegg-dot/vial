import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
// upgrade-insecure-requests breaks production builds served over plain http
// (e.g. the local e2e server on http://localhost): the browser upgrades
// same-origin requests to https and they fail. Only emit it when the canonical
// site URL is https.
const servesOverHttps = !(process.env.NEXT_PUBLIC_SITE_URL ?? "https://vialgrade.example").startsWith("http://");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Certificate-of-analysis documents are hosted on many vendor and lab domains; allow any
  // https image so the real COAs render inline. Images can't execute, so this is safe.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // No Stripe origins. VialGrade takes no payment: /cart and /checkout are permanent redirects to
  // /market, and the only component that would load js.stripe.com (components/stripe-payment-panel)
  // is reachable only from components/checkout-client, which no route imports. Granting script and
  // frame execution to a third-party origin that nothing on the site loads is pure attack surface —
  // it is the hole a future injected <script src="https://js.stripe.com/..."> would fit through, and
  // an allowance nobody would think to audit because it looks like it belongs to a payment flow.
  // The server-side `stripe` package is unaffected: server calls never pass through CSP.
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  isProduction && servesOverHttps ? "upgrade-insecure-requests" : "",
].filter(Boolean).join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // payment=() — the site has no checkout, so nothing should be able to invoke the Payment Request
  // API from this origin, including anything injected into it.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Vercel sets HSTS on *.vercel.app, but that is Vercel asserting it for its own domain — a custom
  // apex has to assert its own or the first request of every session stays downgradeable. Gated on
  // the canonical URL being https: a browser ignores HSTS received over plain http anyway, so
  // sending it from the local/e2e server would be noise claiming to be a control.
  ...(servesOverHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: process.env.VIALGRADE_SKIP_NEXT_TYPECHECK === "1" },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  experimental: { cpus: 1, staticGenerationMaxConcurrency: 1 },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
