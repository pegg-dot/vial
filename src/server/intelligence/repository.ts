import type { QueryResultRow } from "pg";
import { getDatabase } from "@/server/db/client";

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export interface OpportunitySignal {
  id: string;
  signalKey: string;
  rootEventId: string;
  eventId: string;
  signalType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  entitySlug?: string;
  title: string;
  summary: string;
  score: number;
  confidence: number;
  status: "open" | "watching" | "resolved" | "dismissed";
  evidence: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
}

interface OpportunityRow extends QueryResultRow {
  id: string;
  signal_key: string;
  root_event_id: string;
  event_id: string;
  signal_type: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  entity_slug: string | null;
  title: string;
  summary: string;
  score: string | number;
  confidence: string | number;
  status: OpportunitySignal["status"];
  evidence_json: unknown;
  first_seen_at: Date | string;
  last_seen_at: Date | string;
  updated_at: Date | string;
}

function toOpportunity(row: OpportunityRow): OpportunitySignal {
  return {
    id: row.id,
    signalKey: row.signal_key,
    rootEventId: row.root_event_id,
    eventId: row.event_id,
    signalType: row.signal_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label ?? row.entity_id,
    entitySlug: row.entity_slug ?? undefined,
    title: row.title,
    summary: row.summary,
    score: Number(row.score),
    confidence: Number(row.confidence),
    status: row.status,
    evidence: parseJson<Record<string, unknown>>(row.evidence_json, {}),
    firstSeenAt: new Date(row.first_seen_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const opportunitySelect = `
  SELECT os.*,
    CASE
      WHEN os.entity_type='listing' THEN lp.name
      WHEN os.entity_type='vendor' THEN vo.display_name
      WHEN os.entity_type='compound' THEN cc.canonical_name
      WHEN os.entity_type='source' THEN ss.label
      ELSE os.entity_id
    END AS entity_label,
    CASE
      WHEN os.entity_type='listing' THEN ll.slug
      WHEN os.entity_type='vendor' THEN vo.slug
      WHEN os.entity_type='compound' THEN cc.slug
      ELSE NULL
    END AS entity_slug
  FROM opportunity_signals os
  LEFT JOIN listings ll ON os.entity_type='listing' AND ll.id=os.entity_id
  LEFT JOIN products lp ON lp.id=ll.product_id
  LEFT JOIN organizations vo ON os.entity_type='vendor' AND vo.id=os.entity_id
  LEFT JOIN compounds cc ON os.entity_type='compound' AND cc.id=os.entity_id
  LEFT JOIN sources ss ON os.entity_type='source' AND ss.id=os.entity_id`;

export async function getOpportunitySignals(input: { status?: string; limit?: number } = {}) {
  const db = await getDatabase();
  const status = input.status && input.status !== "all" ? input.status : null;
  const result = await db.query<OpportunityRow>(
    `${opportunitySelect}
     WHERE ($1::text IS NULL OR os.status=$1)
     ORDER BY CASE os.status WHEN 'open' THEN 1 WHEN 'watching' THEN 2 ELSE 3 END, os.score DESC, os.updated_at DESC
     LIMIT $2`,
    [status, input.limit ?? 100],
  );
  return result.rows.map(toOpportunity);
}

const PUBLIC_SIGNAL_WHERE = `WHERE os.status IN ('open','watching')
       AND os.signal_type IN ('price-dispersion','thin-availability','compound-evidence-gap','vendor-evidence-gap','source-coverage-gap','supply-concentration','issuer-concentration')`;

export async function getPublicSignals(limit = 12) {
  const db = await getDatabase();
  const result = await db.query<OpportunityRow>(
    `${opportunitySelect}
     ${PUBLIC_SIGNAL_WHERE}
     ORDER BY os.score DESC, os.updated_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(toOpportunity);
}

/**
 * How many public signals actually exist, independent of the page size.
 *
 * /signals rendered `getPublicSignals(18).length` under the label "active public signals". That is
 * the LIMIT, not a count: a database holding 400 open signals stated "18" with total confidence.
 * The count reuses PUBLIC_SIGNAL_WHERE so it cannot drift from what the page lists.
 */
export async function countPublicSignals() {
  const db = await getDatabase();
  const result = await db.query<{ total: string | number }>(
    `SELECT COUNT(*) total FROM opportunity_signals os ${PUBLIC_SIGNAL_WHERE}`,
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function setOpportunityStatus(input: { id: string; status: OpportunitySignal["status"]; note?: string }) {
  const db = await getDatabase();
  await db.query(
    `UPDATE opportunity_signals
     SET status=$2,
         resolved_at=CASE WHEN $2='resolved' THEN NOW() ELSE NULL END,
         resolution_note=$3,
         updated_at=NOW()
     WHERE id=$1`,
    [input.id, input.status, input.note ?? null],
  );
}

export interface TraceEvent {
  id: string;
  parentEventId?: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  actor: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface TraceRoot {
  id: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  actor: string;
  occurredAt: string;
  events: TraceEvent[];
  edges: Array<{ from: string; to: string; relation: string }>;
  alertCount: number;
  opportunityCount: number;
}

export async function getTraceRoots(limit = 30): Promise<TraceRoot[]> {
  const db = await getDatabase();
  const roots = await db.query<QueryResultRow & { id: string; event_type: string; entity_type: string; entity_id: string | null; actor: string; occurred_at: Date | string }>(
    `SELECT id, event_type, entity_type, entity_id, actor, occurred_at
     FROM domain_events
     WHERE id=root_event_id
     ORDER BY occurred_at DESC
     LIMIT $1`,
    [limit],
  );
  const output: TraceRoot[] = [];
  for (const root of roots.rows) {
    const [events, edges, counts] = await Promise.all([
      db.query<QueryResultRow & { id: string; parent_event_id: string | null; event_type: string; entity_type: string; entity_id: string | null; actor: string; payload_json: unknown; occurred_at: Date | string }>(
        `SELECT * FROM domain_events WHERE root_event_id=$1 ORDER BY occurred_at ASC, id ASC`,
        [root.id],
      ),
      db.query<QueryResultRow & { from_event_id: string; to_event_id: string; relation: string }>(
        `SELECT from_event_id, to_event_id, relation FROM trace_edges WHERE root_event_id=$1 ORDER BY created_at ASC`,
        [root.id],
      ),
      db.query<QueryResultRow & { alerts: string | number; opportunities: string | number }>(
        `SELECT
           (SELECT COUNT(*) FROM alert_events WHERE root_event_id=$1) AS alerts,
           (SELECT COUNT(*) FROM opportunity_signals WHERE root_event_id=$1) AS opportunities`,
        [root.id],
      ),
    ]);
    output.push({
      id: root.id,
      eventType: root.event_type,
      entityType: root.entity_type,
      entityId: root.entity_id ?? undefined,
      actor: root.actor,
      occurredAt: new Date(root.occurred_at).toISOString(),
      events: events.rows.map((event) => ({
        id: event.id,
        parentEventId: event.parent_event_id ?? undefined,
        eventType: event.event_type,
        entityType: event.entity_type,
        entityId: event.entity_id ?? undefined,
        actor: event.actor,
        payload: parseJson<Record<string, unknown>>(event.payload_json, {}),
        occurredAt: new Date(event.occurred_at).toISOString(),
      })),
      edges: edges.rows.map((edge) => ({ from: edge.from_event_id, to: edge.to_event_id, relation: edge.relation })),
      alertCount: Number(counts.rows[0]?.alerts ?? 0),
      opportunityCount: Number(counts.rows[0]?.opportunities ?? 0),
    });
  }
  return output;
}

export async function getAlertsForListingSlugs(slugs: string[], limit = 50) {
  if (!slugs.length) return [];
  const db = await getDatabase();
  const placeholders = slugs.map((_, index) => `$${index + 1}`).join(",");
  const result = await db.query<QueryResultRow & {
    id: string;
    category: string;
    severity: string;
    title: string;
    message: string;
    data_json: unknown;
    created_at: Date | string;
    listing_slug: string;
    product_name: string;
    vendor_name: string;
  }>(
    `SELECT ae.*, l.slug AS listing_slug, p.name AS product_name, o.display_name AS vendor_name
     FROM alert_events ae
     JOIN listings l ON ae.entity_type='listing' AND l.id=ae.entity_id
     JOIN products p ON p.id=l.product_id
     JOIN organizations o ON o.id=p.vendor_id
     WHERE l.slug IN (${placeholders})
     ORDER BY ae.created_at DESC
     LIMIT ${Math.max(1, Math.min(limit, 200))}`,
    slugs,
  );
  return result.rows.map((row) => ({
    id: row.id,
    category: row.category,
    severity: row.severity,
    title: row.title,
    message: row.message,
    data: parseJson<Record<string, unknown>>(row.data_json, {}),
    createdAt: new Date(row.created_at).toISOString(),
    listingSlug: row.listing_slug,
    productName: row.product_name,
    vendorName: row.vendor_name,
  }));
}

export async function getIntelligenceMetrics() {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    open: string | number;
    watching: string | number;
    traces: string | number;
    alerts: string | number;
    metrics: string | number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM opportunity_signals WHERE status='open') AS open,
       (SELECT COUNT(*) FROM opportunity_signals WHERE status='watching') AS watching,
       (SELECT COUNT(*) FROM domain_events WHERE id=root_event_id) AS traces,
       (SELECT COUNT(*) FROM alert_events) AS alerts,
       (SELECT COUNT(*) FROM entity_metric_snapshots) AS metrics`,
  );
  const row = result.rows[0];
  return { open: Number(row?.open ?? 0), watching: Number(row?.watching ?? 0), traces: Number(row?.traces ?? 0), alerts: Number(row?.alerts ?? 0), metrics: Number(row?.metrics ?? 0) };
}
