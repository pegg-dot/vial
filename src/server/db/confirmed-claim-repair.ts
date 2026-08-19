// Move vendor CLAIMS out of the column that means "we confirmed it".
//
// `advertised-testing-schema.ts` states the rule this repairs: "report_confirmed drives 'Issuer
// confirmed: Yes' on the product page and a REQUIRED evidence check in the live-commerce
// activation gate. A marketing claim must satisfy neither." The `advertises_testing` /
// `advertised_issuer` columns exist precisely so a claim has somewhere else to live.
//
// That rule arrived AFTER the rows did. 144 live listings still carried report_confirmed = true
// from before the split, and the product page rendered each one as "Lab confirmed it's theirs:
// Yes". Their shape shows exactly what they are:
//
//   evidence_level = 'public-only', evidence_label = 'Vendor catalog'  (all 144)
//   report_issuer  = 'Third-party lab' — a generic placeholder, not a lab (138 of them)
//   report_date    = ''   and  batch_code = ''                          (all 144)
//
// "public-only / Vendor catalog" means the value was read off the vendor's own storefront. The
// extractor that writes it says so in its own rationale: "The source CLAIMS issuer confirmation,
// WHICH REQUIRES INDEPENDENT REVIEW." So the site was presenting a vendor's marketing claim as a
// laboratory's confirmation, 144 times, on the single page where a buyer decides to click through.
// For a product whose whole premise is that vendor claims must be checked, that is the worst
// possible thing to get wrong.
//
// The claim is preserved, not deleted — it moves to the columns built for it, where the cross-check
// resolves it to "Testing unverified" and never to "verified". Nothing is lost; it stops being
// dressed as something it is not.
//
// `report_issuer` is cleared to '' rather than NULL because the column is NOT NULL. Tested against
// a copy of the real store first, which is the only reason that was caught: as NULL this threw, and
// a migration that throws runs on the BOOT path — it would have taken production down the same way
// a missing column did once before.
//
// Deliberately NOT touched: rows with a real evidence level. The seeded demo listings name a
// specific laboratory and carry a report date and batch code, so they are genuine records of a
// confirmation, not catalogue scrapes.
export const confirmedClaimRepairSql = String.raw`
UPDATE listings
   SET advertises_testing = TRUE,
       advertised_issuer  = COALESCE(NULLIF(advertised_issuer, ''), NULLIF(report_issuer, '')),
       report_confirmed   = FALSE,
       report_issuer      = ''
 WHERE report_confirmed = TRUE
   AND evidence_level = 'public-only';
`;
