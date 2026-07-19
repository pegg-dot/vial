import { createHash, randomBytes } from "node:crypto";
import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection, withTransaction } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { ensureCommerceSeed } from "@/server/commerce/repository";
import { ensureInternalOpsSeed } from "@/server/internal-ops/repository";
import { connectorDefinitions, getConnectorDefinition, sandboxCatalog, type SellerConnectorProvider } from "./connectors";
import { matchSellerProduct, type SellerProductInput } from "./matching";
import { computeSellerReadiness } from "./readiness";

const onboardingSteps = ["business", "operations", "connect", "catalog", "evidence", "payments", "agreement", "review"] as const;
export type OnboardingStepKey = (typeof onboardingSteps)[number];

declare global {
  var __vialSellerOpsSeedPromise: Promise<void> | undefined;
}

function parsed<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
}

function payloadHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function resolveSellerMembership(email: string, connection?: SqlConnection) {
  const db = connection ?? (await getDatabase());
  return (
    await db.query<QueryResultRow & { seller_id: string; role: string; display_name: string; status: string }>(
      `SELECT seller_id,role,display_name,status
       FROM seller_team_members
       WHERE LOWER(email)=LOWER($1) AND status='active'`,
      [email],
    )
  ).rows[0] ?? null;
}

async function ensureProfileAndOnboarding(db: SqlConnection, sellerId: string) {
  const organization = (
    await db.query<QueryResultRow & { display_name: string; domains: unknown }>(
      `SELECT o.display_name,o.domains FROM commerce_sellers cs JOIN organizations o ON o.id=cs.organization_id WHERE cs.id=$1`,
      [sellerId],
    )
  ).rows[0];
  const domains = parsed<string[]>(organization?.domains, []);
  await db.query(
    `INSERT INTO seller_profiles(seller_id,legal_name,display_name,website_url,support_email,shipping_origin,returns_policy,fulfillment_sla_hours,onboarding_status,terms_version,terms_accepted_at)
     VALUES($1,$2,$2,$3,'support@helixtest.test',$4::jsonb,'Unopened products may be returned within 14 days in this fictional sandbox.',48,'in_progress','seller-v2',NOW())
     ON CONFLICT(seller_id) DO NOTHING`,
    [sellerId, organization?.display_name ?? "Seller", domains[0] ? `https://${domains[0]}` : "https://seller.example.test", JSON.stringify({ country: "US", region: "FL", city: "Miami" })],
  );
  let session = (
    await db.query<QueryResultRow & { id: string }>(
      `SELECT id FROM seller_onboarding_sessions WHERE seller_id=$1 AND status IN ('in_progress','submitted','changes_requested') ORDER BY started_at DESC LIMIT 1`,
      [sellerId],
    )
  ).rows[0];
  if (!session) {
    session = { id: newId("onboarding") };
    await db.query(`INSERT INTO seller_onboarding_sessions(id,seller_id,status,current_step,completion_percent) VALUES($1,$2,'in_progress','connect',45)`, [session.id, sellerId]);
  }
  for (const step of onboardingSteps) {
    const complete = ["business", "operations", "agreement"].includes(step);
    await db.query(
      `INSERT INTO seller_onboarding_steps(id,session_id,step_key,status,payload,completed_at)
       VALUES($1,$2,$3,$4,$5::jsonb,$6)
       ON CONFLICT(session_id,step_key) DO NOTHING`,
      [newId("step"), session.id, step, complete ? "complete" : step === "connect" ? "in_progress" : "not_started", JSON.stringify({ seeded: true }), complete ? new Date().toISOString() : null],
    );
  }
}

async function ensureIntegrations(db: SqlConnection, sellerId: string) {
  for (const definition of connectorDefinitions) {
    const seededReady = ["csv", "stripe_connect", "vial_mcp"].includes(definition.provider);
    await db.query(
      `INSERT INTO seller_integrations(id,seller_id,provider,display_name,status,connection_mode,scopes,capabilities,settings,last_synced_at)
       VALUES($1,$2,$3,$4,$5,'sandbox',$6::jsonb,$7::jsonb,$8::jsonb,$9)
       ON CONFLICT(seller_id,provider) DO NOTHING`,
      [
        `integration:${sellerId}:${definition.provider}`,
        sellerId,
        definition.provider,
        definition.name,
        seededReady ? "sandbox_ready" : "disconnected",
        JSON.stringify(definition.capabilities),
        JSON.stringify(definition.capabilities),
        JSON.stringify({ selfServe: true, productionRequiresExternalCredentials: definition.productionRequiresExternalCredentials }),
        seededReady ? new Date().toISOString() : null,
      ],
    );
  }
}

