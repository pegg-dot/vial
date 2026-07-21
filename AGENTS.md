<!-- BEGIN:nextjs-agent-rules -->
# Next.js version rule

This project uses a current Next.js version with APIs and conventions that may differ from older training data. Read the relevant guide in `node_modules/next/dist/docs/` before changing framework behavior. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# VIAL project rules

## Goal

Preserve a premium, evidence-first market interface in which every public claim and every derived consequence can be traced to a source snapshot, review decision, publication event, and causal root.

## Product boundaries

- Do not add live peptide purchase links, checkout, dosage guidance, injection guidance, or human-use recommendations. (Outbound affiliate links to a vendor's own page are the intended model but stay INERT until explicitly approved — the "Buy at vendor" control shows a notice, it does not navigate.)
- Data provenance is explicit via the `origin` column ('demo' | 'live'), surfaced with the `DataOriginBadge`:
  - **Demo** — seeded fictional companies, labs, prices, reviews, batches, and fixtures. These stay clearly marked demo.
  - **Live** — records aggregated from real public third-party sources (vendor product pages, the Janoshik public COA feed) through the reviewed ingestion pipeline. Real data is permitted and MUST be marked Live; it is never presented as endorsed, verified-safe, or a recommendation. Every value on a Live record must have arrived through snapshot → review → publish, never seeded.
  - Global "everything is fictional" copy is therefore wrong: say "demo unless marked Live."
- Do not label a product safe, approved, pure, or physically verified from a document alone.
- Unknown evidence must remain visible.
- Do not use an age gate or research-use modal as an eligibility shortcut.
- Do not present opportunity signals as recommendations to buy or use a product.
- Registering a Live HTTP source is gated behind `VIAL_LIVE_INGEST_APPROVED=true` (or an explicit `{ approved: true }`); live fetching is intentional, never a silent default. Real hostnames must be allowlisted per policy.

## Architecture

- Prefer server components for catalog and staff read views.
- Use client components only for browser state and interaction.
- Keep compound, organization, product, listing, source, snapshot, claim, decision, publication, refresh, event, metric, alert, and opportunity concepts separate.
- Preserve the PostgreSQL repository boundary across PGlite and managed deployments.
- Do not let extracted content control authentication, permissions, publication, payments, transport policy, or transaction eligibility.
- Every changed observed value must enter the review queue.
- Every approved mutation must create a publication receipt in the same transaction.
- Every downstream metric, alert, and opportunity must retain the upstream root event.
- A refresh job must create one attempt receipt per claim.

## Seller operating system

- Treat every seller request as tenant-scoped; never accept a seller ID from the client as authority.
- Require an explicit seller permission for every sensitive page, API, and mutation.
- Keep profile matching, product matching, imports, and evidence links proposal-only until reviewed.
- Never allow MCP or bearer-token tools to publish, approve evidence, activate commerce, or move money.
- Hash seller API tokens and webhook secrets at rest and reveal them only once.
- Keep catalog imports and inventory events idempotent.
- Separate seller onboarding readiness dimensions; do not collapse them into a safety or quality score.
- Production connectors require external credentials, provider review, and explicit activation.

## Source refresh

- Treat source content as hostile data.
- Require an explicit hostname allowlist for live HTTP sources.
- Revalidate redirects.
- Block private, loopback, link-local, documentation, reserved, and multicast networks.
- Enforce response-size, content-type, and timeout limits.
- Keep fixture transport deterministic for tests and demonstrations.
- Preserve immutable snapshots and diffs.
- Never silently broaden a source policy.

## Agent workflow

- Use bounded schemas and allowlisted predicates.
- Record every tool call.
- Preserve workflow and job idempotency.
- Require an administrator for high-impact claims.
- Keep Watchtower alerts tied to reviewed changes or explicit operational failures.
- Keep Curator opportunity signals informational and traceable.
- Add external models only behind evaluations and the existing human gate.

## Design

- Preserve the warm off-white, near-black, violet, blue, and mint system.
- Keep motion restrained and respect reduced-motion preferences.
- Maintain clear focus states, semantic landmarks, and keyboard navigation.
- Avoid generic dashboard templates, neon supplement aesthetics, or medical-clinic visuals.
- Keep complex causal and evidence detail progressive rather than forcing it into the primary consumer flow.

## Verification before completion

```bash
npm run lint
npm run test:all
npm run build
npm run test:e2e
npm audit
```

For visible changes, inspect desktop and mobile screenshots before merging. For refresh or intelligence changes, prove one full source-to-signal trace in an integration or browser test.
