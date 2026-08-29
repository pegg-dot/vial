# A4 — VialGrade operational health audit (read-only)

Audited 2026-08-29 17:17–17:25 UTC against prod build `b062199e2d20` (`/api/health/live`), which equals local `HEAD b062199` — so every `file:line` below is the code that is running. 12 public HTTPS requests used. No auth, no DB, no env, no edits.

Legend: **[V]** verified from a public surface or the running code · **[I]** inferred (code-level reasoning, not directly observable).

---

## A. Schedule topology [V]

`vercel.json` → four Vercel Crons, each a GET with `Authorization: Bearer $CRON_SECRET`, each listed in the perimeter allowlist (`src/server/auth/access-policy.ts:47-60`):

```
 0 * * * *   /api/internal/cron/collect        (route.ts:38)  runCollectionTick{budget 45s, 8 targets}      maxDuration 120
                                                └─ syncCollectionTargets (scheduler.ts:81)  99 rows from known-vendors.json
                                                └─ claimDueTargets ≤200, fair-share by kind (scheduler.ts:320-341)
                                                └─ per target: runOne → settle (scheduler.ts:137-150) → collector_runs row
                                                └─ if catalog changed: recomputeCompoundStats/VendorStats/rebuildSearchIndex (:364-373)
                                                └─ recomputeAllVendorGrades{45s, 200}  ← THE GRADE SWEEP (scheduler.ts:388), hourly
                                                └─ revalidateTag(CATALOG_CACHE_TAG) (route.ts:44)
*/15 * * * * /api/internal/cron/provenance     (route.ts:41)  runRefreshSweep(20 jobs, 90s) + triagePendingClaims   maxDuration 120
30 5 * * *   /api/internal/cron/refresh        (route.ts:31)  intelligence sweep + retention + cost signals          maxDuration 60
30 */6 * * * /api/internal/cron/notifications  (route.ts:47)  runNotificationSweep(200 readers, 90s)                 maxDuration 120
```

Cadences (`scheduler.ts:50-66`): catalog-shopify/woo/rsc 6h · vendor-status 24h · news 12h · enforcement 24h · domain-age 30d · tracker-ratings 7d. Failure backoff `cadence×2^n` capped 7d; auto-disable after 12 failures or 3 refusals (`:68-72,:132-135`).

Capacity arithmetic (`schedule-capacity.ts`, asserted in `tests/unit/schedule-capacity.test.ts:38,45`) with the live vendor file (34 vendors, 7 red-flagged, 27 collected, 16 with a catalog collector → 99 targets):

| queue | supply/day | demand/day | headroom |
|---|---|---|---|
| collect | 24 × 8 = 192 | 16×4 + 27×(1+1/30+1/7) + 3 ≈ 99 | **1.9×** |
| provenance | 96 × 20 = 1920 | 431 policies × 1/day (`live-sources.ts:290`) | **4.5×** |
| notifications | 4 × 200 readers | 0 subscribed readers | ∞ |

**Neither queue is structurally behind.** That matters for finding P1-A: a 4.5× surplus cannot produce a source 4× late — something is being *skipped*, not *queued*.

