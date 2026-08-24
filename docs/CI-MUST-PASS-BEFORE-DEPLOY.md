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

It is **inert right now**. Without `VERCEL_TOKEN` it does not deploy, and it says so in the run
summary with a warning annotation rather than skipping quietly, so a green check never implies a
gate that isn't there.

## The two steps left — both yours, about three minutes

### 1. Give CI a token

```bash
# create at https://vercel.com/account/settings/tokens  (scope: your team, no expiry or 1 year)
gh secret set VERCEL_TOKEN --repo pegg-dot/vial
```

Paste the token when it prompts. Nothing else needs configuring — the org and project IDs are
already in the workflow, and they're not secrets (they're in every deployment URL).

### 2. Tell me, and I'll turn Vercel's auto-deploy off

One line in `vercel.json`:

```json
"git": { "deploymentEnabled": { "main": false } }
```

**This must land after the token, never before.** Flipping it while CI can't deploy means nothing
ships at all. That's why it isn't already committed.

Once both are done: push to `main` → checks run → green promotes, red does not, and the run summary
tells you which happened.

---

## Also worth turning on (30 seconds, unrelated to the above)

Nobody was notified during those eight red runs. GitHub → your avatar → **Settings** →
**Notifications** → **Actions** → tick **Send notifications for failed workflows only**. Without it
a red `main` is silent, which is how it went unnoticed for four days.

## What was NOT the answer

Vercel's **Ignored Build Step** can't do this. It runs before CI has finished — often before it has
started — so there is no result for it to wait on. Racing it produces flaky deploys, which is worse
than the problem it's trying to solve.
