# VialGrade U.S. compliance-remediation review

**Status: DRAFT RISK-REDUCTION WORK. NOT LEGALLY CLEARED.**

Owner: VialGrade. Prepared October 16, 2026. Applies to PR #22, branch `compliance/evidence-only-review-2026-10`.

This is a technical/content compliance review, **not a legal opinion**. It cannot establish universal lawfulness, and even after deployment the operator must ensure continuous factual accuracy and meet applicable federal, state and international rules. Do not describe this PR as “approved by FDA” or “completely legal.”

## Intended lower-risk product model

A public documentary registry of historic laboratory reports, compound research records, vendor statements and regulatory citations. VialGrade must not itself be a peptide seller, an unapproved-drug pharmacy, a checkout processor, a seller-referral engine, or a human-treatment service.

## Implemented, pending tests and legal review

1. /go no longer redirects to peptide sellers. Perimeter rejects the legacy /go handoff, partner conversion callbacks, and explicit new-sale cart/checkout/activation/provider-onboarding endpoints with HTTP 410. Existing customer refund/return/dispute and payment-provider reconciliation/webhook pathways remain accessible under their role or signature gates.
2. Product action controls have no vendor checkout CTA; coupons and promotion panels are disabled. Related personal recommendations and stack/blend shopping analyses are paused.
3. Public legal materials no longer state that “research use only” makes a human-use drug market exempt; they distinguish approved finished drugs, investigational molecules, and research listings.
4. Home, help, terms, privacy, SEO metadata and price/purity language no longer promise guaranteed authenticity, sterility, zero scams, or a legal route to buy.
5. Shoppable Product/Offer JSON-LD replaced with Dataset representation. Scores are qualified as evidence summaries only.
6. Fraud/ownership assertions based solely on similar codes, a redirected store, or a document attribution are softened to documented observations.
7. Integration/unit/e2e regression checks cover referral closure and outdated messaging.

**Caution:** Old commerce and affiliate helper code, historical visit/click data, published user content and product data remain in the repository/database. Closing public UI/API paths is not the same as removing all historical data or verifying third-party evidence.

## Release gates

- [ ] CI lint/typecheck/unit/integration/security/build/e2e all pass on the **exact merge SHA**.
- [ ] Inspect Vercel preview visually, mobile and desktop. Test that /go links and all checkout/commerce endpoints cannot redirect or create purchases.
- [ ] Confirm backend jobs, seller tooling, webhook handlers, and access-controlled endpoints cannot bypass the transaction hold.
- [ ] Check that all public pages, schemas, XML sitemaps, emails and search snippets avoid purchase-direction or unsupported clinical claims.
- [ ] Run an evidence-by-evidence audit of COA issuers and original reports, batch identity and custody, test methods, date, sample origin, duplicated records and supplier relationships. Assign owner and revalidation cadence.
- [ ] Review accuracy and appropriate context for **each** peptide's regulatory status, FDA warning or advisory claim, study stage, human vs animal evidence, and state requirements.
- [ ] Human review of vendor grades, enforcement findings, allegations and paid-relationship disclosures; offer corrections and a documented dispute/appeals process.
- [ ] Verify operator legal identity, actual place of business, privacy contact mailbox, response targets, applicable Florida venue clause and privacy/data-retention statements.
- [ ] Inventory retained accounts, analytics, click logs, cookies and service providers; implement verified retention and deletion controls and applicable state privacy rights.
- [ ] Obtain written review by counsel with relevant FDA/FTC drug-advertising, consumer-protection, privacy, IP and marketplace experience. Include any overseas audience and location-specific rules.
- [ ] If the business plans commissions, referrals, vendor placement, tests ordered on behalf of consumers, or sales: **do not silently re-enable** them. Obtain a new regulatory opinion and fresh design review first.
- [ ] Only after passing the release gates may the owner deliberately merge/deploy to production; **do not treat passing CI as legal certification**.

## Open legal questions for the operator and counsel

- Legal owner/entity, headquarters, registration, governing law and market jurisdictions.
- Who pays VialGrade today or might pay later? What vendor, testing-lab, data-provider, affiliate or reseller contracts exist?
- Are current verification labels and COA reports reproduced with sufficient permissions and traceable provenance?
- Are any rankings based on user reviews from platforms with redistribution terms, IP claims or defamation/correctability issues?
- Does the site target consumers researching human treatment of unapproved drugs, based on actual page copy and SEO even if no sale?
- What data were gathered by the previously active referral endpoint and how long can they be lawfully retained?

## Selected primary reference points

- FDA: [Gram Peptides warning letter (2026)](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/gram-peptides-721806-03312026) (FDA intended-use assessment may go beyond research-use label)
- FDA: [503A bulk-drug-substance rules](https://www.fda.gov/drugs/human-drug-compounding/bulk-drug-substances-used-compounding-under-section-503a-fdc-act)
- FDA: [Human drug compounding statutes](https://www.fda.gov/drugs/human-drug-compounding/fdc-act-provisions-apply-human-drug-compounding)
- FTC: [Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
- FTC: [Endorsements and testimonials guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)

**No claim in this file constitutes attorney-client advice or a government approval.**

### Second pass: preserve existing consumer rights

The initial blanket /api/v1/commerce/* block also disabled existing order refunds, returns, admin dispute handling, and payment-provider events. That was overbroad and has been replaced with an explicit list of prohibited new-sale endpoints. The authenticated remedies and finance routes retain their original authorization checks. The HTTP role audit checks both restrictions and permissions.
