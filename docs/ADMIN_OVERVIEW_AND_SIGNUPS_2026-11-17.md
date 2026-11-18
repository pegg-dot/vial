# Admin overview and email signups (2026-11-17)

Owner request, 2026-11-17: a revamped admin page with insights and signups, the email signup offered once when a reader first arrives, and a signup that is actually kept. The old "signups" (reader accounts) no longer apply: registration is closed, so the email list is the site's signup now.

## What was wrong

On production the email list could not take a signup at all. `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` are not set, and the code treated "mail not configured" as "collect nothing": the first-visit bar never rendered, the signup page replaced its form with a notice, and `requestSubscription` returned `unavailable`. The admin page still led with reader traffic (frozen, because the page-view beacon answers 410 during the privacy review) and reader accounts (closed).

## Signups are kept before email is connected

- `requestSubscription(db, email, null)` now stores the address as `pending` with `confirm_sent_at NULL` and returns `saved`. The reader ticked the consent box; nothing is mailed. The reply is the same whether or not the address was already there, and the per-hour cap still applies.
- Once mail is configured, `runDigest` calls `sendWaitingConfirmations` first: each waiting address gets one confirmation link and stays `pending`. Only an address that clicks it is ever sent an update. A failed send leaves the row waiting.
- The 3-day confirmation window and the weekly purge now run from `confirm_sent_at` (when the link was mailed), not `created_at`, so an address is never purged for waiting and its link works when it finally arrives.
- With mail configured, behaviour is unchanged: the link goes out at once, and nothing is kept for an address that could not be mailed.
- The signup page and the privacy notice say this in words (`/intelligence/updates`, `/legal/privacy`): the address is kept until the update email starts, then one confirmation link is sent; staff who administer the list can see the addresses.

## The first-visit prompt

- `UpdatesPrompt` is a card (bottom right; a bottom sheet on a phone) with the email field and consent box inside it. It opens 1.5 seconds after a signed-out reader's first page and is marked seen in `localStorage` as it opens, so it is offered once per browser whether the reader signs up, closes it or ignores it. It is not modal: no backdrop, no focus trap.
- It opens on every public reading page and never on the signup pages, legal notices, sign-in, staff, account or retired checkout paths (`updatesPromptAllowedOn`). It no longer waits for mail to be configured.
- Signing up posts JSON to `POST /intelligence/updates/subscribe` rather than a server action, because the prompt renders on pages (compounds, vendors) whose own URL the release gate closes to POST. The route is listed in the access policy; the proxy's same-origin check, the honeypot field, the consent check and the 5-per-hour limit all apply.
- Browser tests run as a returning reader by default (`storageState` in `playwright.config.ts`), so the card is never in the way of another spec; `tests/e2e/email-updates.spec.ts` starts from empty storage to test it.

## The admin overview (`/admin`)

Health band first (unchanged), then one page in the order the owner reads it:

1. **Signups.** On the list, new in 30 days against the 30 before, confirmed, not confirmed yet; whether email sending is connected and what that means for a signup; signups per day for 30 days; the latest signups. `/admin/signups` lists everyone (newest first, up to 1,000).
2. **Reach.** Search Console (live). Reader counting is stated as switched off, with the date of the last recorded page view, instead of presenting a frozen figure as traffic.
3. **On record.** Listings, independent lab reports, compounds where one vendor has both a price and a lab report, listings read in 30 days; a plain statement of when a price was last read; listings read per week for 12 weeks. This is the check no health probe makes: a collector can be enabled and not failing while every price is months old.
4. **Collection.** Collectors needing attention, storefronts that cannot be graded, the collector table.
5. **Accounts.** Staff and earlier reader accounts, sign-ins.
6. **Shop era.** Referral figures, vendors that received traffic and the old verify queries, folded away; they cannot change.

Rules kept:

- The email list is administration, not analytics. `getSignupOverview` reads `digest_subscribers` only and returns id, address, state and three dates; a test fails if it joins page views, accounts or clicks. Unsubscribing deletes the row, so every figure is "on the list now".
- Addresses are shown only to staff with `privacy:read`; other staff see them masked (`maskEmail`).
- Charts (`AdminColumns`) are server-rendered, single series, one hue; each column shows its value on hover or focus, the peak is labelled, and every value is in a table under the chart.

## Not done, and why

- **Reader counting stays off.** Turning the page-view beacon back on would lift part of the privacy pause, which is the owner's decision.
- **Email is not connected.** Signups are saved; nobody is emailed until `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` are set on the deployment.
- Nothing here has been reviewed by counsel. The privacy notice was edited to match what the code now does.

## Tests

`tests/integration/email-digest.test.ts` (saving without mail, later confirmation, purge and window, overview), `tests/integration/catalog-insights.test.ts` (figures through the real price and lab-report writers), `tests/unit/email-digest.test.ts` (prompt rule, perimeter, reply parsing, copy), `tests/unit/admin-overview.test.ts` (day and week filling, chart, table, masking, page structure), `tests/e2e/email-updates.spec.ts` (prompt once, endpoint, signup visible in admin; run in CI's research-only step).
