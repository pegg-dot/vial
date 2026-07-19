# VIAL 0.7.1 audit

## Scope

This audit verifies the central staff authentication perimeter added after VIAL 0.7.

## Security behavior

- `src/proxy.ts` matches `/admin/:path*`.
- `/admin/login` is the only unauthenticated exception.
- Every other current `/admin/*` page redirects to `/admin/login` before rendering.
- A valid signed, unexpired staff cookie passes the perimeter.
- Missing, forged, tampered, and expired cookies fail closed.
- Existing page and Server Action role checks remain defense in depth.
- The scenario mutation Server Action now requires the administrator role explicitly.

## Verification results

| Check | Result |
| --- | ---: |
| ESLint | Passed |
| Unit and integration test files | 9 passed |
| Unit and integration tests | 18 passed |
| Production Next.js build | Passed |
| Proxy emitted in build | Passed |
| Current unauthenticated admin routes checked | 26 of 26 redirected |
| `/admin/login` without a session | HTTP 200 |
| Public `/market` route | HTTP 200 |
| Authenticated `/admin/users` | HTTP 200 |
| Forged staff cookie | Redirected |
| Future `/admin/*` matcher regression | Passed |

The request-only Playwright perimeter test passed. Browser-driven Playwright tests could not run in this container because its Chromium policy returned `ERR_BLOCKED_BY_ADMINISTRATOR` for local URLs. This is an environment restriction rather than an application failure and is not counted as a browser-suite pass.

`npm audit` could not complete because the configured package-registry audit endpoint returned HTTP 502. No dependency versions were changed by this patch beyond the package's own version number.
