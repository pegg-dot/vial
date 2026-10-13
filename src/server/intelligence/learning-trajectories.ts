import type { QueryResultRow } from "pg";
import { getDatabase } from "@/server/db/client";

/**
 * A learning trajectory is a read model over VialGrade's existing evidence
 * substrate. It does not create a second ledger. It joins:
 *
 * source snapshot -> extractor/agent run -> proposed evidence claim ->
 * human/automated review -> publication (or rejection) -> event lineage.
 *
 * That makes accepted changes and rejected proposals reusable as eval/training
 * examples without weakening provenance or publication gates.
 */

type JsonRecord = Record<string, unknown>;

type LearningState =
  | "pending"
  | "accepted"
  | "rejected-proposal";

export interface EvidenceLearningTrajectory {
  claimId: string;
  state: LearningState;
  isVerifiedDiscrepancy: boolean;
  source: {
    snapshotId: string;
    sourceId: string;
    label: string;
    location: string;
    type: string;
    capturedAt: string;
    contentHash: string;
  };
  proposal: {
    runId: string;
    workflow: string;
    extractorVersion: string;
    subjectType: string;
    subjectId: string;
    predicate: string;
    previousValue: unknown;
    proposedValue: unknown;
    modelConfidence: number;
    verificationStatus: string;
    riskLevel: string;
    rationale: string;
    createdAt: string;
  };
  toolCalls: Array<{
    id: string;
    toolName: string;
    status: string;
    durationMs: number;
    input: JsonRecord;
    output: JsonRecord;
    errorMessage: string | null;
    startedAt: string;
  }>;
  review: null | {
    decision: string;
    reasonCode: string;
    notes: string;
    reviewerRole: string;
    reviewerLabel: string;
    createdAt: string;
  };
  publication: null | {
    id: string;
    version: number;
    before: JsonRecord;
    after: JsonRecord;
    publishedBy: string;
    publishedAt: string;
    rootEventId: string | null;
  };
  lineage: Array<{
    id: string;
    eventType: string;
    entityType: string;
    entityId: string | null;
    actor: string;
    payload: JsonRecord;
    occurredAt: string;
  }>;
}

type ClaimTrajectoryRow = QueryResultRow & {
  claim_id: string;
  subject_type: string;
  subject_id: string;
  predicate: string;
  value_json: unknown;
  previous_value_json: unknown;
  source_snapshot_id: string;
  agent_run_id: string;
  extractor_version: string;
  model_confidence: string | number;
  verification_status: string;
  review_status: string;
  risk_level: string;
  rationale: string;
  claim_created_at: Date | string;
  source_id: string;
  source_label: string;
  source_location: string;
  source_type: string;
  content_hash: string;
  snapshot_created_at: Date | string;
  workflow: string;
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function iso(value: Date | string) {
  return new Date(value).toISOString();
}

async function loadClaimRow(claimId: string): Promise<ClaimTrajectoryRow | null> {
  const db = await getDatabase();
  const result = await db.query<ClaimTrajectoryRow>(
    `SELECT
       ec.id claim_id,
       ec.subject_type,
       ec.subject_id,
       ec.predicate,
       ec.value_json,
       ec.previous_value_json,
       ec.source_snapshot_id,
       ec.agent_run_id,
       ec.extractor_version,
       ec.model_confidence,
       ec.verification_status,
       ec.review_status,
       ec.risk_level,
       ec.rationale,
       ec.created_at claim_created_at,
       ss.source_id,
       ss.content_hash,
       ss.captured_at snapshot_created_at,
       s.label source_label,
       s.canonical_location source_location,
       s.source_type,
       ar.workflow
     FROM evidence_claims ec
     JOIN source_snapshots ss ON ss.id=ec.source_snapshot_id
     JOIN sources s ON s.id=ss.source_id
     JOIN agent_runs ar ON ar.id=ec.agent_run_id
     WHERE ec.id=$1`,
    [claimId],
  );
  return result.rows[0] ?? null;
}

async function loadToolCalls(runId: string) {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    id: string;
    tool_name: string;
    status: string;
    duration_ms: number;
    input_json: unknown;
    output_json: unknown;
    error_message: string | null;
    started_at: Date | string;
  }>(
    `SELECT id,tool_name,status,duration_ms,input_json,output_json,error_message,started_at
     FROM tool_calls
     WHERE run_id=$1
     ORDER BY started_at ASC,id ASC`,
    [runId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    toolName: row.tool_name,
    status: row.status,
    durationMs: Number(row.duration_ms ?? 0),
    input: parseJson<JsonRecord>(row.input_json, {}),
    output: parseJson<JsonRecord>(row.output_json, {}),
    errorMessage: row.error_message ?? null,
    startedAt: iso(row.started_at),
  }));
}

