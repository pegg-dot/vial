import type { QueryResultRow } from "pg";
import { getDatabase, withTransaction, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { createDomainEvent } from "@/server/intelligence/events";
import type { RefreshJob, RefreshPolicy } from "./types";

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function iso(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : undefined;
}

interface PolicyRow extends QueryResultRow {
  id: string;
  source_id: string;
  label: string;
  canonical_location: string;
  source_type: string;
  target_listing_id: string;
  listing_slug: string;
  product_name: string;
  vendor_name: string;
  transport: RefreshPolicy["transport"];
  parser_profile: RefreshPolicy["parserProfile"];
  enabled: boolean;
  interval_minutes: number;
  next_run_at: Date | string;
  last_started_at: Date | string | null;
  last_succeeded_at: Date | string | null;
  last_failed_at: Date | string | null;
  consecutive_failures: number;
  timeout_ms: number;
  max_response_bytes: number;
  allowed_content_types: unknown;
  allowed_hostnames: unknown;
  etag: string | null;
  last_modified: string | null;
  fixture_version: number | null;
  fixture_max_version: number | null;
}

function toPolicy(row: PolicyRow): RefreshPolicy {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceLabel: row.label,
    sourceLocation: row.canonical_location,
    sourceType: row.source_type,
    targetListingId: row.target_listing_id,
    targetListingSlug: row.listing_slug,
    productName: row.product_name,
    vendorName: row.vendor_name,
    transport: row.transport,
    parserProfile: row.parser_profile,
    enabled: row.enabled,
    intervalMinutes: Number(row.interval_minutes),
    nextRunAt: new Date(row.next_run_at).toISOString(),
    lastStartedAt: iso(row.last_started_at),
    lastSucceededAt: iso(row.last_succeeded_at),
    lastFailedAt: iso(row.last_failed_at),
    consecutiveFailures: Number(row.consecutive_failures),
    timeoutMs: Number(row.timeout_ms),
    maxResponseBytes: Number(row.max_response_bytes),
    allowedContentTypes: parseJson<string[]>(row.allowed_content_types, []),
    allowedHostnames: parseJson<string[]>(row.allowed_hostnames, []),
    etag: row.etag ?? undefined,
    lastModified: row.last_modified ?? undefined,
    fixtureVersion: row.fixture_version == null ? undefined : Number(row.fixture_version),
    fixtureMaxVersion: row.fixture_max_version == null ? undefined : Number(row.fixture_max_version),
  };
}

const policySelect = `
  SELECT
    rp.*,
    s.label,
    s.canonical_location,
    s.source_type,
    l.slug AS listing_slug,
    p.name AS product_name,
    o.display_name AS vendor_name,
    active_fixture.version AS fixture_version,
    fixture_max.max_version AS fixture_max_version
  FROM source_refresh_policies rp
  JOIN sources s ON s.id = rp.source_id
  JOIN listings l ON l.id = rp.target_listing_id
  JOIN products p ON p.id = l.product_id
  JOIN organizations o ON o.id = p.vendor_id
  LEFT JOIN LATERAL (
    SELECT version FROM source_fixtures WHERE policy_id = rp.id AND active = TRUE ORDER BY version DESC LIMIT 1
  ) active_fixture ON TRUE
  LEFT JOIN LATERAL (
    SELECT MAX(version) AS max_version FROM source_fixtures WHERE policy_id = rp.id
  ) fixture_max ON TRUE`;

export async function getRefreshPolicies(): Promise<RefreshPolicy[]> {
  const db = await getDatabase();
  const result = await db.query<PolicyRow>(`${policySelect} ORDER BY o.display_name, p.name`);
  return result.rows.map(toPolicy);
}

export async function getRefreshPolicy(policyId: string, tx?: SqlConnection) {
  const db = tx ?? await getDatabase();
  const result = await db.query<PolicyRow>(`${policySelect} WHERE rp.id = $1`, [policyId]);
  return result.rows[0] ? toPolicy(result.rows[0]) : null;
}