async function ensureSeedProducts(db: SqlConnection, sellerId: string) {
  const count = Number((await db.query<QueryResultRow & { count: string | number }>(`SELECT COUNT(*) count FROM seller_products WHERE seller_id=$1`, [sellerId])).rows[0]?.count ?? 0);
  if (count > 0) return;
  const fixtures = sandboxCatalog("csv").slice(0, 2);
  for (const fixture of fixtures) {
    const match = await matchSellerProduct(fixture, db);
    const productId = newId("seller-product");
    await db.query(
      `INSERT INTO seller_products(id,seller_id,external_id,source_provider,title,description,compound_entity_id,quantity_label,sku,price,inventory,status,match_confidence,metadata)
       VALUES($1,$2,$3,'csv',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      [productId, sellerId, fixture.externalId, fixture.title, fixture.description, match.compoundEntityId, match.quantityLabel, fixture.sku, fixture.price, fixture.inventory, match.status === "auto_matched" ? "review" : "draft", match.score, JSON.stringify({ tags: fixture.tags, seeded: true })],
    );
    await db.query(`INSERT INTO seller_inventory_events(id,seller_product_id,event_type,delta,resulting_quantity,source,idempotency_key,actor_id) VALUES($1,$2,'initial',$3,$3,'seed',$4,'system')`, [newId("inventory-event"), productId, fixture.inventory, `seed:${productId}`]);
  }
  const first = (
    await db.query<QueryResultRow & { id: string }>(`SELECT id FROM seller_products WHERE seller_id=$1 ORDER BY created_at LIMIT 1`, [sellerId])
  ).rows[0];
  if (first) {
    const batchId = newId("seller-batch");
    await db.query(`INSERT INTO seller_batches(id,seller_product_id,batch_code,status,production_date,expiration_date,quantity_available) VALUES($1,$2,'HX-BPC-2607','active','2026-07-01','2027-07-01',18)`, [batchId, first.id]);
    const docId = newId("seller-document");
    await db.query(
      `INSERT INTO seller_evidence_documents(id,seller_id,filename,file_hash,document_type,issuer,report_identifier,report_date,expires_at,status,extraction_status,extracted_fields)
       VALUES($1,$2,'HX-BPC-2607-COA.pdf',$3,'coa','Aperture Analytical (fictional)','APR-2607-104','2026-07-12','2027-01-12','review','complete',$4::jsonb)`,
      [docId, sellerId, payloadHash({ sellerId, batch: "HX-BPC-2607" }), JSON.stringify({ batchCode: "HX-BPC-2607", identity: "BPC-157", quantity: "10 mg", reportConfirmed: false })],
    );
    await db.query(`INSERT INTO seller_evidence_links(id,document_id,seller_product_id,batch_id,relationship,confidence,status,reasons) VALUES($1,$2,$3,$4,'supports',0.94,'proposed',$5::jsonb)`, [newId("evidence-link"), docId, first.id, batchId, JSON.stringify(["Batch code exact match", "Compound label matched", "Quantity label matched"])]);
  }
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(Date.UTC(2026, 6, 19 - offset)).toISOString().slice(0, 10);
    await db.query(
      `INSERT INTO seller_analytics_daily(seller_id,metric_date,listing_views,saves,comparison_adds,carts,orders,gross_revenue,refund_rate,evidence_coverage,fulfillment_on_time_rate)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(seller_id,metric_date) DO NOTHING`,
      [sellerId, date, 110 + offset * 4, 8 + (offset % 4), 5 + (offset % 3), 4 + (offset % 2), 2 + (offset % 2), 108 + offset * 6, 0.021, 0.5, 0.96],
    );
  }
}

async function seedSellerOps() {
  await ensureCommerceSeed();
  await ensureInternalOpsSeed();
  const db = await getDatabase();
  const sellers = await db.query<QueryResultRow & { id: string }>(`SELECT id FROM commerce_sellers ORDER BY id`);
  for (const seller of sellers.rows) {
    await ensureProfileAndOnboarding(db, seller.id);
    await ensureIntegrations(db, seller.id);
  }
  const demoMembership = await resolveSellerMembership("marcus@helixtest.test", db);
  if (demoMembership) {
    await ensureSeedProducts(db, demoMembership.seller_id);
    await computeSellerReadiness(demoMembership.seller_id, db);
  }
}

export async function ensureSellerOpsSeed() {
  if (!globalThis.__vialSellerOpsSeedPromise) {
    globalThis.__vialSellerOpsSeedPromise = seedSellerOps().catch((error) => {
      globalThis.__vialSellerOpsSeedPromise = undefined;
      throw error;
    });
  }
  return globalThis.__vialSellerOpsSeedPromise;
}

export async function getSellerContext(email: string) {
  await ensureSellerOpsSeed();
  const db = await getDatabase();
  const membership = await resolveSellerMembership(email, db);
  if (!membership) return null;
  const seller = (
    await db.query<QueryResultRow & { id: string; organization_id: string; display_name: string; status: string; processor_account_id: string | null }>(
      `SELECT cs.id,cs.organization_id,cs.status,cs.processor_account_id,o.display_name,o.slug FROM commerce_sellers cs JOIN organizations o ON o.id=cs.organization_id WHERE cs.id=$1`,
      [membership.seller_id],
    )
  ).rows[0];
  const [profile, onboarding, steps, integrations, products, batches, documents, evidenceLinks, team, orders, ledger, disputes, analytics, readiness] = await Promise.all([
    db.query(`SELECT * FROM seller_profiles WHERE seller_id=$1`, [membership.seller_id]),
    db.query(`SELECT * FROM seller_onboarding_sessions WHERE seller_id=$1 ORDER BY started_at DESC LIMIT 1`, [membership.seller_id]),
    db.query(`SELECT s.* FROM seller_onboarding_steps s JOIN seller_onboarding_sessions o ON o.id=s.session_id WHERE o.seller_id=$1 ORDER BY s.updated_at`, [membership.seller_id]),
    db.query(`SELECT * FROM seller_integrations WHERE seller_id=$1 ORDER BY provider`, [membership.seller_id]),
    db.query(`SELECT p.*,e.display_name compound_name FROM seller_products p LEFT JOIN canonical_entities e ON e.id=p.compound_entity_id WHERE p.seller_id=$1 ORDER BY p.updated_at DESC`, [membership.seller_id]),
    db.query(`SELECT b.*,p.title product_title FROM seller_batches b JOIN seller_products p ON p.id=b.seller_product_id WHERE p.seller_id=$1 ORDER BY b.updated_at DESC`, [membership.seller_id]),
    db.query(`SELECT * FROM seller_evidence_documents WHERE seller_id=$1 ORDER BY updated_at DESC`, [membership.seller_id]),
    db.query(`SELECT l.*,d.filename,p.title product_title,b.batch_code FROM seller_evidence_links l JOIN seller_evidence_documents d ON d.id=l.document_id LEFT JOIN seller_products p ON p.id=l.seller_product_id LEFT JOIN seller_batches b ON b.id=l.batch_id WHERE d.seller_id=$1 ORDER BY l.updated_at DESC`, [membership.seller_id]),
    db.query(`SELECT * FROM seller_team_members WHERE seller_id=$1 ORDER BY created_at`, [membership.seller_id]),
    db.query(`SELECT o.id,o.customer_email AS email,o.status,SUM(ol.line_total) AS seller_total,o.created_at FROM commerce_order_lines ol JOIN commerce_orders o ON o.id=ol.order_id WHERE ol.seller_id=$1 GROUP BY o.id,o.customer_email,o.status,o.created_at ORDER BY o.created_at DESC`, [membership.seller_id]),
    db.query(`SELECT * FROM commerce_ledger_entries WHERE seller_id=$1 ORDER BY created_at DESC`, [membership.seller_id]),
    db.query(`SELECT DISTINCT d.* FROM commerce_disputes d JOIN commerce_order_lines ol ON ol.order_id=d.order_id WHERE ol.seller_id=$1 ORDER BY d.created_at DESC`, [membership.seller_id]),
    db.query(`SELECT * FROM seller_analytics_daily WHERE seller_id=$1 ORDER BY metric_date DESC LIMIT 30`, [membership.seller_id]),
    db.query(`SELECT * FROM seller_readiness_snapshots WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 1`, [membership.seller_id]),
  ]);
  return {
    sellerId: membership.seller_id,
    role: membership.role,
    membership,
    seller,
    profile: profile.rows[0] ?? null,
    onboarding: onboarding.rows[0] ?? null,
    steps: steps.rows,
    integrations: integrations.rows,
    products: products.rows,
    catalog: products.rows,
    batches: batches.rows,
    documents: documents.rows,
    evidenceLinks: evidenceLinks.rows,
    team: team.rows,
    orders: orders.rows,
    ledger: ledger.rows,
    disputes: disputes.rows,
    analytics: analytics.rows,
    readiness: readiness.rows[0] ?? null,
  };
}

export async function updateOnboardingStep(input: { sellerId: string; step: OnboardingStepKey; payload: Record<string, unknown>; complete?: boolean }) {
  if (!onboardingSteps.includes(input.step)) throw new Error("Unsupported onboarding step");
  return withTransaction(async (db) => {
    const session = (
      await db.query<QueryResultRow & { id: string }>(`SELECT id FROM seller_onboarding_sessions WHERE seller_id=$1 AND status IN ('in_progress','changes_requested') ORDER BY started_at DESC LIMIT 1`, [input.sellerId])
    ).rows[0];
    if (!session) throw new Error("No active onboarding session");
    const validationErrors: string[] = [];
    if (input.step === "business" && !String(input.payload.legalName ?? "").trim()) validationErrors.push("Legal name is required");
    if (input.step === "operations" && !String(input.payload.supportEmail ?? "").includes("@")) validationErrors.push("A valid support email is required");
    const complete = Boolean(input.complete) && validationErrors.length === 0;
    await db.query(
      `UPDATE seller_onboarding_steps SET status=$3,payload=$4::jsonb,validation_errors=$5::jsonb,completed_at=$6,updated_at=NOW() WHERE session_id=$1 AND step_key=$2`,
      [session.id, input.step, complete ? "complete" : validationErrors.length ? "blocked" : "in_progress", JSON.stringify(input.payload), JSON.stringify(validationErrors), complete ? new Date().toISOString() : null],
    );
    if (input.step === "business") {
      await db.query(`UPDATE seller_profiles SET legal_name=COALESCE(NULLIF($2,''),legal_name),display_name=COALESCE(NULLIF($3,''),display_name),website_url=COALESCE(NULLIF($4,''),website_url),country_code=COALESCE(NULLIF($5,''),country_code),updated_at=NOW() WHERE seller_id=$1`, [input.sellerId, String(input.payload.legalName ?? ""), String(input.payload.displayName ?? ""), String(input.payload.websiteUrl ?? ""), String(input.payload.countryCode ?? "")]);
    }
    if (input.step === "operations") {
      await db.query(`UPDATE seller_profiles SET support_email=COALESCE(NULLIF($2,''),support_email),returns_policy=COALESCE(NULLIF($3,''),returns_policy),fulfillment_sla_hours=$4,shipping_origin=$5::jsonb,updated_at=NOW() WHERE seller_id=$1`, [input.sellerId, String(input.payload.supportEmail ?? ""), String(input.payload.returnsPolicy ?? ""), Number(input.payload.fulfillmentSlaHours ?? 48), JSON.stringify(input.payload.shippingOrigin ?? {})]);
    }
    if (input.step === "agreement" && complete) {
      await db.query(`UPDATE seller_profiles SET terms_version='seller-v2',terms_accepted_at=NOW(),updated_at=NOW() WHERE seller_id=$1`, [input.sellerId]);
    }
    const progress = await db.query<QueryResultRow & { total: string | number; completed: string | number }>(`SELECT COUNT(*) total,COUNT(*) FILTER(WHERE status='complete') completed FROM seller_onboarding_steps WHERE session_id=$1`, [session.id]);
    const percent = Math.round((Number(progress.rows[0]?.completed ?? 0) / Math.max(1, Number(progress.rows[0]?.total ?? 1))) * 100);
    await db.query(`UPDATE seller_onboarding_sessions SET current_step=$2,completion_percent=$3,updated_at=NOW() WHERE id=$1`, [session.id, input.step, percent]);
    const readiness = await computeSellerReadiness(input.sellerId, db);
    if (input.step === "review" && complete) {
      if (readiness.blockers.length === 0) {
        await db.query(`UPDATE seller_onboarding_sessions SET status='submitted',submitted_at=NOW(),updated_at=NOW() WHERE id=$1`, [session.id]);
        await db.query(`UPDATE seller_profiles SET onboarding_status='submitted',submitted_at=NOW(),updated_at=NOW() WHERE seller_id=$1`, [input.sellerId]);
      } else {
        validationErrors.push(...readiness.blockers);
        await db.query(`UPDATE seller_onboarding_steps SET status='blocked',validation_errors=$3::jsonb,completed_at=NULL,updated_at=NOW() WHERE session_id=$1 AND step_key=$2`, [session.id, input.step, JSON.stringify(readiness.blockers)]);
      }
    }
    return { sessionId: session.id, validationErrors, complete: complete && validationErrors.length === 0, completionPercent: percent, readiness };
  });
}

export async function connectSandboxIntegration(input: { sellerId: string; provider: SellerConnectorProvider; settings?: Record<string, unknown> }) {
  const definition = getConnectorDefinition(input.provider);
  if (!definition) throw new Error("Unsupported connector");
  const db = await getDatabase();
  await db.query(
    `INSERT INTO seller_integrations(id,seller_id,provider,display_name,status,connection_mode,scopes,capabilities,settings,last_synced_at,updated_at)
     VALUES($1,$2,$3,$4,'sandbox_ready','sandbox',$5::jsonb,$6::jsonb,$7::jsonb,NOW(),NOW())
     ON CONFLICT(seller_id,provider) DO UPDATE SET status='sandbox_ready',settings=EXCLUDED.settings,scopes=EXCLUDED.scopes,capabilities=EXCLUDED.capabilities,last_error=NULL,last_synced_at=NOW(),updated_at=NOW()`,
    [`integration:${input.sellerId}:${input.provider}`, input.sellerId, input.provider, definition.name, JSON.stringify(definition.capabilities), JSON.stringify(definition.capabilities), JSON.stringify(input.settings ?? {})],
  );
  await computeSellerReadiness(input.sellerId, db);
  return { provider: input.provider, status: "sandbox_ready" as const };
}

export async function runCatalogImport(input: { sellerId: string; provider: SellerConnectorProvider; rows?: SellerProductInput[]; actorId: string }) {
  const rows = input.rows ?? sandboxCatalog(input.provider);
  const hash = payloadHash({ provider: input.provider, rows });
  const db = await getDatabase();
  const existing = (
    await db.query<QueryResultRow & { id: string }>(`SELECT id FROM seller_import_jobs WHERE seller_id=$1 AND payload_hash=$2`, [input.sellerId, hash])
  ).rows[0];
  if (existing) { const result = await getImportJob(existing.id, input.sellerId); return result ? { ...result, idempotent: true } : null; }
  const integration = (
    await db.query<QueryResultRow & { id: string }>(`SELECT id FROM seller_integrations WHERE seller_id=$1 AND provider=$2`, [input.sellerId, input.provider])
  ).rows[0];
  const jobId = newId("import");
  await db.query(`INSERT INTO seller_import_jobs(id,seller_id,integration_id,source_type,status,payload_hash,row_count,created_by) VALUES($1,$2,$3,$4,'processing',$5,$6,$7)`, [jobId, input.sellerId, integration?.id ?? null, input.provider, hash, rows.length, input.actorId]);
  let matched = 0;
  let review = 0;
  let rejected = 0;
  for (const row of rows) {
    const match = await matchSellerProduct(row, db);
    if (match.status === "auto_matched") matched += 1;
    else if (match.status === "needs_review") review += 1;
    else rejected += 1;
    await db.query(
      `INSERT INTO seller_import_rows(id,job_id,external_id,raw_payload,normalized_payload,match_status,canonical_compound_id,match_score,match_reasons,selected,error)
       VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9::jsonb,$10,$11)`,
      [newId("import-row"), jobId, row.externalId ?? null, JSON.stringify(row), JSON.stringify({ ...row, quantityLabel: match.quantityLabel }), match.status, match.compoundEntityId, match.score, JSON.stringify(match.reasons), match.status !== "unmatched", match.status === "unmatched" ? "Manual compound selection required" : null],
    );
  }
  await db.query(`UPDATE seller_import_jobs SET status='ready_for_review',matched_count=$2,review_count=$3,rejected_count=$4,completed_at=NOW() WHERE id=$1`, [jobId, matched, review, rejected]);
  await db.query(`INSERT INTO seller_sync_runs(id,integration_id,direction,status,trigger_type,idempotency_key,summary,completed_at) VALUES($1,$2,'inbound','succeeded','manual',$3,$4::jsonb,NOW()) ON CONFLICT(idempotency_key) DO NOTHING`, [newId("sync"), integration?.id ?? `integration:${input.sellerId}:${input.provider}`, `import:${jobId}`, JSON.stringify({ jobId, rows: rows.length, matched, review, rejected })]);
  const result = await getImportJob(jobId, input.sellerId);
  return result ? { ...result, idempotent: false } : null;
}

export async function getImportJob(jobId: string, sellerId: string) {
  const db = await getDatabase();
  const job = (await db.query(`SELECT * FROM seller_import_jobs WHERE id=$1 AND seller_id=$2`, [jobId, sellerId])).rows[0];
  if (!job) return null;
  const rows = (await db.query(`SELECT r.*,e.display_name compound_name FROM seller_import_rows r LEFT JOIN canonical_entities e ON e.id=r.canonical_compound_id WHERE r.job_id=$1 ORDER BY r.created_at`, [jobId])).rows;
  return { job, rows };
}

export async function confirmImportRow(input: { sellerId: string; rowId: string; compoundEntityId: string | null; selected: boolean }) {
  const db = await getDatabase();
  const row = (
    await db.query<QueryResultRow & { id: string; job_id: string }>(`SELECT r.id,r.job_id FROM seller_import_rows r JOIN seller_import_jobs j ON j.id=r.job_id WHERE r.id=$1 AND j.seller_id=$2`, [input.rowId, input.sellerId])
  ).rows[0];
  if (!row) throw new Error("Import row not found");
  if (input.compoundEntityId) {
    const entity = (await db.query(`SELECT id FROM canonical_entities WHERE id=$1 AND entity_type='compound'`, [input.compoundEntityId])).rows[0];
    if (!entity) throw new Error("Invalid compound entity");
  }
  await db.query(`UPDATE seller_import_rows SET canonical_compound_id=$2,match_status=$3,match_score=$4,selected=$5,error=NULL WHERE id=$1`, [input.rowId, input.compoundEntityId, input.compoundEntityId ? "confirmed" : "unmatched", input.compoundEntityId ? 1 : 0, input.selected]);
  return getImportJob(row.job_id, input.sellerId);
}

export async function acceptImportJob(input: { sellerId: string; jobId: string; actorId: string }) {
  return withTransaction(async (db) => {
    const job = (await db.query<QueryResultRow & { status: string; source_type: string }>(`SELECT * FROM seller_import_jobs WHERE id=$1 AND seller_id=$2 FOR UPDATE`, [input.jobId, input.sellerId])).rows[0];
    if (!job) throw new Error("Import job not found");
    if (job.status === "imported") return { imported: 0, idempotent: true };
    const rows = await db.query<QueryResultRow & { id: string; external_id: string | null; normalized_payload: unknown; canonical_compound_id: string | null; match_score: number | null }>(`SELECT * FROM seller_import_rows WHERE job_id=$1 AND selected=TRUE AND canonical_compound_id IS NOT NULL`, [input.jobId]);
    let imported = 0;
    for (const row of rows.rows) {
      const payload = parsed<Record<string, unknown>>(row.normalized_payload, {});
      const title = String(payload.title ?? "Imported product");
      const externalId = row.external_id ?? `manual:${row.id}`;
      const productId = newId("seller-product");
      const existing = (await db.query<QueryResultRow & { id: string }>(`SELECT id FROM seller_products WHERE seller_id=$1 AND source_provider=$2 AND external_id=$3`, [input.sellerId, job.source_type, externalId])).rows[0];
      if (existing) continue;
      await db.query(
        `INSERT INTO seller_products(id,seller_id,external_id,source_provider,title,description,compound_entity_id,quantity_label,sku,price,inventory,status,match_confidence,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'review',$12,$13::jsonb)`,
        [productId, input.sellerId, externalId, job.source_type, title, String(payload.description ?? ""), row.canonical_compound_id, String(payload.quantityLabel ?? "Not declared"), String(payload.sku ?? ""), Number(payload.price ?? 0), Number(payload.inventory ?? 0), Number(row.match_score ?? 0), JSON.stringify({ importJobId: input.jobId, importedBy: input.actorId, tags: payload.tags ?? [] })],
      );
      const inventory = Number(payload.inventory ?? 0);
      await db.query(`INSERT INTO seller_inventory_events(id,seller_product_id,event_type,delta,resulting_quantity,source,idempotency_key,actor_id) VALUES($1,$2,'import',$3,$3,$4,$5,$6)`, [newId("inventory-event"), productId, inventory, job.source_type, `import:${input.jobId}:${row.id}`, input.actorId]);
      imported += 1;
    }
    await db.query(`UPDATE seller_import_jobs SET status='imported',completed_at=NOW() WHERE id=$1`, [input.jobId]);
    await computeSellerReadiness(input.sellerId, db);
    return { imported, idempotent: false };
  });
}

export async function createSellerProduct(input: { sellerId: string; title: string; description?: string; compoundEntityId?: string | null; quantityLabel: string; sku?: string; price: number; inventory: number; actorId: string }) {
  const db = await getDatabase();
  const productId = newId("seller-product");
  await db.query(
    `INSERT INTO seller_products(id,seller_id,source_provider,title,description,compound_entity_id,quantity_label,sku,price,inventory,status,match_confidence,metadata)
     VALUES($1,$2,'manual',$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11::jsonb)`,
    [productId, input.sellerId, input.title, input.description ?? "", input.compoundEntityId ?? null, input.quantityLabel, input.sku ?? null, input.price, input.inventory, input.compoundEntityId ? 1 : null, JSON.stringify({ createdBy: input.actorId })],
  );
  await db.query(`INSERT INTO seller_inventory_events(id,seller_product_id,event_type,delta,resulting_quantity,source,idempotency_key,actor_id) VALUES($1,$2,'initial',$3,$3,'manual',$4,$5)`, [newId("inventory-event"), productId, input.inventory, `manual:${productId}`, input.actorId]);
  await computeSellerReadiness(input.sellerId, db);
  return productId;
}

export async function createSellerBatch(input: { sellerId: string; productId: string; batchCode: string; quantity: number; productionDate?: string; expirationDate?: string }) {
  const db = await getDatabase();
  const product = (await db.query(`SELECT id FROM seller_products WHERE id=$1 AND seller_id=$2`, [input.productId, input.sellerId])).rows[0];
  if (!product) throw new Error("Product not found");
  const id = newId("seller-batch");
  await db.query(`INSERT INTO seller_batches(id,seller_product_id,batch_code,status,production_date,expiration_date,quantity_available) VALUES($1,$2,$3,'draft',$4,$5,$6)`, [id, input.productId, input.batchCode, input.productionDate || null, input.expirationDate || null, input.quantity]);
  return id;
}

export async function createEvidenceDocument(input: { sellerId: string; filename: string; documentType: string; issuer?: string; reportIdentifier?: string; reportDate?: string; expiresAt?: string; extractedFields?: Record<string, unknown>; sourceUrl?: string }) {
  const db = await getDatabase();
  const hash = payloadHash({ sellerId: input.sellerId, filename: input.filename, issuer: input.issuer, reportIdentifier: input.reportIdentifier, reportDate: input.reportDate, extractedFields: input.extractedFields });
  const existing = (await db.query<QueryResultRow & { id: string }>(`SELECT id FROM seller_evidence_documents WHERE seller_id=$1 AND file_hash=$2`, [input.sellerId, hash])).rows[0];
  if (existing) return existing.id;
  const id = newId("seller-document");
  await db.query(
    `INSERT INTO seller_evidence_documents(id,seller_id,filename,file_hash,document_type,issuer,report_identifier,report_date,expires_at,status,extraction_status,extracted_fields,source_url)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'uploaded','complete',$10::jsonb,$11)`,
    [id, input.sellerId, input.filename, hash, input.documentType, input.issuer ?? null, input.reportIdentifier ?? null, input.reportDate || null, input.expiresAt || null, JSON.stringify(input.extractedFields ?? {}), input.sourceUrl ?? null],
  );
  return id;
}

export async function proposeEvidenceLinks(input: { sellerId: string; documentId: string }) {
  const db = await getDatabase();
  const document = (
    await db.query<QueryResultRow & { extracted_fields: unknown; filename: string }>(`SELECT * FROM seller_evidence_documents WHERE id=$1 AND seller_id=$2`, [input.documentId, input.sellerId])
  ).rows[0];
  if (!document) throw new Error("Evidence document not found");
  const fields = parsed<Record<string, unknown>>(document.extracted_fields, {});
  const products = await db.query<QueryResultRow & { id: string; title: string; quantity_label: string; compound_name: string | null }>(`SELECT p.id,p.title,p.quantity_label,e.display_name compound_name FROM seller_products p LEFT JOIN canonical_entities e ON e.id=p.compound_entity_id WHERE p.seller_id=$1`, [input.sellerId]);
  const batchCode = String(fields.batchCode ?? "");
  const identity = String(fields.identity ?? "");
  const quantity = String(fields.quantity ?? "");
  const proposals = [];
  for (const product of products.rows) {
    let score = 0;
    const reasons: string[] = [];
    if (identity && product.compound_name && identity.toLowerCase().includes(product.compound_name.toLowerCase())) { score += 0.55; reasons.push("Compound identity matched"); }
    if (quantity && quantity.toLowerCase() === product.quantity_label.toLowerCase()) { score += 0.2; reasons.push("Quantity matched"); }
    const batch = batchCode ? (await db.query<QueryResultRow & { id: string }>(`SELECT id FROM seller_batches WHERE seller_product_id=$1 AND LOWER(batch_code)=LOWER($2)`, [product.id, batchCode])).rows[0] : null;
    if (batch) { score += 0.25; reasons.push("Batch code matched"); }
    if (score < 0.5) continue;
    const id = newId("evidence-link");
    await db.query(`INSERT INTO seller_evidence_links(id,document_id,seller_product_id,batch_id,relationship,confidence,status,reasons) VALUES($1,$2,$3,$4,'supports',$5,'proposed',$6::jsonb)`, [id, input.documentId, product.id, batch?.id ?? null, Math.min(1, score), JSON.stringify(reasons)]);
    proposals.push({ id, productId: product.id, productTitle: product.title, batchId: batch?.id ?? null, confidence: Math.min(1, score), reasons });
  }
  await computeSellerReadiness(input.sellerId, db);
  return proposals;
}

export async function confirmEvidenceLink(input: { sellerId: string; linkId: string; status: "confirmed" | "rejected" }) {
  const db = await getDatabase();
  const link = (
    await db.query<QueryResultRow & { id: string }>(`SELECT l.id FROM seller_evidence_links l JOIN seller_evidence_documents d ON d.id=l.document_id WHERE l.id=$1 AND d.seller_id=$2`, [input.linkId, input.sellerId])
  ).rows[0];
  if (!link) throw new Error("Evidence link not found");
  await db.query(`UPDATE seller_evidence_links SET status=$2,updated_at=NOW() WHERE id=$1`, [input.linkId, input.status]);
  await computeSellerReadiness(input.sellerId, db);
}

export async function adjustInventory(input: { sellerId: string; productId: string; delta: number; actorId: string; idempotencyKey?: string }) {
  return withTransaction(async (db) => {
    const product = (
      await db.query<QueryResultRow & { inventory: number }>(`SELECT inventory FROM seller_products WHERE id=$1 AND seller_id=$2 FOR UPDATE`, [input.productId, input.sellerId])
    ).rows[0];
    if (!product) throw new Error("Product not found");
    const key = input.idempotencyKey ?? `manual:${input.productId}:${newId("event")}`;
    const existing = (await db.query(`SELECT resulting_quantity FROM seller_inventory_events WHERE idempotency_key=$1`, [key])).rows[0] as { resulting_quantity?: number } | undefined;
    if (existing) return Number(existing.resulting_quantity);
    const next = Number(product.inventory) + input.delta;
    if (next < 0) throw new Error("Inventory cannot be negative");
    await db.query(`UPDATE seller_products SET inventory=$2,updated_at=NOW() WHERE id=$1`, [input.productId, next]);
    await db.query(`INSERT INTO seller_inventory_events(id,seller_product_id,event_type,delta,resulting_quantity,source,idempotency_key,actor_id) VALUES($1,$2,'adjustment',$3,$4,'manual',$5,$6)`, [newId("inventory-event"), input.productId, input.delta, next, key, input.actorId]);
    return next;
  });
}

export async function inviteSellerTeamMember(input: { sellerId: string; email: string; displayName: string; role: string }) {
  const allowedRoles = new Set(["owner", "operations", "finance", "support"]);
  if (!allowedRoles.has(input.role)) throw new Error("Invalid seller team role");
  const db = await getDatabase();
  const id = newId("member");
  await db.query(`INSERT INTO seller_team_members(id,seller_id,email,display_name,role,status) VALUES($1,$2,$3,$4,$5,'invited') ON CONFLICT(seller_id,email) DO UPDATE SET display_name=EXCLUDED.display_name,role=EXCLUDED.role,status='invited'`, [id, input.sellerId, input.email.toLowerCase(), input.displayName, input.role]);
  return id;
}

export async function createSellerApiToken(input: { sellerId: string; name: string; scopes: string[]; actorId: string }) {
  const raw = `vial_seller_${randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 16);
  const id = newId("seller-token");
  const db = await getDatabase();
  await db.query(`INSERT INTO seller_api_tokens(id,seller_id,name,token_prefix,token_hash,scopes,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`, [id, input.sellerId, input.name, prefix, tokenHash(raw), JSON.stringify(input.scopes), input.actorId]);
  return { id, token: raw, prefix, scopes: input.scopes };
}

