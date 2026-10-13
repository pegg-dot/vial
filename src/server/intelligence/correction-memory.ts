import type { QueryResultRow } from "pg";
import type { ClaimCandidate } from "@/server/agents/schemas";
import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

type Predicate = ClaimCandidate["predicate"];

interface CorrectionRuleRow extends QueryResultRow {
  correction_id: string;
  predicate: Predicate;
  rejected_value: unknown;
  kept_value: unknown;
  reason: string;
  created_at: Date | string;
}

export interface CorrectionApplication {
  candidates: ClaimCandidate[];
  suppressed: Array<{
    correctionId: string;
    predicate: Predicate;
    rejectedValue: unknown;
    keptValue: unknown;
    reason: string;
  }>;
  bypassedForFreshEvidence: Array<{
    correctionId: string;
    predicate: Predicate;
  }>;
}

function parseJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function sameValue(left: unknown, right: unknown) {
  if (typeof left === "number" || typeof right === "number") return Number(left) === Number(right);
  if (typeof left === "boolean" || typeof right === "boolean") return Boolean(left) === Boolean(right);
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

function normalizedLines(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean);
}

function addedLines(previousContent: string, currentContent: string) {
  const oldLines = normalizedLines(previousContent);
  const newLines = normalizedLines(currentContent);
  const oldCounts = new Map<string, number>();
  const added: string[] = [];
  for (const line of oldLines) oldCounts.set(line, (oldCounts.get(line) ?? 0) + 1);
  for (const line of newLines) {
    const count = oldCounts.get(line) ?? 0;
    if (count > 0) oldCounts.set(line, count - 1);
    else added.push(line);
  }
  return added;
}

function freshEvidencePattern(predicate: Predicate, value: unknown) {
  const literal = String(value ?? "").trim().toLowerCase();
  switch (predicate) {
    case "price":
      return (line: string) => /\$|\bprice\b|\bsale\b/.test(line) || (literal.length > 0 && line.includes(literal));
    case "availability":
      return (line: string) => /\bin stock\b|\blow stock\b|\bout of stock\b|\bsold out\b|\bunavailable\b/.test(line);
    case "shipping":
      return (line: string) => /\bshipping\b|\bdelivery\b|\bbusiness days?\b/.test(line) || (literal.length > 0 && line.includes(literal));
    case "batchCode":
      return (line: string) => /\bbatch\b|\blot\b/.test(line) || (literal.length > 0 && line.includes(literal));
    case "reportDate":
      return (line: string) => /\breport\b|\bcoa\b|\bcertificate\b|\banalysis\b|\btested\b/.test(line) || (literal.length > 0 && line.includes(literal));
    case "reportIssuer":
      return (line: string) => /\breport issuer\b|\blaboratory\b|\blab\b|\bissued by\b|\btested by\b/.test(line) || (literal.length > 0 && line.includes(literal));
    case "reportConfirmed":
      return (line: string) => /\bconfirmed\b|\bverified\b|\bissuing lab\b|\blaboratory\b/.test(line);
  }
}

function hasFreshEvidence(
  predicate: Predicate,
  value: unknown,
  previousContent: string | null | undefined,
  currentContent: string,
) {
  // If we cannot prove the field evidence is stale, never let memory hide a new proposal.
  if (!previousContent) return true;
  const added = addedLines(previousContent, currentContent);
  if (added.length === 0) return false;
  const relevant = freshEvidencePattern(predicate, value);
  return added.some(relevant);
}

async function loadCorrectionRules(
  tx: SqlConnection,
  input: { subjectId: string; sourceId: string },
): Promise<CorrectionRuleRow[]> {
  const result = await tx.query<CorrectionRuleRow>(
    `SELECT
       cf.id AS correction_id,
       ec.predicate,
       cf.previous_value AS rejected_value,
       cf.corrected_value AS kept_value,
       cf.reason,
       cf.created_at
     FROM correction_feedback cf
     JOIN evidence_claims ec ON ec.id = cf.claim_id
     JOIN source_snapshots ss ON ss.id = ec.source_snapshot_id
     WHERE cf.subject_type = 'listing'
       AND cf.subject_id = $1
       AND cf.status = 'accepted'
       AND cf.correction_type = 'review-rejection'
       AND ss.source_id = $2
       AND cf.created_at >= NOW() - INTERVAL '90 days'
     ORDER BY cf.created_at DESC`,
    [input.subjectId, input.sourceId],
  );
  return result.rows;
}