async function loadReview(claimId: string) {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    decision: string;
    reason_code: string;
    notes: string;
    reviewer_role: string;
    reviewer_label: string;
    created_at: Date | string;
  }>(
    `SELECT decision,reason_code,notes,reviewer_role,reviewer_label,created_at
     FROM review_decisions
     WHERE claim_id=$1
     ORDER BY created_at DESC
     LIMIT 1`,
    [claimId],
  );
  const row = result.rows[0];
  return row ? {
    decision: row.decision,
    reasonCode: row.reason_code,
    notes: row.notes,
    reviewerRole: row.reviewer_role,
    reviewerLabel: row.reviewer_label,
    createdAt: iso(row.created_at),
  } : null;
}

async function loadPublication(claimId: string) {
  const db = await getDatabase();
  // published_claim_ids is an array because a publication may eventually carry
  // multiple claims. JSONB containment keeps the lookup exact without a page cap
  // that could make old accepted examples appear to have no publication.
  const result = await db.query<QueryResultRow & {
    id: string;
    version: number;
    before_json: unknown;
    after_json: unknown;
    published_claim_ids: unknown;
    published_by: string;
    published_at: Date | string;
    root_event_id: string | null;
  }>(
    `SELECT id,version,before_json,after_json,published_claim_ids,published_by,published_at,root_event_id
     FROM publication_events
     WHERE published_claim_ids @> $1::jsonb
     ORDER BY published_at DESC
     LIMIT 1`,
    [JSON.stringify([claimId])],
  );
  const row = result.rows[0];
  return row ? {
    id: row.id,
    version: Number(row.version),
    before: parseJson<JsonRecord>(row.before_json, {}),
    after: parseJson<JsonRecord>(row.after_json, {}),
    publishedBy: row.published_by,
    publishedAt: iso(row.published_at),
    rootEventId: row.root_event_id ?? null,
  } : null;
}

async function loadLineage(rootEventId: string | null) {
  if (!rootEventId) return [];
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    id: string;
    event_type: string;
    entity_type: string;
    entity_id: string | null;
    actor: string;
    payload_json: unknown;
    occurred_at: Date | string;
  }>(
    `SELECT id,event_type,entity_type,entity_id,actor,payload_json,occurred_at
     FROM domain_events
     WHERE root_event_id=$1
     ORDER BY occurred_at ASC,id ASC`,
    [rootEventId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id ?? null,
    actor: row.actor,
    payload: parseJson<JsonRecord>(row.payload_json, {}),
    occurredAt: iso(row.occurred_at),
  }));
}

function stateFrom(row: ClaimTrajectoryRow, review: Awaited<ReturnType<typeof loadReview>>): LearningState {
  if (review?.decision === "reject" || row.review_status === "rejected") return "rejected-proposal";
  if (review?.decision === "approve" || row.review_status === "published") return "accepted";
  return "pending";
}

export async function getEvidenceLearningTrajectory(claimId: string): Promise<EvidenceLearningTrajectory | null> {
  const row = await loadClaimRow(claimId);
  if (!row) return null;

  const [toolCalls, review, publication] = await Promise.all([
    loadToolCalls(row.agent_run_id),
    loadReview(claimId),
    loadPublication(claimId),
  ]);
  const lineage = await loadLineage(publication?.rootEventId ?? null);
  const state = stateFrom(row, review);

  return {
    claimId: row.claim_id,
    state,
    // This means a proposed machine/source-derived change was explicitly
    // rejected by the review authority. It does NOT claim the source itself
    // was fraudulent or false; it records a verified disagreement with the
    // proposed system state.
    isVerifiedDiscrepancy: state === "rejected-proposal",
    source: {
      snapshotId: row.source_snapshot_id,
      sourceId: row.source_id,
      label: row.source_label,
      location: row.source_location,
      type: row.source_type,
      capturedAt: iso(row.snapshot_created_at),
      contentHash: row.content_hash,
    },
    proposal: {
      runId: row.agent_run_id,
      workflow: row.workflow,
      extractorVersion: row.extractor_version,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      predicate: row.predicate,
      previousValue: parseJson(row.previous_value_json, null),
      proposedValue: parseJson(row.value_json, null),
      modelConfidence: Number(row.model_confidence),
      verificationStatus: row.verification_status,
      riskLevel: row.risk_level,
      rationale: row.rationale,
      createdAt: iso(row.claim_created_at),
    },
    toolCalls,
    review,
    publication,
    lineage,
  };
}