export async function authenticateSellerApiToken(rawToken: string) {
  if (!rawToken.startsWith("vial_seller_")) return null;
  const db = await getDatabase();
  const row = (
    await db.query<QueryResultRow & { id: string; seller_id: string; scopes: unknown; revoked_at: string | null; expires_at: string | null }>(`SELECT * FROM seller_api_tokens WHERE token_hash=$1`, [tokenHash(rawToken)])
  ).rows[0];
  if (!row || row.revoked_at || (row.expires_at && new Date(row.expires_at) <= new Date())) return null;
  await db.query(`UPDATE seller_api_tokens SET last_used_at=NOW() WHERE id=$1`, [row.id]);
  return { tokenId: row.id, sellerId: row.seller_id, scopes: parsed<string[]>(row.scopes, []) };
}

export async function getSellerOnboardingDashboard(email: string) {
  return getSellerContext(email);
}


export async function revokeSellerApiToken(input: { sellerId: string; tokenId: string }) {
  const db = await getDatabase();
  const result = await db.query(`UPDATE seller_api_tokens SET revoked_at=NOW() WHERE id=$1 AND seller_id=$2 AND revoked_at IS NULL`, [input.tokenId, input.sellerId]);
  return Number(result.rowCount ?? 0) > 0;
}

export async function createSellerWebhookEndpoint(input: { sellerId: string; url: string; events: string[] }) {
  const url = new URL(input.url);
  if (url.protocol !== "https:") throw new Error("Webhook endpoints must use HTTPS");
  const rawSecret = `whsec_${randomBytes(24).toString("base64url")}`;
  const id = newId("seller-webhook");
  const db = await getDatabase();
  await db.query(`INSERT INTO seller_webhook_endpoints(id,seller_id,url,status,events,secret_prefix,secret_hash) VALUES($1,$2,$3,'active',$4::jsonb,$5,$6)`, [id, input.sellerId, url.toString(), JSON.stringify(input.events), rawSecret.slice(0, 12), tokenHash(rawSecret)]);
  return { id, secret: rawSecret, secretPrefix: rawSecret.slice(0, 12), url: url.toString(), events: input.events };
}

export async function testSellerWebhookEndpoint(input: { sellerId: string; endpointId: string }) {
  const db = await getDatabase();
  const endpoint = (await db.query<QueryResultRow & { id: string }>(`SELECT id FROM seller_webhook_endpoints WHERE id=$1 AND seller_id=$2 AND status='active'`, [input.endpointId, input.sellerId])).rows[0];
  if (!endpoint) throw new Error("Webhook endpoint not found");
  const eventId = newId("seller-event");
  await db.query(`INSERT INTO seller_webhook_deliveries(id,endpoint_id,event_type,event_id,payload,status,attempt_count,response_status,delivered_at) VALUES($1,$2,'seller.webhook.test',$3,$4::jsonb,'sandbox_delivered',1,204,NOW())`, [newId("delivery"), endpoint.id, eventId, JSON.stringify({ id: eventId, type: "seller.webhook.test", sandbox: true })]);
  await db.query(`UPDATE seller_webhook_endpoints SET last_delivery_at=NOW(),updated_at=NOW() WHERE id=$1`, [endpoint.id]);
  return { eventId, status: "sandbox_delivered" as const };
}
