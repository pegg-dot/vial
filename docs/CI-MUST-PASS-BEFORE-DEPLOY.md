# What stops a bad commit reaching vialgrade.com

## The history

Between 20 and 24 August the `verify` workflow failed eight times in a row on `main`, and every one
of those commits deployed anyway, because Vercel built from `main` whatever GitHub Actions said.
Measured 2026-08-24: commit authored **18:34:58**, production deployment created **18:35:02** — four
seconds later, with five minutes of CI still to run.

A GitHub ruleset cannot fix that. Rulesets govern **merges**, and this repo is pushed to directly.

## What happened next

CI became the deploy path (a `deploy` job needing both check jobs), and `vercel.json` turned git
auto-deploy off. That worked, and was proven: production deployments switched from `source=git` to
`source=cli`.

Then GitHub Actions stopped running:

> *"The job was not started because recent account payments have failed or your spending limit needs
> to be increased."*

CI was the only deploy path, and CI could not deploy. **The site could not ship at all.**

## Where it stands now — the gate lives in the build

Paying for Actions minutes is not on the table, so the check moved to compute already paid for:
Vercel's build.

- **`vercel.json` has no `git` block** — Vercel builds and deploys every push to `main` again.
- **`scripts/build.mjs` runs the unit suite before it builds.** Red suite → non-zero exit →
  *"Refusing to build: the unit suite is red. This commit will not deploy."* → Vercel ships nothing.

Proven by deliberately adding a failing test: build exited 1 and refused. Removing it: exit 0.

`build.mjs` already treated `tsc --noEmit` as a release gate and already validated the production
environment contract, so this is the same idea one step further. All three now run on every deploy.

### What it does and does not cover

| | runs on deploy | why |
|---|---|---|
| `tsc --noEmit` | yes | already was |
| production env contract | yes | already was |
| unit suite (650+, ~15s) | **yes, new** | fast, no browser, no database |
| integration suite | no | needs `DATABASE_URL` stripped from a build whose purpose is having one |
| e2e | no | needs a browser |
| security / roles / accessibility audits | no | keep them in the local gate |

Run the full thing before pushing anything substantial:

```bash
npm run verify        # lint, types, all tests, audits, build
npm run verify:live   # what is actually true on vialgrade.com right now
```

### The integration suite and production data

Not an oversight. `scripts/run-isolated-tests.mjs` used to spread `{...process.env}` into its
children, and `databaseChoice` read `DATABASE_URL` **before** the in-memory flag — so running the
integration suite on any machine with `DATABASE_URL` exported pointed it at that database. On a
build machine that is production. Nothing ever broke, because nobody happened to run it that way.

Both ends are closed now: the runner strips every real-database handle, and `databaseChoice` throws
rather than guess when both are set. That is also why the build gate runs unit tests only.

## If Actions ever comes back

`.github/workflows/ci.yml` still has the full `verify`, `postgres-contract` and `deploy` jobs. The
deploy job is inert without `VERCEL_TOKEN` and says so. To return to CI-gated deploys, put the
`"git": { "deploymentEnabled": { "main": false } }` block back in `vercel.json` — **after**
confirming a green CI deploy actually promotes, never before, or nothing ships at all. That is not
hypothetical; it is exactly what happened here.

## Still worth doing, free

GitHub → avatar → **Settings** → **Notifications** → **Actions** → **failed workflows only**.
Nobody was told during those eight red runs, which is how it went unnoticed for four days.