export async function listEvidenceLearningTrajectories(input: {
  state?: LearningState;
  limit?: number;
} = {}): Promise<EvidenceLearningTrajectory[]> {
  const db = await getDatabase();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const statusClause = input.state === "accepted"
    ? "AND ec.review_status='published'"
    : input.state === "rejected-proposal"
      ? "AND ec.review_status='rejected'"
      : input.state === "pending"
        ? "AND ec.review_status='pending'"
        : "";
  const rows = await db.query<{ id: string }>(
    `SELECT ec.id
     FROM evidence_claims ec
     WHERE 1=1 ${statusClause}
     ORDER BY ec.created_at DESC
     LIMIT $1`,
    [limit],
  );

  const trajectories = await Promise.all(
    rows.rows.map((row) => getEvidenceLearningTrajectory(row.id)),
  );
  return trajectories.filter((row): row is EvidenceLearningTrajectory => Boolean(row));
}

export async function listVerifiedDiscrepancies(limit = 100) {
  return listEvidenceLearningTrajectories({
    state: "rejected-proposal",
    limit,
  });
}

export interface EvidenceLearningSummary {
  totals: {
    total: number;
    accepted: number;
    rejected: number;
    pending: number;
    rejectionRatePct: number;
  };
  byPredicate: Array<{
    predicate: string;
    total: number;
    accepted: number;
    rejected: number;
    rejectionRatePct: number;
  }>;
  byWorkflow: Array<{
    workflow: string;
    total: number;
    accepted: number;
    rejected: number;
    rejectionRatePct: number;
  }>;
}

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

/**
 * Operational learning summary. A rejection means the proposed system state
 * was rejected by the review authority; it is NOT a claim that the underlying
 * source or vendor was false.
 */
export async function getEvidenceLearningSummary(): Promise<EvidenceLearningSummary> {
  const db = await getDatabase();
  const [totalsResult, predicateResult, workflowResult] = await Promise.all([
    db.query<QueryResultRow & {
      total: string | number;
      accepted: string | number;
      rejected: string | number;
      pending: string | number;
    }>(`SELECT
          COUNT(*) total,
          COUNT(*) FILTER (WHERE review_status='published') accepted,
          COUNT(*) FILTER (WHERE review_status='rejected') rejected,
          COUNT(*) FILTER (WHERE review_status='pending') pending
        FROM evidence_claims`),
    db.query<QueryResultRow & {
      predicate: string;
      total: string | number;
      accepted: string | number;
      rejected: string | number;
    }>(`SELECT
          predicate,
          COUNT(*) total,
          COUNT(*) FILTER (WHERE review_status='published') accepted,
          COUNT(*) FILTER (WHERE review_status='rejected') rejected
        FROM evidence_claims
        GROUP BY predicate
        ORDER BY COUNT(*) DESC, predicate ASC
        LIMIT 12`),
    db.query<QueryResultRow & {
      workflow: string;
      total: string | number;
      accepted: string | number;
      rejected: string | number;
    }>(`SELECT
          ar.workflow,
          COUNT(*) total,
          COUNT(*) FILTER (WHERE ec.review_status='published') accepted,
          COUNT(*) FILTER (WHERE ec.review_status='rejected') rejected
        FROM evidence_claims ec
        JOIN agent_runs ar ON ar.id=ec.agent_run_id
        GROUP BY ar.workflow
        ORDER BY COUNT(*) DESC, ar.workflow ASC
        LIMIT 12`),
  ]);

  const totalsRow = totalsResult.rows[0];
  const total = Number(totalsRow?.total ?? 0);
  const accepted = Number(totalsRow?.accepted ?? 0);
  const rejected = Number(totalsRow?.rejected ?? 0);
  const pending = Number(totalsRow?.pending ?? 0);
  const decided = accepted + rejected;

  return {
    totals: {
      total,
      accepted,
      rejected,
      pending,
      rejectionRatePct: pct(rejected, decided),
    },
    byPredicate: predicateResult.rows.map((row) => {
      const rowTotal = Number(row.total ?? 0);
      const rowAccepted = Number(row.accepted ?? 0);
      const rowRejected = Number(row.rejected ?? 0);
      return {
        predicate: row.predicate,
        total: rowTotal,
        accepted: rowAccepted,
        rejected: rowRejected,
        rejectionRatePct: pct(rowRejected, rowAccepted + rowRejected),
      };
    }),
    byWorkflow: workflowResult.rows.map((row) => {
      const rowTotal = Number(row.total ?? 0);
      const rowAccepted = Number(row.accepted ?? 0);
      const rowRejected = Number(row.rejected ?? 0);
      return {
        workflow: row.workflow,
        total: rowTotal,
        accepted: rowAccepted,
        rejected: rowRejected,
        rejectionRatePct: pct(rowRejected, rowAccepted + rowRejected),
      };
    }),
  };
}
