import { createHash } from "node:crypto";
import type { QueryResultRow } from "pg";
import { ingestionInputSchema, type ClaimCandidate, type IngestionInput } from "./schemas";
import { extractClaimCandidates } from "./extract";
import { getDatabase, withTransaction, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { computeSnapshotDiff } from "@/server/refresh/diff";

interface TargetRow extends QueryResultRow {
  id: string;
  slug: string;
  vendor_id: string;
  vendor_slug: string;
  price: string | number;
  availability: string;
  shipping_claim: string;
  batch_code: string;
  report_date: string;
  report_issuer: string;
  report_confirmed: boolean;
}

export interface PipelineResult {
  runId: string;
  sourceId: string;
  snapshotId: string;
  diffId: string;
  proposedClaims: number;
  duplicateSnapshot: boolean;
  claimIds: string[];
  changedPredicates: string[];
  parserProfile: string;
  diff: ReturnType<typeof computeSnapshotDiff>;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function canonicalLocation(value: string) {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function currentValue(target: TargetRow, predicate: ClaimCandidate["predicate"]): string | number | boolean {
  switch (predicate) {
    case "price": return Number(target.price);
    case "availability": return target.availability;
    case "shipping": return target.shipping_claim;
    case "batchCode": return target.batch_code;
    case "reportDate": return target.report_date;
    case "reportIssuer": return target.report_issuer;
    case "reportConfirmed": return target.report_confirmed;
  }
}

function sameValue(left: unknown, right: unknown) {
  if (typeof left === "number" || typeof right === "number") return Number(left) === Number(right);
  if (typeof left === "boolean" || typeof right === "boolean") return Boolean(left) === Boolean(right);
  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

async function recordTool<T>(
  db: SqlConnection,
  runId: string,
  agent: string,
  name: string,
  input: unknown,
  execute: () => Promise<T> | T,
): Promise<T> {
  const id = newId("tool");
  const startedAt = Date.now();
  try {
    const output = await execute();
    await db.query(
      `INSERT INTO tool_calls
       (id, run_id, agent_name, tool_name, status, duration_ms, input_json, output_json)
       VALUES ($1,$2,$3,$4,'completed',$5,$6::jsonb,$7::jsonb)`,
      [id, runId, agent, name, Date.now() - startedAt, JSON.stringify(input), JSON.stringify(output ?? null)],
    );
    return output;
  } catch (error) {
    await db.query(
      `INSERT INTO tool_calls
       (id, run_id, agent_name, tool_name, status, duration_ms, input_json, output_json, error_message)
       VALUES ($1,$2,$3,$4,'failed',$5,$6::jsonb,'{}'::jsonb,$7)`,
      [id, runId, agent, name, Date.now() - startedAt, JSON.stringify(input), error instanceof Error ? error.message : String(error)],
    );
    throw error;
  }
}

export async function runSourceIngestion(raw: IngestionInput): Promise<PipelineResult> {
  const input = ingestionInputSchema.parse(raw);
  const canonical = canonicalLocation(input.canonicalLocation);
  const contentHash = hash(input.rawContent);
  const idempotencyKey = hash(`${canonical}|${contentHash}|${input.targetListingSlug}|${input.parserProfile}|${input.workflow}|v2`);
  const db = await getDatabase();
  const previousRun = await db.query<QueryResultRow & { output_json: unknown }>(
    `SELECT output_json FROM agent_runs WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  if (previousRun.rows[0]) {
    return (typeof previousRun.rows[0].output_json === "string"
      ? JSON.parse(previousRun.rows[0].output_json)
      : previousRun.rows[0].output_json) as PipelineResult;
  }

  const targetResult = await db.query<TargetRow>(
    `SELECT l.*, p.vendor_id, o.slug AS vendor_slug
     FROM listings l
     JOIN products p ON p.id = l.product_id
     JOIN organizations o ON o.id = p.vendor_id
     WHERE l.slug = $1`,
    [input.targetListingSlug],
  );
  const target = targetResult.rows[0];
  if (!target) throw new Error("Target listing was not found");

  const runId = newId("run");
  const startedAt = Date.now();
  await db.query(
    `INSERT INTO agent_runs
     (id, workflow, target_type, target_id, status, started_at, tool_budget, proposed_changes, published_changes, input_json, output_json, actor, idempotency_key)
     VALUES ($1,$2,'listing',$3,'running',NOW(),14,0,0,$4::jsonb,'{}'::jsonb,$5,$6)`,
    [runId, input.workflow, target.id, JSON.stringify({ ...input, rawContent: `[${input.rawContent.length} characters]` }), input.actor, idempotencyKey],
  );

  try {
    const result = await withTransaction(async (tx) => {
      const proposedSourceId = newId("src");
      await recordTool(tx, runId, "Scout", "source.upsert", { canonical, sourceType: input.sourceType }, async () => {
        await tx.query(
          `INSERT INTO sources
           (id, source_type, canonical_location, owner_organization_id, label)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (canonical_location) DO UPDATE
           SET source_type = EXCLUDED.source_type,
               owner_organization_id = COALESCE(EXCLUDED.owner_organization_id, sources.owner_organization_id),
               label = EXCLUDED.label,
               updated_at = NOW()`,
          [proposedSourceId, input.sourceType, canonical, target.vendor_id, input.label],
        );
      });
      const sourceResult = await tx.query<QueryResultRow & { id: string }>(`SELECT id FROM sources WHERE canonical_location = $1`, [canonical]);
      const sourceId = sourceResult.rows[0]?.id;
      if (!sourceId) throw new Error("Source upsert failed");
      await tx.query(`UPDATE listings SET source_id = COALESCE(source_id, $2) WHERE id = $1`, [target.id, sourceId]);

      const previousSnapshotResult = await tx.query<QueryResultRow & { id: string; raw_content: string; content_hash: string }>(
        `SELECT id, raw_content, content_hash
         FROM source_snapshots
         WHERE source_id = $1
         ORDER BY captured_at DESC, id DESC
         LIMIT 1`,
        [sourceId],
      );
      const priorSnapshot = previousSnapshotResult.rows[0];
      const existingSnapshotResult = await tx.query<QueryResultRow & { id: string }>(
        `SELECT id FROM source_snapshots WHERE source_id = $1 AND content_hash = $2`,
        [sourceId, contentHash],
      );
      const duplicateSnapshot = Boolean(existingSnapshotResult.rows[0]);
      const snapshotId = existingSnapshotResult.rows[0]?.id ?? newId("snap");
      await recordTool(tx, runId, "Scout", "snapshot.capture", { sourceId, contentHash, captureMode: input.captureMode }, async () => {
        if (!duplicateSnapshot) {
          await tx.query(
            `INSERT INTO source_snapshots
             (id, source_id, content_hash, raw_content, content_type, fetch_status, metadata, created_by)
             VALUES ($1,$2,$3,$4,$5,'captured',$6::jsonb,$7)`,
            [snapshotId, sourceId, contentHash, input.rawContent, input.contentType, JSON.stringify({ label: input.label, parserProfile: input.parserProfile, captureMode: input.captureMode, ...input.snapshotMetadata }), input.actor],
          );
        }
        return { snapshotId, duplicateSnapshot };
      });

      const diff = computeSnapshotDiff(priorSnapshot?.id === snapshotId ? priorSnapshot.raw_content : priorSnapshot?.raw_content, input.rawContent);
      const existingDiff = await tx.query<QueryResultRow & { id: string }>(
        `SELECT id FROM source_snapshot_diffs WHERE current_snapshot_id = $1`,
        [snapshotId],
      );
      const diffId = existingDiff.rows[0]?.id ?? newId("diff");
      if (!existingDiff.rows[0]) {
        await tx.query(
          `INSERT INTO source_snapshot_diffs
           (id, source_id, previous_snapshot_id, current_snapshot_id, changed, added_lines, removed_lines, previous_hash, current_hash, summary_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [diffId, sourceId, priorSnapshot?.id ?? null, snapshotId, diff.changed, diff.addedLines, diff.removedLines, diff.previousHash ?? null, diff.currentHash, JSON.stringify(diff.summary)],
        );
      }

      const candidates = await recordTool(tx, runId, "Clerk", "claims.extract", { snapshotId, contentType: input.contentType, parserProfile: input.parserProfile }, () => extractClaimCandidates(input));
      const resolved = await recordTool(tx, runId, "Resolver", "entity.resolve", { targetListingSlug: input.targetListingSlug, candidateCount: candidates.length }, () => candidates.map((candidate) => ({ ...candidate, subjectType: "listing", subjectId: target.id })));
      const changed = await recordTool(tx, runId, "Verifier", "claims.diff", { listing: target.slug, candidateCount: resolved.length }, () => resolved
        .map((candidate) => {
          const previousValue = currentValue(target, candidate.predicate);
          let riskLevel = candidate.riskLevel;
          let confidence = candidate.confidence;
          if (candidate.predicate === "price" && Number(previousValue) > 0 && Math.abs(Number(candidate.value) - Number(previousValue)) / Number(previousValue) > 0.3) {
            riskLevel = "material" as const;
            confidence = Math.min(confidence, 0.75);
          }
          return { ...candidate, previousValue, riskLevel, confidence };
        })
        .filter((candidate) => !sameValue(candidate.previousValue, candidate.value)));

      const claimIds: string[] = [];
      await recordTool(tx, runId, "Auditor", "review.route", { proposedChanges: changed.length }, async () => {
        for (const candidate of changed) {
          const id = newId("claim");
          claimIds.push(id);
          await tx.query(
            `INSERT INTO evidence_claims
             (id, subject_type, subject_id, predicate, value_json, previous_value_json, source_snapshot_id, agent_run_id, extractor_version, model_confidence, verification_status, review_status, risk_level, rationale)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,'deterministic-v2',$9,'source-observed','pending',$10,$11)`,
            [id, candidate.subjectType, candidate.subjectId, candidate.predicate, JSON.stringify(candidate.value), JSON.stringify(candidate.previousValue), snapshotId, runId, candidate.confidence, candidate.riskLevel, candidate.rationale],
          );
        }
        return { route: changed.length ? "human-review" : "no-change", claimIds };
      });

      return {
        runId,
        sourceId,
        snapshotId,
        diffId,
        proposedClaims: changed.length,
        duplicateSnapshot,
        claimIds,
        changedPredicates: changed.map((candidate) => candidate.predicate),
        parserProfile: input.parserProfile,
        diff,
      } satisfies PipelineResult;
    });

    await db.query(
      `UPDATE agent_runs
       SET status = $2, completed_at = NOW(), duration_ms = $3, proposed_changes = $4, output_json = $5::jsonb
       WHERE id = $1`,
      [runId, result.proposedClaims > 0 ? "review" : "published", Date.now() - startedAt, result.proposedClaims, JSON.stringify(result)],
    );
    return result;
  } catch (error) {
    await db.query(
      `UPDATE agent_runs
       SET status = 'failed', completed_at = NOW(), duration_ms = $2, blocked_reason = $3
       WHERE id = $1`,
      [runId, Date.now() - startedAt, error instanceof Error ? error.message : String(error)],
    );
    throw error;
  }
}
