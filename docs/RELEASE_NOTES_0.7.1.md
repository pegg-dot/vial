# VIAL 0.7.1 — Central admin authentication perimeter

VIAL 0.7.1 fixes an authorization gap in the staff control plane.

## Security fix

All `/admin/*` requests are now intercepted by a single Next.js Proxy boundary before route rendering. The only public route under that namespace is `/admin/login`.

Unauthenticated requests are redirected to `/admin/login`, including routes added in the future that match `/admin/:path*`. This removes the prior dependency on every page author remembering to call `requireStaff()`.

The signed staff-cookie codec now lives in a pure shared module used by both the Proxy and server-side session helpers. Existing page and Server Action role checks remain defense in depth. The scenario mutation action now also performs an explicit administrator check.

## Regression coverage

- Every current staff page is checked for an unauthenticated redirect.
- A future placeholder route is checked against the Proxy matcher.
- `/admin/login` remains public.
- Valid signed staff cookies pass the perimeter.
- Tampered and expired cookies are rejected.
