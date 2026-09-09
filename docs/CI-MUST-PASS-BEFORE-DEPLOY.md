# What stops a bad commit reaching vialgrade.com

## Current production authority

VialGrade currently ships through **Vercel's Git integration**. A push to `main` starts a Vercel build, and `scripts/build.mjs` is part of that production boundary.

For a deployed build, it runs:

1. TypeScript without emit
2. the fast unit suite
3. the production environment contract
4. the Next.js production build

A failure exits non-zero, so Vercel cannot publish that build as a successful deployment.

The larger GitHub Actions workflow still runs the full verification suite, but its optional Vercel CLI promotion job is **disabled by default**. It only runs when the repository variable `VERCEL_CI_DEPLOY_ENABLED` is exactly `true`.

That distinction is deliberate. Production should have one deployment authority, not two paths racing to publish the same commit.

## Why this is explicit

Historically, Vercel built `main` immediately while GitHub Actions was still running. A red CI run could therefore arrive after the same commit was already live.

The repo then tried the opposite approach: disable Git deployment and let a CI deploy job become the only path. When GitHub Actions could not run, production could not ship at all.

The current build gate moved the minimum release contract onto compute that necessarily runs before Vercel can publish a deployment.

A second failure mode appeared later: `VERCEL_TOKEN` existed in GitHub Actions but was no longer valid. Both verification jobs passed, Vercel's Git integration successfully deployed the exact SHA, and then the redundant CLI deploy job failed with an invalid-token error. The overall workflow looked like a production deployment failure even though production had already deployed successfully.

Presence of a secret is therefore no longer treated as evidence that CI should own production. The CLI job requires an explicit repository-level opt-in.

## What runs where

| Check | Vercel production build | GitHub Actions / local `npm run verify` |
|---|---:|---:|
| TypeScript | yes | yes |
| production env contract | yes, when `DATABASE_URL` is present | yes in PostgreSQL contract job |
| fast unit suite | yes | yes |
| integration suite | no | yes |
| static security audit | no | yes |
| role-boundary HTTP audit | no | yes |
| backup/restore drill | no | yes |
| dependency audit | no | yes |
| accessibility audit | no | yes |
| Playwright browser tests | no | yes |

The production build intentionally does not run the integration suite. A deployed build has a production `DATABASE_URL`; an integration runner must never inherit that handle. `scripts/run-isolated-tests.mjs` strips real database handles, and `databaseChoice` refuses to guess if both a real database and in-memory test database are requested.

## Normal release workflow

Before a substantial push:

```bash
npm run verify
npm run verify:live
```

After a push to `main`, Vercel Git integration builds the commit. The build itself refuses to publish if its release gate fails.

GitHub Actions independently exercises the heavier suite. A red workflow still needs investigation, but the disabled CLI deploy job should not manufacture a false red state simply because an unused deployment credential is stale.

## Migrating production authority back to CI

Do not enable the CLI deploy job and disable Git deployment in the same unverified step.

Use this order:

1. create a fresh Vercel token with the minimum access needed to deploy this project
2. replace the stale `VERCEL_TOKEN` GitHub Actions secret
3. set repository variable `VERCEL_CI_DEPLOY_ENABLED=true`
4. push a safe commit and prove the CI `deploy` job authenticates, promotes, and confirms `https://vialgrade.com/` returns HTTP 200
5. only after that proof, disable Vercel Git auto-deploy
6. confirm subsequent production deployments have one path only

If CI is not intended to own production, leave `VERCEL_CI_DEPLOY_ENABLED` unset or false. The stale CLI token can then be removed entirely.

## Why the token still needs an operator

Deployment credentials are intentionally not stored in the repository. The GitHub connector can change code, but a Vercel token should be created or rotated in the account that owns the deployment and stored as an encrypted GitHub Actions secret.

The repository can enforce how that credential is used. It should not contain the credential itself.

## Release invariant

The invariant is more important than the particular provider:

> The code path capable of making a commit live must have a release gate before publication, and only one system should be authoritative for production at a time.
