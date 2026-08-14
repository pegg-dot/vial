// Whether an FDA-approved drug exists containing a given molecule — stored, never inferred.
//
// The regulatory badge on a compound page used to be derived by running a regex over the prose in
// `compounds.regulatory_status`:
//
//     approved = /FDA-approved/i.test(text) && !/Not FDA/i.test(text)
//
// GHK-Cu's copy read "Not AN FDA-approved drug…". The word "an" sits between the negation and the
// phrase, so `!/Not FDA/i` never matched, and an unapproved substance rendered the green APPROVED
// card on its own page. Wording decided a claim that someone might act on before injecting
// something. That is the precise failure this site exists to catch in other people's marketing.
//
// So the fact is stored. Each curated record in `src/server/data/compound-regulatory-status.json`
// declares `fdaApproved` explicitly, backed by its own source URLs, and the applier script writes
// it here. No sentence can move the badge any more.
//
// READ THE COLUMN NAME LITERALLY: it says an approved DRUG EXISTS, not that this product is
// approved. In every case checked, the approved drug is not what a vendor ships in a vial —
// afamelanotide is approved as SCENESSE, an implant a clinician places under the skin for a rare
// porphyria; elamipretide is approved as Forzinity for Barth syndrome. The panel therefore has no
// green "approved" state at all: `true` renders as "An approved drug exists — this is not it".
//
// NULL means not established. It renders with the same caution as `false`, because "we have not
// checked" must never look like "we checked and it is fine".
export const compoundApprovalSchemaSql = String.raw`
ALTER TABLE compounds ADD COLUMN IF NOT EXISTS fda_approved_drug_exists BOOLEAN;
`;
