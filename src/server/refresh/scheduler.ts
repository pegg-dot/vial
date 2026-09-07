import { runSourceIngestion } from "@/server/agents/pipeline";
import { getDatabase, withTransaction } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { createAlert, createChildEvent, createDomainEvent, getEventRoot, recordMetric, upsertOpportunity } from "@/server/intelligence/events";
import { getActiveFixture, claimNextRefreshJob, enqueueDueRefreshJobs, getRefreshPolicy, reclaimStalledRefreshJobs } from "./repository";
import { SafeFetchError, safeFetch } from "./safe-fetch";
import type { RefreshJob } from "./types";
import { runPooled } from "@/server/collect/pool";

interface RefreshPayload {
  body: string;
  contentType: "text/plain" | "text/html" | "application/json" | "application/ld+json";
  bytes: number;
  status: number;
  resolvedIp: string;
  etag?: string;
  lastModified?: string;
  notModified: boolean;
  metadata: Record<string, unknown>;
}

function normalizeContentType(value: string): RefreshPayload["contentType"] {
  const clean = value.split(";")[0].trim().toLowerCase();
  if (clean === "text/html" || clean === "application/json" || clean === "application/ld+json") return clean;
  return "text/plain";
}

async function startTrace(triggerEventId: string | undefined, sourceId: string, jobId: string) {
  return withTransaction(async (tx) => {
    if (triggerEventId) {
      const rootEventId = await getEventRoot(tx, triggerEventId);
      return createDomainEvent(tx, {
        eventType: "source.refresh.started",
        entityType: "source",
        entityId: sourceId,
        actor: "system:refresh",
        payload: { jobId },
        parentEventId: triggerEventId,
        rootEventId,
        relation: "triggered-refresh",
      });
    }
    return createDomainEvent(tx, {
      eventType: "source.refresh.started",
      entityType: "source",
      entityId: sourceId,
      actor: "system:refresh",
      payload: { jobId },
    });
  });
}

async function loadPayload(policyId: string): Promise<RefreshPayload> {
  const policy = await getRefreshPolicy(policyId);
  if (!policy) throw new Error("Refresh policy was not found");
  if (policy.transport === "fixture") {
    const fixture = await getActiveFixture(policy.id);
    if (!fixture) throw new Error("No active fixture is configured for this source");
    return {
      body: fixture.rawContent,
      contentType: normalizeContentType(fixture.contentType),
      bytes: Buffer.byteLength(fixture.rawContent),
      status: 200,
      resolvedIp: "fixture",
      notModified: false,
      metadata: { fixtureId: fixture.id, fixtureVersion: fixture.version, ...fixture.metadata },
    };
  }
  const result = await safeFetch(policy.sourceLocation, {
    allowedHostnames: policy.allowedHostnames,
    allowedContentTypes: policy.allowedContentTypes,
    timeoutMs: policy.timeoutMs,
    maxResponseBytes: policy.maxResponseBytes,
    etag: policy.etag,
    lastModified: policy.lastModified,
  });
  return {
    body: result.body,
    contentType: normalizeContentType(result.contentType),
    bytes: result.bytes,
    status: result.status,
    resolvedIp: result.resolvedIp,
    etag: result.etag,
    lastModified: result.lastModified,
    notModified: result.notModified,
    metadata: { finalUrl: result.url, redirects: result.redirects },
  };
}

