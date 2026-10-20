# VialGrade · Model-backed evidence analyst (local milestone)

Date: October 19, 2026
Status: **LOCAL PREVIEW ONLY; NO GITHUB PUSH, NO VERCEL DEPLOY, NO LIVE MODEL CALL YET.**
Goal: retain VialGrade's original marketplace-style research explorer while adding a source-grounded intelligence workspace for professional scientists and biotech analysts.

## Pinned goal

Keep marketplace-style discovery, compound dossiers, source passports, research materials and organization links. Add a real model workflow that retrieves an allowlisted source file and drafts question-specific PROVISIONAL interpretations. Every linked citation must resolve to a server-owned exact editorial claim/source relationship. Not medical advice, synthesis instructions, laboratory certification, inventory, clinical drug efficacy scoring or procurement.

Current subject is Pexiganan / MSI-78, with distinct Magainin 2 source records. The wider evidence network has six selected editorial observations and ten primary source metadata/registry pointers; a question-specific tool returns only the relevant subset. The model is NOT browsing full articles or adjudicating their clinical results.

## Implemented

- AI SDK v7 integrated with Vercel AI Gateway, with default model openai/gpt-5.4-mini, verified against the live model list on October 19.
- An opt-in model panel on /intelligence/desk while retaining all existing source-only tools.
- POST /api/research/analyst: read-only localhost, same-origin, explicit informed consent, strictly validated request size, topic and scope.
- Mandatory first read-only tool loadDeskEvidence; optional inspectSource tool can only read sources from the selected allowlisted topic. No arbitrary web fetches, vendor/COA archive imports, DB writes or manufacturing tools.
- AI SDK generateText + Output.object + Zod structured response, limited to four steps, 1250 output tokens per step, no retries and 20 seconds total.
- Deterministic source validation checks every exact claim ID and per-claim source ID before returning a response. Fabricated IDs and false joins cause a safe failure rather than a fake citation.
- A potential conflict can only be raised for an editorial claim already labeled needs-interpretation. This indicates an unresolved source relationship, never proven experimental contradictions.
- Server-resolved original links and observations are shown next to separately labeled model interpretation. Model-provided URLs are never displayed.
- A checkbox and explicit click are required for every model run. Results remain only in the browser; VialGrade does not persist prompts, answers or conversation history.
- The external gateway/provider may process and log request data under their own terms; the UI discloses that public source records and the user's question would leave the Mac.
- An explicit evidence-only local preview flag, a second AI opt-in flag and a budgeted gateway API key must all be present. Default is DISABLED.
- 12 analysis runs per Node process (one at a time). This is a local development stopgap, NOT durable rate limiting or a dollar-denominated cost cap.
- Commerce remains quarantined: checkout endpoint HTTP 410.

## Local setup, only when owner has approved a small budget

No credentials were created, printed, requested from Vercel, or committed by this change. A paid model will not be invoked without a private gateway key. Create a spend-capped Vercel AI Gateway API key directly in Vercel's Dashboard and put it into the ignored app-local .env.local file (NOT git, a chat or shell history):

    VIALGRADE_RESEARCH_AI_ENABLED=true
    AI_GATEWAY_API_KEY=<privately created budget-limited gateway key>

The existing one-click local preview launcher already sets VIALGRADE_LOCAL_PREVIEW=true and VIALGRADE_PUBLIC_EVIDENCE_ONLY=true. Restart the preview. The key is server-only; the page can see only a readiness boolean and public model name.

A model run sends the question plus selected PUBLIC editorial records to Vercel AI Gateway/provider. Do not paste unpublished sequence IP, proprietary datasets, patient health information or other confidential data. Model output is a draft, not a certified scientific result.

As checked October 19, gateway pricing for openai/gpt-5.4-mini started at $0.75 / 1M input tokens and $4.50 / 1M output tokens. Multi-step calls incur multiple generation steps and costs. A Gateway spend-capped key, not an in-memory request counter, is the actual currency limit.

## What is and is not verified

