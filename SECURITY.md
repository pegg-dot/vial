# Security policy

VialGrade handles authentication, scheduled collection, third-party network access, uploaded documents, and source-linked market data. Security work is therefore part of the product, not a separate checklist.

No software is perfectly secure. This document describes the boundaries this repository intends to enforce, how to report a problem, and what testing is appropriate against the live service.

## Reporting a vulnerability

Please do **not** open a public issue containing exploit details, credentials, private data, or a working proof of concept against the production service.

Preferred reporting path:

1. If GitHub's private vulnerability reporting option is available in the repository's **Security** tab, use it.
2. If private reporting is not available, contact the repository owner privately through GitHub. If no private channel is available, open a minimal issue asking for a private contact method without including exploit details.

A useful report includes the affected route or component, impact, reproduction conditions, and the smallest proof needed to establish the issue. Please remove secrets and unrelated user data from screenshots or logs.

There is no bug-bounty commitment unless one is explicitly announced.

## Testing boundaries

Good-faith testing should stay on systems owned by VialGrade and should avoid harming availability or other users.

Please do not:

- access, modify, or delete another user's data
- attempt persistent denial of service or high-volume load testing
- run automated scans against third-party vendors, laboratories, or source websites through VialGrade
- use VialGrade as an SSRF relay or to probe private/internal networks
- publish credentials, session material, private vulnerability details, or sensitive production data
- socially engineer vendors, laboratories, users, or operators

The repository references and collects from third-party websites. Those systems are **not** part of VialGrade's security-testing scope simply because they appear in the product.

## Security architecture

### Authentication and sessions

- Passwords are stored with salted `scrypt` hashes.
- Authentication is rate-limited by both account identifier and privacy-preserving IP hash.
- Session envelopes are HMAC-signed and expiration-bounded.
- Production cookies are `HttpOnly`, `Secure`, `SameSite=Strict`, and scoped to `/`.
- Privileged requests resolve the signed envelope back to a server-side session record, allowing revocation and account-state checks.
- Secret comparisons use timing-safe comparison helpers.

### Authorization

- Route access is deny-by-default rather than relying on a list of protected pages.
- The proxy provides the first perimeter check, but privileged pages and APIs also perform server-side principal/permission checks.
- Staff, seller, and laboratory permissions are separate capability sets.
- High-impact workflows are not authorized from client-provided role claims alone.

### Browser and HTTP boundaries

The production response policy includes:

- Content Security Policy
- HSTS on HTTPS deployments
- `X-Content-Type-Options: nosniff`
- frame denial
- restrictive referrer policy
- restrictive Permissions Policy
- cross-origin opener/resource policies
- same-origin checks on unsafe browser mutations
- `private, no-store` caching for protected responses

### Third-party network access

External content is untrusted. Collection code is expected to constrain outbound requests before fetching content, including protocol and port restrictions, DNS resolution, private/reserved address blocking, redirect revalidation, timeouts, response-size limits, and content-type checks.

A redirect does not inherit the trust decision made for its previous hostname.

### Parsing and ingestion

- Uploaded and fetched content is bounded before expensive parsing or database work.
- Extraction output is constrained to known fields and does not control authentication, permissions, transaction boundaries, or publication policy.
- Captured source material is treated as data even when it contains prompt-like instructions.
- Publication paths preserve provenance and separate observed source data from reviewed/published state.

### Production configuration

Production is expected to fail closed when required persistence or authentication secrets are missing. Real credentials belong in the deployment provider's encrypted environment, never in Git or `.env.example`.

Important secret classes include session signing material, privacy hashing material, cron authorization, external API credentials, payment-provider credentials if ever enabled, and Vercel/GitHub deployment credentials.

Do not reuse the same value across unrelated secret classes.

### Release verification

The repository contains multiple independent gates rather than one generic `npm test`:

```bash
npm run lint
npm run typecheck
npm run test:all
npm run audit:security
npm run db:backup-drill
npm audit --audit-level=high
npm run build
npm run audit:roles
npm run audit:accessibility
npm run test:e2e
```

The production build path also executes a smaller release gate before Vercel can publish the build. See `scripts/build.mjs` and `docs/CI-MUST-PASS-BEFORE-DEPLOY.md`.

## Dependency and supply-chain policy

- Commit the npm lockfile.
- Use `npm ci` in automation.
- Treat high-severity `npm audit` findings as release blockers unless they are explicitly investigated and documented.
- Automated dependency update PRs should still pass the same verification gates as code changes.
- GitHub Actions should run with minimal repository permissions and should avoid leaving write credentials in the checkout unless a job actually needs them.

## Secret-handling rules

Never commit:

- `.env.local` or production environment files
- database passwords or full production connection strings
- session, privacy, cron, API, webhook, VAPID, payment, or deployment secrets
- captured Authorization headers or session cookies
- private keys or service-account JSON

If a secret is committed, removing the line in a later commit is not enough. Rotate/revoke the credential first, then remove it from the active tree and assess whether history needs to be rewritten.

## Security invariants for contributors

Changes should preserve these invariants:

1. Anonymous input cannot become a privileged principal.
2. A signed but revoked session cannot authorize privileged work.
3. A new private route is private by default even if nobody remembered to add its path to a list.
4. User-controlled URLs cannot reach loopback, link-local, private, reserved, or otherwise disallowed network targets through server-side fetching.
5. External source text cannot alter authorization or publication rules.
6. A missing production secret disables or fails a sensitive capability rather than silently substituting a weak default.
7. Sensitive writes are authorized at the server boundary, not only hidden in the UI.
8. Error handling must not log credentials, session material, raw authorization headers, or unnecessary personal data.
9. A green security audit must be capable of turning red when a known-bad mutation is introduced.
10. Production deployment should have one clearly defined authority and a verification gate before new code becomes live.

## Known residual risk

Some controls intentionally trade complexity against current product needs. For example, the CSP still permits inline scripts/styles required by the current Next.js rendering path rather than implementing a full per-request nonce architecture. Third-party source verification can also be unavailable when a source blocks server-side traffic; unreachability must remain an unknown state rather than being treated as proof of validity or fraud.

Security improvements should tighten these boundaries without turning uncertainty into false certainty.

## Incident response

If a production security incident is suspected:

1. contain the exposed capability or credential
2. revoke/rotate affected secrets or sessions
3. preserve relevant logs and audit receipts
4. determine the earliest affected deployment/data window
5. patch the root boundary, not only the observed symptom
6. add a regression test or audit rule capable of failing on the original defect
7. review adjacent code for the same bug class

The goal is not only to fix one route. It is to make the same class of mistake harder to reintroduce.