async function processClaimedRefreshJob(job: RefreshJob) {
  const policy = await getRefreshPolicy(job.policyId);
  if (!policy) throw new Error("Refresh policy was not found");
  const trace = await startTrace(job.triggerEventId, policy.sourceId, job.id);
  const attemptId = newId("attempt");
  const attemptNumber = job.attemptCount;
  const startedAt = Date.now();
  const db = await getDatabase();
  await db.query(
    `INSERT INTO refresh_attempts
     (id, job_id, attempt_number, status, started_at)
     VALUES ($1,$2,$3,'running',NOW())`,
    [attemptId, job.id, attemptNumber],
  );
  await db.query(
    `UPDATE source_refresh_policies SET last_started_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [policy.id],
  );

  try {
    const payload = await loadPayload(policy.id);
    if (payload.notModified) {
      await withTransaction(async (tx) => {
        const event = await createChildEvent(tx, trace, {
          eventType: "source.refresh.not-modified",
          entityType: "source",
          entityId: policy.sourceId,
          actor: "system:refresh",
          payload: { jobId: job.id, status: payload.status },
          relation: "completed-without-change",
        });
        await recordMetric(tx, { rootEventId: trace.rootEventId, eventId: event.id, entityType: "source", entityId: policy.sourceId, metricKey: "refresh.durationMs", value: Date.now() - startedAt });
        await tx.query(
          `UPDATE refresh_attempts SET status='succeeded', completed_at=NOW(), duration_ms=$2, http_status=$3, bytes_received=0, resolved_ip=$4, content_type=$5 WHERE id=$1`,
          [attemptId, Date.now() - startedAt, payload.status, payload.resolvedIp, payload.contentType],
        );
        await tx.query(
          `UPDATE refresh_jobs SET status='succeeded', completed_at=NOW(), result_json=$2::jsonb WHERE id=$1`,
          [job.id, JSON.stringify({ notModified: true, rootEventId: trace.rootEventId })],
        );
        await tx.query(
          `UPDATE source_refresh_policies SET last_succeeded_at=NOW(), consecutive_failures=0, next_run_at=NOW()+($2 || ' minutes')::interval, etag=COALESCE($3,etag), last_modified=COALESCE($4,last_modified), updated_at=NOW() WHERE id=$1`,
          [policy.id, policy.intervalMinutes, payload.etag ?? null, payload.lastModified ?? null],
        );
      });
      return { status: "not-modified" as const, jobId: job.id, rootEventId: trace.rootEventId };
    }

    const result = await runSourceIngestion({
      sourceType: policy.sourceType as "vendor-page" | "lab-report" | "policy" | "regulatory" | "manual-note",
      canonicalLocation: policy.sourceLocation,
      label: policy.sourceLabel,
      targetListingSlug: policy.targetListingSlug,
      rawContent: payload.body,
      contentType: payload.contentType,
      parserProfile: policy.parserProfile,
      actor: "system:refresh",
      workflow: "controlled-source-refresh",
      captureMode: policy.transport === "fixture" ? "fixture" : "scheduled",
      snapshotMetadata: {
        refreshJobId: job.id,
        refreshAttemptId: attemptId,
        rootEventId: trace.rootEventId,
        resolvedIp: payload.resolvedIp,
        httpStatus: payload.status,
        bytes: payload.bytes,
        ...payload.metadata,
      },
    });

    await withTransaction(async (tx) => {
      const event = await createChildEvent(tx, trace, {
        eventType: "source.refresh.succeeded",
        entityType: "source",
        entityId: policy.sourceId,
        actor: "system:refresh",
        payload: {
          jobId: job.id,
          runId: result.runId,
          snapshotId: result.snapshotId,
          diffId: result.diffId,
          proposedClaims: result.proposedClaims,
          changedPredicates: result.changedPredicates,
        },
        relation: "produced-snapshot",
      });
      await recordMetric(tx, { rootEventId: trace.rootEventId, eventId: event.id, entityType: "source", entityId: policy.sourceId, metricKey: "refresh.durationMs", value: Date.now() - startedAt });
      await recordMetric(tx, { rootEventId: trace.rootEventId, eventId: event.id, entityType: "source", entityId: policy.sourceId, metricKey: "refresh.proposedClaims", value: result.proposedClaims });
      await tx.query(
        `UPDATE refresh_attempts
         SET status='succeeded', completed_at=NOW(), duration_ms=$2, http_status=$3, bytes_received=$4, resolved_ip=$5, content_type=$6, metadata=$7::jsonb
         WHERE id=$1`,
        [attemptId, Date.now() - startedAt, payload.status, payload.bytes, payload.resolvedIp, payload.contentType, JSON.stringify(payload.metadata)],
      );
      await tx.query(
        `UPDATE refresh_jobs SET status='succeeded', completed_at=NOW(), result_json=$2::jsonb WHERE id=$1`,
        [job.id, JSON.stringify({ ...result, rootEventId: trace.rootEventId, refreshEventId: event.id })],
      );
      await tx.query(
        `UPDATE source_refresh_policies
         SET last_succeeded_at=NOW(), consecutive_failures=0, next_run_at=NOW()+($2 || ' minutes')::interval,
             etag=COALESCE($3,etag), last_modified=COALESCE($4,last_modified), updated_at=NOW()
         WHERE id=$1`,
        [policy.id, policy.intervalMinutes, payload.etag ?? null, payload.lastModified ?? null],
      );
      if (policy.consecutiveFailures > 0) {
        await createAlert(tx, {
          rootEventId: trace.rootEventId,
          parentEventId: event.id,
          category: "source-recovered",
          severity: "notice",
          entityType: "source",
          entityId: policy.sourceId,
          title: "Source refresh recovered",
          message: `${policy.sourceLabel} refreshed successfully after ${policy.consecutiveFailures} prior failure${policy.consecutiveFailures === 1 ? "" : "s"}.`,
          data: { policyId: policy.id, listingSlug: policy.targetListingSlug },
        });
      }
    });
    return { status: "succeeded" as const, jobId: job.id, rootEventId: trace.rootEventId, ...result };
  } catch (error) {
    const code = error instanceof SafeFetchError ? error.code : "refresh-failed";
    const message = error instanceof Error ? error.message : String(error);
    const retry = attemptNumber < job.maxAttempts;
    const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attemptNumber - 1));
    await withTransaction(async (tx) => {
      const event = await createChildEvent(tx, trace, {
        eventType: "source.refresh.failed",
        entityType: "source",
        entityId: policy.sourceId,
        actor: "system:refresh",
        payload: { jobId: job.id, code, message, retry, attemptNumber },
        relation: "failed-refresh",
      });
      await tx.query(
        `UPDATE refresh_attempts
         SET status='failed', completed_at=NOW(), duration_ms=$2, error_code=$3, error_message=$4
         WHERE id=$1`,
        [attemptId, Date.now() - startedAt, code, message],
      );
      // Bind exactly the parameters each statement references. The failed-variant used to be
      // bound three while referencing $1 and $3 only; Postgres refuses an unreferenced parameter
      // (42P18 "could not determine data type of parameter $2"), so every job reaching its LAST
      // attempt threw here, rolled back, and stayed `running` — which is how 48 policies came to
      // sit "4× late" in production, and why the provenance tick 500'd whenever one was reclaimed.
      await tx.query(
        retry
          ? `UPDATE refresh_jobs SET status='retrying', available_at=NOW()+($2::text || ' seconds')::interval, last_error=$3 WHERE id=$1`
          : `UPDATE refresh_jobs SET status='failed', completed_at=NOW(), last_error=$2 WHERE id=$1`,
        retry ? [job.id, String(delaySeconds), message] : [job.id, message],
      );
      await tx.query(
        `UPDATE source_refresh_policies
         SET last_failed_at=NOW(), consecutive_failures=consecutive_failures+1,
             next_run_at=CASE WHEN $2 THEN NOW()+($3 || ' seconds')::interval ELSE NOW()+($4 || ' minutes')::interval END,
             updated_at=NOW()
         WHERE id=$1`,
        [policy.id, retry, delaySeconds, policy.intervalMinutes],
      );
      await upsertOpportunity(tx, {
        signalKey: `source-health:${policy.sourceId}`,
        rootEventId: trace.rootEventId,
        parentEventId: event.id,
        signalType: "source-health",
        entityType: "source",
        entityId: policy.sourceId,
        title: "Source coverage needs attention",
        summary: `${policy.sourceLabel} failed to refresh. Until it recovers, price and evidence records may become stale.`,
        score: Math.min(100, 45 + (policy.consecutiveFailures + 1) * 12),
        confidence: 0.99,
        evidence: { code, message, consecutiveFailures: policy.consecutiveFailures + 1, retry },
      });
      if (!retry) {
        await createAlert(tx, {
          rootEventId: trace.rootEventId,
          parentEventId: event.id,
          category: "source-failure",
          severity: "warning",
          entityType: "source",
          entityId: policy.sourceId,
          title: "Source refresh failed",
          message: `${policy.sourceLabel} exhausted its retry budget and requires staff review.`,
          data: { code, policyId: policy.id, listingSlug: policy.targetListingSlug },
        });
      }
    });
    return { status: retry ? "retrying" as const : "failed" as const, jobId: job.id, rootEventId: trace.rootEventId, error: message };
  }
}

export async function processRefreshJob(jobId: string) {
  const job = await claimNextRefreshJob(jobId);
  if (!job) return { status: "not-claimable" as const, jobId };
  return processClaimedRefreshJob(job);
}

export async function runRefreshSweep(limit = 10, budgetMs = 90_000, concurrency = 1) {
  // First, anything a killed function left behind — otherwise its policy is never served again.
  const reclaimed = await reclaimStalledRefreshJobs();
  const enqueued = await enqueueDueRefreshJobs();
  const results: Awaited<ReturnType<typeof processRefreshJob>>[] = [];
  // Each job is a network fetch against someone else's server, so a sweep sized only by count can
  // outlive the serverless function that invoked it — and a function killed mid-sweep leaves a job
  // claimed and unfinished. Stop on whichever limit arrives first; the next run resumes the queue.
  //
  // `concurrency` workers pull from the same queue rather than one loop draining it. That is what
  // makes a daily schedule able to serve 897 enrolled listings at all: sequentially they are a
  // quarter of an hour of fetching, which no function lifetime affords. Claiming is atomic
  // (claimNextRefreshJob leases the row), so workers never take the same job.
  // Claimed in waves, then each wave run through the pool.
  //
  // Claiming the whole limit up front would be simpler and wrong: a claim is a lease, so a function
  // killed mid-sweep would strand every job it had taken until reclaimStalledRefreshJobs times them
  // out. A wave bounds that blast radius to one wave. Claiming strictly one at a time — what this
  // did when the cron ran 96 times a day — is the other extreme, and cannot use a pool at all.
  //
  // Inside a wave the pool serialises on vendorId, so a sweep is never two connections to the same
  // storefront no matter how wide it runs. Jobs with no vendor (a listing whose product row is
  // gone) key on their own id, which excludes nothing but themselves.
  const deadline = Date.now() + budgetMs;
  const workers = Math.max(1, concurrency);
  const waveSize = Math.max(workers, workers * 5);
  let claimed = 0;
  let budgetExhausted = false;
  while (claimed < limit && Date.now() < deadline) {
    const wave: RefreshJob[] = [];
    while (wave.length < Math.min(waveSize, limit - claimed) && Date.now() < deadline) {
      const next = await claimNextRefreshJob();
      if (!next) break;
      wave.push(next);
      claimed += 1;
    }
    if (wave.length === 0) break;
    const pooled = await runPooled(wave, async (job) => {
      results.push(await processClaimedRefreshJob(job));
    }, { concurrency: workers, keyOf: (job) => job.vendorId ?? `job:${job.id}`, budgetMs: Math.max(0, deadline - Date.now()) });
    if (pooled.budgetExhausted) { budgetExhausted = true; break; }
  }
  return { reclaimed, enqueued: enqueued.length, processed: results.length, results, budgetExhausted: budgetExhausted || Date.now() >= deadline };
}