interface JobRow extends QueryResultRow {
  id: string;
  policy_id: string;
  label: string;
  listing_slug: string;
  vendor_id?: string | null;
  trigger_type: string;
  trigger_event_id: string | null;
  status: RefreshJob["status"];
  priority: number;
  available_at: Date | string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  result_json: unknown;
  created_by: string;
  created_at: Date | string;
}

function toJob(row: JobRow): RefreshJob {
  return {
    id: row.id,
    policyId: row.policy_id,
    sourceLabel: row.label,
    targetListingSlug: row.listing_slug,
    vendorId: row.vendor_id ?? undefined,
    triggerType: row.trigger_type,
    triggerEventId: row.trigger_event_id ?? undefined,
    status: row.status,
    priority: Number(row.priority),
    availableAt: new Date(row.available_at).toISOString(),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts),
    lastError: row.last_error ?? undefined,
    result: parseJson<Record<string, unknown>>(row.result_json, {}),
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getRefreshJobs(limit = 50): Promise<RefreshJob[]> {
  const db = await getDatabase();
  const result = await db.query<JobRow>(
    `SELECT rj.*, s.label, l.slug AS listing_slug
     FROM refresh_jobs rj
     JOIN source_refresh_policies rp ON rp.id = rj.policy_id
     JOIN sources s ON s.id = rp.source_id
     JOIN listings l ON l.id = rp.target_listing_id
     ORDER BY rj.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(toJob);
}

export async function getRefreshMetrics() {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    enabled: string | number;
    due: string | number;
    queued: string | number;
    failed: string | number;
    stale: string | number;
    attempts: string | number;
    worst_lateness: string | number | null;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM source_refresh_policies WHERE enabled) AS enabled,
       (SELECT COUNT(*) FROM source_refresh_policies WHERE enabled AND next_run_at <= NOW()) AS due,
       (SELECT COUNT(*) FROM refresh_jobs WHERE status IN ('queued','retrying','running')) AS queued,
       -- Sources CURRENTLY failing: enabled policies whose most recent job failed. A count of every
       -- failed job ever can only grow, and once final failures could be recorded at all (they could
       -- not, until 54da53d) it would have read "Degraded" forever.
       (SELECT COUNT(*) FROM source_refresh_policies rp
          WHERE rp.enabled
            AND (SELECT rj.status FROM refresh_jobs rj WHERE rj.policy_id = rp.id ORDER BY rj.created_at DESC, rj.id DESC LIMIT 1) = 'failed') AS failed,
       (SELECT COUNT(*) FROM source_refresh_policies WHERE last_succeeded_at IS NULL OR last_succeeded_at < NOW() - INTERVAL '24 hours') AS stale,
       (SELECT COUNT(*) FROM refresh_attempts) AS attempts,
       -- How far behind the worst policy is, measured against ITS OWN interval. A count of "due"
       -- cannot distinguish a queue that is a few minutes late from one that can never catch up,
       -- and the second is an outage with none of an outage's symptoms.
       (SELECT MAX((EXTRACT(EPOCH FROM (NOW() - next_run_at)) / 60) / GREATEST(interval_minutes, 1))
          FROM source_refresh_policies WHERE enabled AND next_run_at <= NOW()) AS worst_lateness`,
  );
  const row = result.rows[0];
  return {
    enabled: Number(row?.enabled ?? 0),
    due: Number(row?.due ?? 0),
    queued: Number(row?.queued ?? 0),
    failed: Number(row?.failed ?? 0),
    stale: Number(row?.stale ?? 0),
    attempts: Number(row?.attempts ?? 0),
    worstLateness: row?.worst_lateness === null || row?.worst_lateness === undefined ? null : Number(row.worst_lateness),
  };
}

async function insertRefreshJob(tx: SqlConnection, input: {
  policyId: string;
  triggerType: string;
  triggerEventId?: string;
  createdBy: string;
  availableAt?: Date;
  idempotencyKey?: string;
  priority?: number;
}) {
  const id = newId("job");
  const key = input.idempotencyKey ?? `${input.policyId}:${input.triggerType}:${input.triggerEventId ?? id}`;
  await tx.query(
    `INSERT INTO refresh_jobs
     (id, policy_id, trigger_type, trigger_event_id, status, priority, available_at, idempotency_key, created_by)
     VALUES ($1,$2,$3,$4,'queued',$5,$6,$7,$8)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [id, input.policyId, input.triggerType, input.triggerEventId ?? null, input.priority ?? 100, (input.availableAt ?? new Date()).toISOString(), key, input.createdBy],
  );
  const result = await tx.query<QueryResultRow & { id: string }>(`SELECT id FROM refresh_jobs WHERE idempotency_key = $1`, [key]);
  return result.rows[0]?.id ?? id;
}

export async function createRefreshJob(input: Parameters<typeof insertRefreshJob>[1]) {
  return withTransaction((tx) => insertRefreshJob(tx, input));
}

export async function enqueueDueRefreshJobs(now = new Date()) {
  return withTransaction(async (tx) => {
    const due = await tx.query<QueryResultRow & { id: string; next_run_at: Date | string }>(
      `SELECT id, next_run_at
       FROM source_refresh_policies rp
       WHERE rp.enabled = TRUE
         AND rp.next_run_at <= $1
         AND NOT EXISTS (
           SELECT 1 FROM refresh_jobs rj
           WHERE rj.policy_id = rp.id AND rj.status IN ('queued','retrying','running')
         )
       ORDER BY rp.next_run_at
       FOR UPDATE`,
      [now.toISOString()],
    );
    const ids: string[] = [];
    for (const policy of due.rows) {
      ids.push(await insertRefreshJob(tx, {
        policyId: policy.id,
        triggerType: "scheduled",
        createdBy: "scheduler",
        idempotencyKey: `${policy.id}:scheduled:${new Date(policy.next_run_at).toISOString()}`,
      }));
    }
    return ids;
  });
}

/**
 * A refresh job left `running` by a function killed at its ceiling (120 s) blocks its policy
 * forever: enqueueDueRefreshJobs skips any policy with a running job and claimNextRefreshJob never
 * claims one. In production 48 policies sat "4× late" for four days for exactly this reason. Ten
 * minutes is far past any legitimate run; the attempt counter already incremented on claim, so
 * `max_attempts` still ends the loop.
 */
export const STALLED_JOB_MINUTES = 10;

export async function reclaimStalledRefreshJobs(minutes = STALLED_JOB_MINUTES): Promise<number> {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & { id: string }>(
    `UPDATE refresh_jobs
     SET status = 'retrying', available_at = NOW(), last_error = COALESCE(last_error, 'reclaimed: ran past the function ceiling without settling')
     WHERE status = 'running' AND started_at < NOW() - ($1::text || ' minutes')::interval
     RETURNING id`,
    [String(minutes)],
  );
  return result.rows.length;
}

export async function claimNextRefreshJob(jobId?: string) {
  return withTransaction(async (tx) => {
    const result = await tx.query<QueryResultRow & { id: string }>(
      jobId
        ? `SELECT id FROM refresh_jobs WHERE id = $1 AND status IN ('queued','retrying') AND available_at <= NOW() FOR UPDATE`
        // SKIP LOCKED and the id tiebreaker both exist for concurrent claimers.
        //
        // Without SKIP LOCKED, every worker takes FOR UPDATE on the same top row and eleven of
        // twelve block until the first commits — a lock convoy that turns a pool back into a queue.
        //
        // Without the id tiebreaker, created_at orders the queue and jobs are enqueued per listing,
        // so a vendor's whole catalogue lands in one contiguous run. Twelve workers would then be
        // twelve simultaneous connections to one storefront. id is random, so ties spread across
        // vendors, and the pool's per-vendor exclusion does the rest.
        : `SELECT id FROM refresh_jobs WHERE status IN ('queued','retrying') AND available_at <= NOW() ORDER BY priority ASC, available_at ASC, id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      jobId ? [jobId] : [],
    );
    const id = result.rows[0]?.id;
    if (!id) return null;
    await tx.query(
      `UPDATE refresh_jobs
       SET status = 'running', started_at = COALESCE(started_at, NOW()), attempt_count = attempt_count + 1
       WHERE id = $1`,
      [id],
    );
    const job = await tx.query<JobRow>(
      // vendor_id rides along so the sweep can serialise per storefront. LEFT JOIN because a policy
      // may target a listing whose product row is gone; a missing vendor must cost that one job its
      // exclusion key, never the whole claim.
      `SELECT rj.*, s.label, l.slug AS listing_slug, pr.vendor_id
       FROM refresh_jobs rj
       JOIN source_refresh_policies rp ON rp.id = rj.policy_id
       JOIN sources s ON s.id = rp.source_id
       JOIN listings l ON l.id = rp.target_listing_id
       LEFT JOIN products pr ON pr.id = l.product_id
       WHERE rj.id = $1`,
      [id],
    );
    return job.rows[0] ? toJob(job.rows[0]) : null;
  });
}