Two doc claims in `docs/HANDOFF.md:95-96` are stale [V]: there is no 04:30 UTC cron, and the grade sweep is hourly inside the collect tick (proof: all 83 vendors' `gradedAt` in `/api/v1/catalog` are 17:00:03–17:10:25Z today). The comment at `scheduler.ts:378-387` ("The cron is now daily") is also stale since `56b95aa` (08-24).

## B. Health semantics [V]

From `src/server/collect/metrics.ts:66-74`, `src/server/refresh/repository.ts:180-191`, `src/server/notifications/sweep.ts:216-288`, `src/lib/system-health.ts:34-73`:

- **enabled** — `collection_targets WHERE enabled`.
- **waiting** (rendered word for `overdue`) — enabled AND `next_due_at <= NOW()`.
- **past due** — `MAX(NOW() − next_due_at)` over waiting targets, in minutes.
- **failing** — enabled AND `consecutive_failures > 0`. A failing target's `next_due_at` is pushed into the future by backoff (`scheduler.ts:145`), so **a failing target is never "waiting" and never contributes to lateness**.
- **worstLateness** — `MAX((NOW() − next_due_at)/cadence)` over waiting targets only. `keepingUp` = enabled>0 AND worstLateness < 3 (`metrics.ts:37,48-51`).
- **refresh "Nx its own interval late"** — same formula over `source_refresh_policies` (`repository.ts:190-191`); "due" = enabled AND `next_run_at <= NOW()`.
- **Banner ladder** (`system-health.ts:38-72`), first match wins: DB unreachable → outage · schema drift · any subsystem null · collectors.enabled=0 · collectors !keepingUp · refresh.enabled=0 · **refresh.behind (worstLateness ≥ 3)** ← today's banner · refresh.failed>0 · sweep unhealthy · sweep !keepingUp · operational.
- **Alert sweep "N readers"** = `items` of the latest `collector_runs` row for `notification-sweep` = readers actually swept. "healthy" = last run ok AND < 48h old (`SWEEP_STALE_HOURS`, `sweep.ts:253`). "keeping up" = `waitingReaders − swept ≤ 200`.

So today's line reads: collectors are *within tolerance* (18 min late on a 6h cadence = 0.05×); the Degraded banner comes entirely from the **refresh/provenance queue**, and "2 failing" is informational only.

## C. Findings, ranked

### P1-A · Refresh queue is permanently "behind" because stuck `running` jobs are never reclaimed
- **Evidence [V]:** `/status` 17:17:56Z: "Refresh engine 431 enabled · 48 due · worst is 4x its interval late". Provenance cron runs 96×/day at 20 jobs; healthy steady state is ≤5 due right after a tick. 48 due with 4.5× capacity = ~45 policies that are due but never served.
- **Mechanism [I, code-verified]:** `enqueueDueRefreshJobs` skips any policy with a job in `('queued','retrying','running')` (`repository.ts:238-241`); `claimNextRefreshJob` only claims `('queued','retrying')` (`:264`). A job left `running` — function killed at the 120s ceiling, or any throw between claim and the `try` at `scheduler.ts:90-107` — is therefore never retried and blocks its policy forever; the policy's `next_run_at` stays in the past (only advanced at `:130,:189,:238`) and its lateness grows without bound. The comment at `scheduler.ts:283-286` names this exact risk; nothing implements a lease. `observability/metrics.ts:18` already *counts* "refresh jobs active > 30 min" (`refresh.stalled`, warning ≥1) but it is only reachable via `/api/v1/observability` (staff, `security:read`) and nothing acts on it.
- **Why 4×:** interval is 1440 min (`live-sources.ts:290`), so 4× = ~4 days = 08-25, the day enrolment (`69ef8f1`) and the perimeter fix (`cced479`) shipped — i.e. policies stuck since their first ever job.
- **Smallest fix:** at the top of `runRefreshSweep` (`refresh/scheduler.ts:280`) add one statement: `UPDATE refresh_jobs SET status='retrying', available_at=NOW() WHERE status='running' AND started_at < NOW() - INTERVAL '10 minutes'` (10 min ≫ 120s maxDuration). Attempts already increment on claim, so `max_attempts` still terminates the loop and the failure path advances `next_run_at`.
- **Prove:** owner reads `refresh.stalled` on `/api/v1/observability` before (expect ≥1) and after one tick (expect 0); `/status` "worst is Nx" must fall below 3 within 15 min and the banner must leave the refresh rung. Positive control: temporarily set the interval to 1 minute in a test and assert the stuck job is re-claimed.

### P1-B · 250 of 904 live listings (28%) have not been observed in 8–24 days, 232 of them shown "In stock"
- **Evidence [V]** (`/api/v1/catalog`, `observedAt`): bluum-peptides 54/54 stale (newest 08-21, 8.5 d) · behemoth-labz 48/48 stale (newest 08-05, 24.5 d) · purerawz 132/154 stale (15 d) while its 22 fresh ones were re-read 4 h ago. `lastChecked` reads "15 days ago"/"24 days ago" on the product card, but the listings still carry `availability: "In stock"` and feed compound medians and the 2,262 public "Prices are all over the map" signals (`/signals`).
- **Three distinct causes, all verified:**
  1. **bluum-peptides — silent false-green.** `https://bluumpeptides.com/products.json` returns **404** (site is no longer Shopify; the 404 body is a Tailwind/Next page). `fetchShopifyProducts` swallows any `!res.ok` and returns null (`shopify-import.ts:69-79`); `importShopifyCatalog` returns `imported: []` (`:158`); `runOne` then hard-codes `ok: true` (`scheduler.ts:281-284`). Result: a green run with 0 items every 6 h for 8 days; not counted as "failing", never backed off, never disabled. `getBrokenCollectors` (`health/data-health.ts:38-54`) would flag exactly this ("yielded before, yields none now") but it only renders on `/admin` (`admin/page.tsx:376-378`) and is not an input to `deriveSystemHealth`.
  2. **behemoth-labz — dead target.** Its Store API answers today (`x-wp-total: 31`, HTTP 200 to the audit UA), yet nothing has been written since 08-05 — 24 days, beyond the 7-day max backoff. 99 targets expected vs **98 enabled** on `/status` → one target is disabled, and `syncCollectionTargets` never re-enables (`ON CONFLICT ... DO UPDATE SET collector,target,cadence_minutes` only — `scheduler.ts:105-108`). [I] behemoth is that disabled row (or the importer's own UA is being 403'd while mine is not).
  3. **purerawz — delisted products are never retired.** Vendor now publishes 80 products (`x-wp-total: 80`); VialGrade still serves 154 listings, because imports upsert and nothing marks a listing absent from a successful run (`data-health.ts:5-7` states this; no code anywhere does it — grep for "absent/retire/delist" in `src/server/ingest` finds none).
- **Smallest fixes:** (1) `scheduler.ts:284` → `ok: result.productsSeen > 0, error: productsSeen ? undefined : "storefront returned no products"`, and flip `bluum-peptides` in `known-vendors.json` to the RSC path after a manual probe. (2) in `syncCollectionTargets` add `enabled = collection_targets.enabled OR collection_targets.updated_at < NOW() - INTERVAL '7 days', consecutive_failures = CASE WHEN ... THEN 0 ...` so a disabled target is re-probed weekly; and delete rows whose id is not in this tick's row set (a flag flip today leaves a zombie `ct:catalog-shopify:…`). (3) after a successful catalog import, `UPDATE listings SET availability='Unavailable' WHERE vendor=… AND origin='live' AND observed_at < run_started_at` — one statement, same transaction as the import.
- **Prove:** re-fetch `/api/v1/catalog`; the `observedAt ≥ 7d` count (250 today) must trend to ~0 within one cadence, and no `In stock` listing may carry `observedAt` older than 2× its cadence. `/status` "failing" must go from 2 to ≥3 the tick after fix (1) deploys — a guard that cannot fail is not a guard.

### P2-A · `probeVendorStatus` reports "operating" for closed and parked storefronts
- **[V]** `https://science.bio/` → HTTP 200, `<title>Science Bio — Permanently Closed</title>`; `https://certifiedpep.com/` → HTTP 200, a domain-parking ad frame (`findresultsquick.com/…/safeframe.html`, `cdn-fileserver.com`, zero product text). Both exceed 600 bytes and miss the `PARKED` regex (`verify/vendor-status.ts:17`), so `:29-30` returns `operating` — which is why HANDOFF says they "probe as operating". The same probe runs for all 27 collected vendors hourly (`scheduler.ts:235-239`) and is read on `/vendors/[slug]`.
- **Fix:** extend `PARKED` with `permanently clos|ceased (operations|trading)|discontinue the sale|no longer (operating|in business|accepting)|safeframe\.html|cdn-fileserver|findresultsquick`, and emit a distinct `closed` status for the closure family. **Prove:** `node scripts/collect-vendor-status.mjs` must print 🔴 for both.

### P2-B · Nobody can see *which* collector is failing
- **[V]** `/status` renders counts only; `/admin` groups `collection_targets` by collector kind with `MAX(last_error)` (`admin/page.tsx:74-82`), so two failing targets of the same kind collapse into one row. There is no per-target view and no public JSON: `/api/v1/observability` needs staff; `/api/public/v1/signals` is bearer-gated (401 `Bearer API key required`).
- **Fix:** an owner-only table on `/admin` from `SELECT collector,target,last_ok,last_error,consecutive_failures,enabled,last_run_at,next_due_at FROM collection_targets WHERE NOT enabled OR consecutive_failures>0`, plus `getBrokenCollectors()` output (already computed on that page). Safe to expose: it names vendor slugs and error strings only.

### P3 · Drift and copy
- `SWEEP_STALE_HOURS = 48` (`sweep.ts:253`) with a 6-hourly cron lets 8 missed ticks pass silently; 13 h would catch two. Card copy says "nightly"/"past its daily schedule" (`status/page.tsx:137,141`).
- `vendors[].lastObserved` is `2026-08-05` for all 73 vendors that have it [V] — frozen field, never rewritten by the collectors.
- HANDOFF `docs/HANDOFF.md:91-96` (04:30 cron; "probe as operating" framing) and `scheduler.ts:378-387` comment are stale.
- Signals pile: 2,262 open, growing per stale listing (`intelligence/scanner.ts:107-121` emits one per listing >24 h), which P1-B is inflating.

## D. The "2 failing" collectors

Identities are **not** public. From public evidence: bluum-peptides is *not* one of them (it is false-green, P1-B.1) and behemoth-labz is most likely the *disabled* target, not a "failing" one. The two `consecutive_failures>0` rows are therefore probably a `domain-age`/`tracker-ratings` registry refusal or a catalog vendor mid-backoff — unknowable from outside; P2-B is the exposure fix. Alert sweep "0 readers · 5 h ago" is **consistent and healthy**: the 12:30Z tick ran 4.8 h earlier, `ok` was true, and 0 = no active user holds a watchlist/follow/active saved search (`sweep.ts:54-64`). If the owner's own account has follows, that becomes a defect.

## E. Catalog coverage gap — verdict: not a gap, close the HANDOFF item

`science-bio` and `certified-peptides` are `redFlag: true` in `known-vendors.json` (DEFUNCT / impersonation) and are filtered before any target is created (`scheduler.ts:83`). Live probes confirm: science.bio is a closure notice, certifiedpep.com is a parked ad page. Neither is Shopify or WooCommerce; product count is **zero**. Promotion would require `redFlag: false` + a live products endpoint + the vendor hostname in the policy allowlist (`live-sources.ts:296-330`) + `VIALGRADE_LIVE_INGEST_APPROVED=true` (`collect/route.ts:31`) — and would publish "Live" prices from a fraudulent successor domain, which AGENTS.md forbids. The six orphan `vendor_status` rows are stale probe artifacts; leaving them is fine, but P2-A stops the probe lying about them.

## F. Could not verify from public surfaces

- `refresh_jobs` status histogram (the direct proof of P1-A) — read `refresh.stalled` on `/api/v1/observability` or `SELECT status,COUNT(*) FROM refresh_jobs GROUP BY status`.
- Which target is disabled / the two failing (D) — `/admin` today shows kind-level rows; the P2-B query answers it.
- Whether the importer UA (`VialGrade-Catalog-Import/1.0`) is being 403'd by behemoth's Cloudflare while the audit UA is not — one owner-run `curl` with that UA.
- Whether any active user holds a subscription (alert-sweep 0 readers) — `SELECT COUNT(*) FROM user_watchlists` etc.
- Whether the 15:00/16:00 ticks imported anything (catalog JSON is cache-revalidated at 17:10 and shows no `observedAt` between 14:00 and 17:10) — Vercel function logs for `/api/internal/cron/collect`.