- Pure unit tests exercise scope, mandatory consent, exact source joins, restricted tool invocation with a mock provider, privacy fail-closed configuration, no-key state, absent cross-origin access, rejected unsupported materials/procurement questions and raw error suppression.
- Browser tests exercise local no-key and model-enabled (HTTP intercepted/mocked, ZERO actual provider calls) states, mobile layout, citation display and checkout denial.
- Build/typecheck/lint/security/test status must be recorded in the execution ledger after the run.
- No real billed model response is available in this milestone because the local app has no gateway credential. No independently reviewed clinical analysis exists.

## Verified software results (October 19, 2026, latest build)

- Optimized research-only Next.js production build: PASS (Next 16.4.0, webpack); no deployment.
- Full unit suite: **1,330 / 1,330 passed in 153 files**.
- Full isolated integration suite: **all 87 integration test files passed**.
- Offline-mode browser regression: 9 passed, 1 intentionally skipped (mock-enabled case).
- Enabled-mode browser simulation: 2 passed, 2 intentionally skipped (offline-only case). Model replies were intercepted using a fixture; no gateway credits, keys or real vendor calls were used. The browser asserts the signed capability header exists and that the *mock* gateway key does not appear in rendered page HTML.
- Repo-wide ESLint: PASS. TypeScript noEmit: PASS.
- Static security audit: PASS (713 source files). HTTP role-boundary audit: PASS (62 discovered routes). Structural accessibility audit: PASS (62 discovered routes).
- NPM production-only dependency audit: **zero vulnerabilities**. Full NPM audit reports **five high-severity development dependency advisories**, all in the existing ESLint Next config and its transitive tree (braces, fast-glob, micromatch, eslint-plugin-next); no critical advisories. Do not use the suggested automated force-fix because it proposes downgrading ESLint config to an older major Next generation. Revisit in a dedicated upgrade/test pass.
- Signed 30-minute local authorization, forgery and expiry paths, source mismatch fail-closed, body size and explicit-consent rejection: unit-tested. A real Safari localhost HTTP smoke caught and fixed a global proxy / handler mismatch when Next normalized 127.0.0.1 to localhost. The narrowly scoped fallback requires matching loopback Host + Origin and explicit local research-only flags. Unit and Chromium tests reject mismatched ports, forged Host, foreign origins and nonlocal fallback.
- The fresh Mac Safari preview is live locally at http://127.0.0.1:39571/intelligence/desk. GET 200 for Research Market, Desk, Materials, Providers and the Pexiganan dossier. The actual localhost POST with matching Origin reaches the model endpoint and returns 503 model_not_connected because no real AI Gateway key is configured (not the former erroneous proxy 403). A foreign Origin returns 403; checkout POST returns 410. Safari's front document confirms the Desk URL. Browser inspection shows the no-key panel on desktop and 390px mobile without horizontal overflow.

There is NO real AI Gateway key on the operator's Mac. Live provider authentication and biomedical answer quality have NOT been verified. Do not claim otherwise.

## Explicit sequence change

OLD: static source briefing packet -> test interest in later model integration -> broader scientific review.

NEW: optional actual tool-calling model integration now (disabled without budgeted credentials) -> owner reviews local source-linked UX -> one owner-authorized live pilot with budget -> structured human-audited quality benchmark -> potential professional rollout subject to consent, privacy and rights review.

WHY: user wanted AI as part of the original marketplace-style product now, without a disconnected chatbot and without losing source integrity.

DEFERRED: autonomous lead optimizer, synthetic molecule suggestions, experimental efficacy or toxicity estimates, AI freedom-to-operate score, lab certificate verification without issuer, real-time lab availability, vendor pricing, payments, escrow and peptide sales. Revisit only after specific scientific, partner, legal and source-rights validation.

## Release blockers

- Independent biomedical review of claims and source ambiguity.
- Resolve exact match between relevant historical trial and publication; do not silently treat DERIVED as one-to-one evidence.
- Subject-specific provenance beyond Pexiganan, before adding other compounds to the model UI.
- Professional comparison tests with at least five real researcher tasks and five biotech analyst tasks using independent answer keys; measure correctness and ungrounded joins.
- Authenticated distributed rate limits, API budgets, audit data policies and key management before any public AI endpoint.
- Separate legal review before commercial supplier verification or transaction flows.

**Goal check:** The answer's scientific evidence comes from the original linked record. The model provides organization and provisional interpretation; a fluent paragraph never becomes a laboratory measurement or clinical finding.
