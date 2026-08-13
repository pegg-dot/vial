// "The vendor advertises third-party testing" is a DIFFERENT fact from "we confirmed the issuer",
// and it must not be encoded by reusing the report_* columns:
//
//   - report_confirmed drives "Issuer confirmed: Yes" on the product page and a REQUIRED evidence
//     check in the live-commerce activation gate. A marketing claim must satisfy neither.
//   - report_issuer is projected into the canonical entity graph as a laboratory, so writing a
//     generic "Third-party lab" there would mint a fake lab entity and relate listings to it.
//
// So the claim gets its own column. It feeds exactly one thing: the cross-check verdict, where it
// resolves to "unbacked" (Testing unverified) — never to "verified".
export const advertisedTestingSchemaSql = String.raw`
ALTER TABLE listings ADD COLUMN IF NOT EXISTS advertises_testing BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS advertised_issuer TEXT;
`;
