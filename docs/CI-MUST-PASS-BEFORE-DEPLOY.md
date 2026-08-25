# Make CI a precondition for deploying

## What was wrong

Between 20 and 24 August the `verify` workflow failed eight times in a row on `main`, and every one
of those commits deployed to vialgrade.com anyway, because Vercel builds from `main` whatever GitHub
Actions says. Nobody was notified, so nobody looked.

Measured on 2026-08-24, so this isn't a theory:

| | |
|---|---|
| commit `1d5594a` authored | **18:34:58** |
| Vercel production deployment created | **18:35:02** — 4 seconds later |
| CI finished | **~18:40** — five minutes after the site was already live |

## Why a GitHub ruleset does not fix it

A branch ruleset governs **merges**. This repo is worked by pushing straight to `main`, and a direct
push isn't a merge, so the status check never gets a chance to block it. You'd have to also require
a pull request for every change — and even then Vercel would still deploy the merge commit the
instant it lands, before the post-merge run finishes.

The only thing that makes green a real precondition is **making CI the deploy path**, so a red run
has nothing to promote.

---

## Built (in the repo, already on `main`)

`.github/workflows/ci.yml` has a `deploy` job that `needs: [verify, postgres-contract]`. It runs
only on a push to `main`, builds with the Vercel CLI, promotes to production, and then curls
vialgrade.com until it returns 200 — a promotion nobody checked is not a deployment.

Without `VERCEL_TOKEN` the job does not deploy, and says so in the run summary with a warning
annotation rather than skipping quietly — a green check must never imply a gate that isn't there.
That was its state until the token landed; see Step 1.

## Step 1 — done (2026-08-25)

`VERCEL_TOKEN` is set on the repo, so the `deploy` job is live: a push to `main` now runs the
checks, and only a green run promotes to production.

**What the token is, and why you may want to replace it.** It is the Vercel CLI's own auth token
from this machine — the credential `vercel` already uses locally. It works, and it is scoped to your
account. Two caveats worth knowing:

- It carries **full account access**, not just deploy rights. A dedicated token is narrower blast
  radius if it ever leaks.
- It dies if you ever run `vercel logout`, and the deploy job would start failing with a 403.

If you'd rather have a purpose-built one: create it at
<https://vercel.com/account/settings/tokens>, name it something like `github-actions-vial`, then
re-run `gh secret set VERCEL_TOKEN --repo pegg-dot/vial` and paste it. Nothing else changes.

---

## Step 2 — done (2026-08-25)

`vercel.json` now carries:

```json
"git": { "deploymentEnabled": { "main": false } }
```

Vercel no longer builds pushes to `main` on its own. **CI is the only path to production.** A red
run has nothing to promote, which was the whole point.

It landed only after watching a green CI deploy actually promote and serve — and that caution paid
for itself. The first real run of the deploy job *failed*: `vercel build --prebuilt` cannot work
here, because every production env var is Encrypted and `vercel pull` returns those as empty
strings, so the runner built with a blank session secret and env validation stopped it. Vercel
builds it now instead. Had auto-deploy been switched off before that was found, nothing would have
shipped at all.

### What this changes for you

- **Deploying now takes about six minutes**, because the checks run first. That is the trade.
- **A red suite means no deploy.** Not a warning — it does not ship.
- **To deploy without CI** (a hotfix, or CI itself being broken): `npx vercel --prod` from the repo.
  That still works and always will; it is a CLI deployment, not a git one.
- **To undo all of this**: delete the `"git"` block from `vercel.json`. Auto-deploy comes back.

---

## Also worth turning on (30 seconds)

Nobody was notified during those eight red runs. GitHub → your avatar → **Settings** →
**Notifications** → **Actions** → tick **Send notifications for failed workflows only**. Without it
a red `main` is silent, which is how it went unnoticed for four days. It matters more now, not
less: a red run is the thing standing between a broken commit and the site.

## What was NOT the answer

Vercel's **Ignored Build Step** can't do this. It runs before CI has finished — often before it has
started — so there is no result for it to wait on. Racing it produces flaky deploys, which is worse
than the problem it's trying to solve.
