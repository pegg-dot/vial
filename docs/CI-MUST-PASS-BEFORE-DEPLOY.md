# Make CI a precondition for deploying

Right now it isn't. Between 20 and 24 August the `verify` workflow failed eight times in a row on
`main`, and every one of those commits deployed to vialgrade.com anyway, because Vercel builds from
`main` whatever GitHub Actions says. Nobody was notified, so nobody looked.

Two settings close it. Both are yours — I can't change either from here. Five minutes total.

---

## 1. GitHub: stop anything merging into `main` while CI is red

1. Go to **https://github.com/pegg-dot/vial/settings/rules** → **New ruleset** → **New branch ruleset**
2. **Ruleset name**: `main must be green`
3. **Enforcement status**: switch from *Disabled* to **Active** — it defaults to disabled and does nothing until you change it
4. Under **Target branches** → **Add target** → **Include default branch**
5. Under **Rules**, tick:
   - **Require status checks to pass**
     - then **Add checks** and search for **`verify`** — that's the job name in `.github/workflows/ci.yml`
     - tick **Require branches to be up to date before merging**
   - **Block force pushes**
6. **Create**

**One thing to decide.** If you also tick *Require a pull request before merging*, you can no longer
push straight to `main` — every change goes through a PR. That's the stronger setup and it's what
makes the status check actually unavoidable. Without it, a direct push to `main` still lands; the
ruleset only governs merges.

Given how this repo is worked on today (direct pushes to `main`), I'd suggest **leaving the PR
requirement off for now** and turning it on when you want that discipline. The status check alone
still gets you the alert and the red X.

---

## 2. Vercel: stop deploying a commit whose CI failed

1. Go to **https://vercel.com** → your **vial** project → **Settings** → **Git**
2. Find **Ignored Build Step** (near the bottom)
3. Set it to **Custom** and paste this command:

```bash
node -e "process.exit(process.env.VERCEL_GIT_COMMIT_REF==='main'?0:0)"
```

Actually — **skip that one.** Vercel's Ignored Build Step runs *before* CI finishes, so it can't
wait for a result that doesn't exist yet. Racing it produces flaky deploys, which is worse than the
problem.

**Do this instead — Vercel's own setting for exactly this:**

1. **Settings** → **Git** → **Deploy Hooks / Production Branch**
2. Turn ON **"Only deploy when GitHub Actions succeed"** if your plan shows it
   *(Vercel labels this differently across plans — look for wording about waiting on checks)*
3. If your plan doesn't offer it, the reliable alternative is to **disconnect automatic Git
   deploys** and deploy from CI instead: add a final step to `.github/workflows/ci.yml` that runs
   `vercel deploy --prod` with a `VERCEL_TOKEN` secret. That way CI *is* the deploy path, and a red
   run physically cannot ship.

I'd do option 3 if the setting isn't available. Tell me and I'll write the workflow step — it's
about fifteen lines and I can have it tested before you touch anything.

---

## 3. Get told when it breaks

The reason a week of red went unnoticed is that nothing said so.

1. **https://github.com/settings/notifications**
2. Under **Actions**, tick **Send notifications for failed workflows only**
3. Choose email, or **Web and Mobile** if you have the GitHub app

That single checkbox is what would have caught this on day one.

---

## What "green" currently means

The `verify` job runs, in order: `npm ci` · lint · typecheck · **623 unit tests** ·
**57 integration files** · static security audit (575 source files) · database backup drill ·
`npm audit --audit-level=high` · production build · roles audit · accessibility audit ·
**14 Playwright end-to-end tests** — then a second job validates the production environment and
builds against the real PostgreSQL contract.

That is a genuinely strong gate. It has just never been load-bearing.