export async function toggleSourcePolicy(policyId: string, enabled: boolean, actor: string) {
  return withTransaction(async (tx) => {
    const event = await createDomainEvent(tx, {
      eventType: enabled ? "source.policy.enabled" : "source.policy.disabled",
      entityType: "source-policy",
      entityId: policyId,
      actor,
      payload: { enabled },
    });
    await tx.query(
      `UPDATE source_refresh_policies
       SET enabled = $2, next_run_at = CASE WHEN $2 THEN LEAST(next_run_at, NOW()) ELSE next_run_at END, updated_at = NOW()
       WHERE id = $1`,
      [policyId, enabled],
    );
    return event;
  });
}

export async function advanceFixture(policyId: string, actor: string) {
  return withTransaction(async (tx) => {
    const current = await tx.query<QueryResultRow & { version: number }>(
      `SELECT version FROM source_fixtures WHERE policy_id = $1 AND active = TRUE ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [policyId],
    );
    const next = await tx.query<QueryResultRow & { version: number }>(
      `SELECT version FROM source_fixtures WHERE policy_id = $1 AND version > $2 ORDER BY version ASC LIMIT 1`,
      [policyId, Number(current.rows[0]?.version ?? 0)],
    );
    const nextVersion = next.rows[0]?.version;
    if (!nextVersion) throw new Error("The controlled fixture is already at its latest version");
    await tx.query(`UPDATE source_fixtures SET active = (version = $2) WHERE policy_id = $1`, [policyId, nextVersion]);
    const event = await createDomainEvent(tx, {
      eventType: "source.fixture.advanced",
      entityType: "source-policy",
      entityId: policyId,
      actor,
      payload: { fromVersion: Number(current.rows[0]?.version ?? 0), toVersion: nextVersion },
    });
    const jobId = await insertRefreshJob(tx, {
      policyId,
      triggerType: "fixture-advanced",
      triggerEventId: event.id,
      createdBy: actor,
      priority: 10,
    });
    return { eventId: event.id, rootEventId: event.rootEventId, jobId, nextVersion };
  });
}

export async function getActiveFixture(policyId: string, tx?: SqlConnection) {
  const db = tx ?? await getDatabase();
  const result = await db.query<QueryResultRow & { id: string; version: number; content_type: string; raw_content: string; metadata: unknown }>(
    `SELECT id, version, content_type, raw_content, metadata
     FROM source_fixtures
     WHERE policy_id = $1 AND active = TRUE
     ORDER BY version DESC
     LIMIT 1`,
    [policyId],
  );
  const row = result.rows[0];
  return row ? {
    id: row.id,
    version: Number(row.version),
    contentType: row.content_type,
    rawContent: row.raw_content,
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
  } : null;
}
