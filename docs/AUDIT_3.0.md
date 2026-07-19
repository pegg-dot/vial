# VIAL 3.0 audit

## Scope

The V3 audit covers consumer preference isolation, saved searches, comparisons, follows, decision history, notification relevance, quiet hours, deterministic summaries, protected-route behavior, structural accessibility, regression safety, production compilation, and clean-archive reproducibility.

## Results

| Gate | Result |
|---|---:|
| ESLint | Passed |
| TypeScript | Passed |
| Unit tests | 20 passed |
| Integration tests | 20 passed |
| Total automated tests | 40 passed |
| V3 consumer-intelligence tests | 6 passed |
| Static security audit | Passed across 217 source files |
| V2 market-data audit | Passed |
| V3 consumer-intelligence audit | Passed |
| Backup and restore drill | Passed |
| Dependency audit | 0 known vulnerabilities |
| Production build | Passed |
| Runtime role audit | Passed |
| Structural accessibility audit | Passed |

The runtime role audit covers anonymous, customer, seller, reviewer, and administrator boundaries. The accessibility audit covers public, authenticated consumer, seller, and staff surfaces.

## Consumer intelligence findings

The deterministic fixture audit found six personalized records, two saved searches, two followed entities, and two visible relevant notifications. These values validate system behavior only and are not claims about real market coverage.

## Browser limitation

The repository retains Playwright interaction tests for CI. The handoff runtime can block Chromium from localhost under an administrator policy, so request-level role audits and structural accessibility checks are used locally when that occurs. No unsupported browser result is claimed.

## Data boundary

All metrics are produced from deterministic fictional fixtures. VIAL 3.0 does not provide medical recommendations, determine product safety, verify physical vial contents, or enable production commerce.
