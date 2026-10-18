# VialGrade local research-only navigation and commerce QA

Date: October 18, 2026.
Status: LOCAL ONLY, not pushed, merged to remote main, preview deployed or made live.

## Goal

Deliver a source-auditable research workflow rather than a general search index or peptide storefront. First professional user hypothesis: scientific researchers and small biotech diligence teams. No purchase assistance, seller referrals, medical claims or personalized health-interest profiles.

## Permanent commerce boundary

- src/lib/commerce-pause.ts now denies old outbound referral, new cart, checkout, approved-checkout, activation and payment-provider onboarding/sync URLs and their descendants with HTTP 410, regardless of account role or release flag.
- src/proxy.ts checks that invariant before authentication and prevents staff from bypassing retired public pages in research-only mode.
- scripts/build.mjs refuses an actual Vercel production build when VIALGRADE_PUBLIC_EVIDENCE_ONLY is not explicitly true. Losing an environment setting cannot silently turn the archived storefront back on.
- Existing authenticated refunds, returns, disputes, previously created order-status access and correctly signed provider callbacks retain their original rights/remedy paths. This does not cancel any historical third-party checkout session, which would require a separate provider-account audit.
- The public research layout mounts neither MarketplaceProvider nor catalog, referral or checkout UI.

## Navigation and user experience

- The Intelligence home page now leads with a testable four-study audit, not a table of keyword-search counts. The other two topics are honestly labeled incomplete source-discovery previews.
- Static topic cards no longer need to load six external trial/publication source samples on homepage requests.
- Research navigation and legal content route to working study audit, topic and method sections. Previously dead /how-we-check links are no longer promoted from legal pages.
- Retired public URLs redirect to a clear notice explaining the purchasing shutdown. Unavailable guided audit routes render a useful 404 rather than asking for a login.
- The signed-in historical account surfaces are read-only and do not depend on the retired marketplace provider.
- Mobile study cards expose key facts before expandable source details; copy/export remains local to the browser.

## Local verification completed

- 1,249 unit tests passed across 139 files.
- 87 isolated integration test files passed in the full test:all run.
- 18 research-only Playwright browser checks passed, including direct purchase GET/POST refusals, signed-in staff refusal, historical account access, audit export, expandable study facts, and complete public research/legal internal-link crawl.
- Production-mode local Next build, TypeScript, changed-file ESLint and Git diff checks passed.
- Static security (669 source files), HTTP role-boundary and accessibility audits passed.
- Visual checks at 1440px desktop and 390px mobile found no horizontal overflow.
- Selected official registry records, the primary-source sponsor link and FDA legal link returned successful responses. OpenAlex's human-facing search page returned HTTP 403 to an automated fetch, which may be anti-bot behavior rather than a browser-visible outage.

## What these tests do not prove

They are not a scientific relevance review, production deployment verification, live Stripe/processor audit, complete legal compliance clearance, or evidence of customer demand. Public research source and subject coverage remain limited.

## Open workstreams

- Set up and verify the admin email receiving and forwarding flow with an actual outside inbox test (issue #23). It is not verified.
- Review historical account records, retention/backups, and source rights with counsel (issue #24).
- Validate at least five professional research tasks against Google Scholar and original registry/source tools, checking accuracy and time saved.
- Add dated, source-version comparisons before claiming any historical research change.
- Keep the preserved marketplace archive unavailable for commerce until a separate product-specific legal and security review.

## Release policy

Continue development locally, avoiding routine pushes, preview builds and production deployments. When the owner wants the batch released, require one explicitly approved PR and one exact-commit test/deploy/rollback review. The local milestone itself is not authorization to deploy.
