import type { QueryResultRow } from "pg";
import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

export interface DomainEventInput {
  eventType: string;
  entityType: string;
  entityId?: string | null;
  actor: string;
  payload?: Record<string, unknown>;
  parentEventId?: string | null;
  rootEventId?: string | null;
  relation?: string;
}

export async function createDomainEvent(tx: SqlConnection, input: DomainEventInput) {
  const id = newId("evt");
  const rootEventId = input.rootEventId ?? id;
  await tx.query(
    `INSERT INTO domain_events
     (id, root_event_id, parent_event_id, event_type, entity_type, entity_id, actor, payload_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [id, rootEventId, input.parentEventId ?? null, input.eventType, input.entityType, input.entityId ?? null, input.actor, JSON.stringify(input.payload ?? {})],
  );
  if (input.parentEventId) {
    await linkEvents(tx, {
      rootEventId,
      fromEventId: input.parentEventId,
      toEventId: id,
      relation: input.relation ?? "caused",
    });
  }
  return { id, rootEventId };
}

export async function getEventRoot(tx: SqlConnection, eventId: string) {
  const result = await tx.query<QueryResultRow & { root_event_id: string }>(
    `SELECT root_event_id FROM domain_events WHERE id = $1`,
    [eventId],
  );
  return result.rows[0]?.root_event_id ?? eventId;
}

export async function linkEvents(tx: SqlConnection, input: { rootEventId: string; fromEventId: string; toEventId: string; relation: string }) {
  await tx.query(
    `INSERT INTO trace_edges (id, root_event_id, from_event_id, to_event_id, relation)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (from_event_id, to_event_id, relation) DO NOTHING`,
    [newId("edge"), input.rootEventId, input.fromEventId, input.toEventId, input.relation],
  );
}

export async function createChildEvent(tx: SqlConnection, parent: { id: string; rootEventId: string }, input: Omit<DomainEventInput, "parentEventId" | "rootEventId">) {
  return createDomainEvent(tx, {
    ...input,
    parentEventId: parent.id,
    rootEventId: parent.rootEventId,
  });
}

export async function recordMetric(tx: SqlConnection, input: {
  rootEventId: string;
  eventId: string;
  entityType: string;
  entityId: string;
  metricKey: string;
  value: unknown;
}) {
  await tx.query(
    `INSERT INTO entity_metric_snapshots
     (id, root_event_id, event_id, entity_type, entity_id, metric_key, value_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [newId("metric"), input.rootEventId, input.eventId, input.entityType, input.entityId, input.metricKey, JSON.stringify(input.value)],
  );
}

export async function createAlert(tx: SqlConnection, input: {
  rootEventId: string;
  parentEventId: string;
  category: string;
  severity?: "info" | "notice" | "warning" | "critical";
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actor?: string;
}) {
  const event = await createDomainEvent(tx, {
    eventType: "alert.generated",
    entityType: input.entityType,
    entityId: input.entityId,
    actor: input.actor ?? "system:watchtower",
    payload: { category: input.category, title: input.title },
    parentEventId: input.parentEventId,
    rootEventId: input.rootEventId,
    relation: "generated-alert",
  });
  const id = newId("alert");
  await tx.query(
    `INSERT INTO alert_events
     (id, root_event_id, event_id, category, severity, entity_type, entity_id, title, message, data_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [id, input.rootEventId, event.id, input.category, input.severity ?? "info", input.entityType, input.entityId, input.title, input.message, JSON.stringify(input.data ?? {})],
  );
  return { id, eventId: event.id, rootEventId: input.rootEventId };
}

export async function upsertOpportunity(tx: SqlConnection, input: {
  signalKey: string;
  rootEventId: string;
  parentEventId: string;
  signalType: string;
  entityType: string;
  entityId: string;
  title: string;
  summary: string;
  score: number;
  confidence: number;
  evidence?: Record<string, unknown>;
  actor?: string;
}) {
  const existing = await tx.query<QueryResultRow & { id: string; status: string }>(
    `SELECT id, status FROM opportunity_signals WHERE signal_key = $1`,
    [input.signalKey],
  );
  const event = await createDomainEvent(tx, {
    eventType: existing.rows[0] ? "opportunity.updated" : "opportunity.opened",
    entityType: input.entityType,
    entityId: input.entityId,
    actor: input.actor ?? "system:curator",
    payload: { signalType: input.signalType, score: input.score, signalKey: input.signalKey },
    parentEventId: input.parentEventId,
    rootEventId: input.rootEventId,
    relation: existing.rows[0] ? "updated-opportunity" : "opened-opportunity",
  });
  const id = existing.rows[0]?.id ?? newId("opp");
  const status = existing.rows[0]?.status === "dismissed" ? "dismissed" : existing.rows[0]?.status === "watching" ? "watching" : "open";
  await tx.query(
    `INSERT INTO opportunity_signals
     (id, signal_key, root_event_id, event_id, signal_type, entity_type, entity_id, title, summary, score, confidence, status, evidence_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     ON CONFLICT (signal_key) DO UPDATE
     SET root_event_id = EXCLUDED.root_event_id,
         event_id = EXCLUDED.event_id,
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         score = EXCLUDED.score,
         confidence = EXCLUDED.confidence,
         status = CASE WHEN opportunity_signals.status IN ('dismissed','watching') THEN opportunity_signals.status ELSE 'open' END,
         evidence_json = EXCLUDED.evidence_json,
         last_seen_at = NOW(),
         resolved_at = NULL,
         resolution_note = NULL,
         updated_at = NOW()`,
    [id, input.signalKey, input.rootEventId, event.id, input.signalType, input.entityType, input.entityId, input.title, input.summary, input.score, input.confidence, status, JSON.stringify(input.evidence ?? {})],
  );
  return { id, eventId: event.id, rootEventId: input.rootEventId };
}
