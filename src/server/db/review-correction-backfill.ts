import type { SqlConnection } from "./client";

/**
 * Turn every historical rejected evidence proposal into active correction memory.
 *
 * The rejected proposal is stored as previous_value because it is the value the
 * extractor proposed. The value that was authoritative when the proposal was
 * created is stored as corrected_value because rejection means "keep this".
 *
 * The runtime path writes the same record for all new rejections.
 */
export async function backfillReviewCorrections(db: SqlConnection) {
  const result = await db.query(
    `INSERT INTO correction_feedback
     (id, subject_type, subject_id, claim_id, correction_type, previous_value, corrected_value, reason, reviewer, impact, status)
     SELECT
       'correction:review:' || ec.id,
       ec.subject_type,
       ec.subject_id,
       ec.id,
       'review-rejection',
       ec.value_json,
       ec.previous_value_json,
       COALESCE(NULLIF(rd.notes, ''), 'Reviewer rejected the proposed ' || ec.predicate || '; the previously published value remains authoritative.'),
       rd.reviewer_label,
       ec.risk_level,
       'accepted'
     FROM evidence_claims ec
     JOIN LATERAL (
       SELECT decision, notes, reviewer_label
       FROM review_decisions
       WHERE claim_id = ec.id
       ORDER BY created_at DESC
       LIMIT 1
     ) rd ON TRUE
     WHERE ec.review_status = 'rejected'
       AND rd.decision = 'reject'
       AND NOT EXISTS (
         SELECT 1
         FROM correction_feedback cf
         WHERE cf.claim_id = ec.id
           AND cf.correction_type = 'review-rejection'
           AND cf.status = 'accepted'
       )`,
  );
  return result.rowCount ?? 0;
}