/**
 * Rejection feedback is active memory, not a dashboard-only log.
 *
 * A prior rejected value is suppressed only when:
 *  - it is the same listing + source + predicate,
 *  - the extractor proposes the exact rejected value again,
 *  - the authoritative listing still equals the value the reviewer kept, and
 *  - the latest source delta contains no fresh evidence for that field.
 *
 * Any fresh field evidence bypasses memory and goes back through human review.
 * That prevents a past correction from permanently hiding a legitimate future change.
 */
export async function applyCorrectionMemory(
  tx: SqlConnection,
  input: {
    subjectId: string;
    sourceId: string;
    candidates: ClaimCandidate[];
    currentValues: Partial<Record<Predicate, unknown>>;
    previousSourceContent?: string | null;
    currentSourceContent: string;
  },
): Promise<CorrectionApplication> {
  const rules = await loadCorrectionRules(tx, { subjectId: input.subjectId, sourceId: input.sourceId });
  if (rules.length === 0 || input.candidates.length === 0) {
    return { candidates: input.candidates, suppressed: [], bypassedForFreshEvidence: [] };
  }

  const candidates: ClaimCandidate[] = [];
  const suppressed: CorrectionApplication["suppressed"] = [];
  const bypassedForFreshEvidence: CorrectionApplication["bypassedForFreshEvidence"] = [];

  for (const candidate of input.candidates) {
    const currentValue = input.currentValues[candidate.predicate];
    const rule = rules.find((item) =>
      item.predicate === candidate.predicate
      && sameValue(parseJson(item.rejected_value), candidate.value)
      && sameValue(parseJson(item.kept_value), currentValue),
    );

    if (!rule) {
      candidates.push(candidate);
      continue;
    }

    if (hasFreshEvidence(candidate.predicate, candidate.value, input.previousSourceContent, input.currentSourceContent)) {
      candidates.push(candidate);
      bypassedForFreshEvidence.push({ correctionId: rule.correction_id, predicate: candidate.predicate });
      continue;
    }

    suppressed.push({
      correctionId: rule.correction_id,
      predicate: candidate.predicate,
      rejectedValue: parseJson(rule.rejected_value),
      keptValue: parseJson(rule.kept_value),
      reason: rule.reason,
    });
  }

  return { candidates, suppressed, bypassedForFreshEvidence };
}

export async function recordReviewRejectionCorrection(
  tx: SqlConnection,
  input: {
    claimId: string;
    subjectType: string;
    subjectId: string;
    rejectedValue: unknown;
    keptValue: unknown;
    reason: string;
    reviewer: string;
    impact: string;
  },
) {
  const existing = await tx.query<{ id: string }>(
    `SELECT id
     FROM correction_feedback
     WHERE claim_id = $1
       AND correction_type = 'review-rejection'
       AND status = 'accepted'
     LIMIT 1`,
    [input.claimId],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const id = newId("correction");
  await tx.query(
    `INSERT INTO correction_feedback
     (id, subject_type, subject_id, claim_id, correction_type, previous_value, corrected_value, reason, reviewer, impact, status)
     VALUES ($1,$2,$3,$4,'review-rejection',$5::jsonb,$6::jsonb,$7,$8,$9,'accepted')`,
    [
      id,
      input.subjectType,
      input.subjectId,
      input.claimId,
      JSON.stringify(input.rejectedValue),
      JSON.stringify(input.keptValue),
      input.reason,
      input.reviewer,
      input.impact,
    ],
  );
  return id;
}
