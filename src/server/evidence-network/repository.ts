import { createHash, randomBytes } from "node:crypto";
import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection, withTransaction } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { ensureSellerOpsSeed, resolveSellerMembership } from "@/server/seller/ops";
import { projectEvidenceRegistry } from "@/server/registry/repository";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getLivePassportEvidence } from "@/server/evidence-network/live-passports";

const onboardingSteps = ["identity", "quality", "scope", "methods", "team", "security", "agreement", "review"] as const;

declare global { var __vialEvidenceSeedPromise: Promise<void> | undefined; }

function json<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") { try { return JSON.parse(value) as T; } catch { return fallback; } }
  return (value as T) ?? fallback;
}
function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}
function hash(value: unknown) { return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex"); }
function tokenHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function samplingConfidence(level: string) { return ({ D0: .2, D1: .38, S1: .52, S2: .66, S3: .82, S4: .9, S5: .96 } as Record<string, number>)[level] ?? .2; }

export async function resolveLaboratoryMembership(email: string, connection?: SqlConnection) {
  const db = connection ?? await getDatabase();
  return (await db.query<QueryResultRow & { laboratory_id: string; role: string; display_name: string; status: string }>(
    `SELECT laboratory_id,role,display_name,status FROM laboratory_team_members WHERE LOWER(email)=LOWER($1) AND status='active'`, [email]
  )).rows[0] ?? null;
}

async function addCustodyEventTx(db: SqlConnection, input: { sampleId: string; eventType: string; actorType: string; actorId: string; location?: string | null; metadata?: Record<string, unknown>; occurredAt?: Date; rootEventId: string }) {
  const previous = (await db.query<QueryResultRow & { sequence_number: number; event_hash: string }>(
    `SELECT sequence_number,event_hash FROM sample_custody_events WHERE sample_id=$1 ORDER BY sequence_number DESC LIMIT 1`, [input.sampleId]
  )).rows[0];
  const sequence = Number(previous?.sequence_number ?? 0) + 1;
  const occurredAt = input.occurredAt ?? new Date();
  const payload = { sampleId: input.sampleId, sequence, eventType: input.eventType, actorType: input.actorType, actorId: input.actorId, location: input.location ?? null, occurredAt: occurredAt.toISOString(), metadata: input.metadata ?? {}, previousHash: previous?.event_hash ?? null };
  const eventHash = hash(payload);
  const id = newId("custody");
  await db.query(
    `INSERT INTO sample_custody_events(id,sample_id,sequence_number,event_type,actor_type,actor_id,location,occurred_at,metadata,previous_event_hash,event_hash,root_event_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
    [id, input.sampleId, sequence, input.eventType, input.actorType, input.actorId, input.location ?? null, occurredAt, JSON.stringify(input.metadata ?? {}), previous?.event_hash ?? null, eventHash, input.rootEventId]
  );
  return { id, sequence, eventHash };
}

export async function appendCustodyEvent(input: { sampleId: string; eventType: string; actorType: string; actorId: string; location?: string | null; metadata?: Record<string, unknown>; rootEventId?: string }) {
  return withTransaction(async db => addCustodyEventTx(db, { ...input, rootEventId: input.rootEventId ?? newId("root") }));
}

export async function verifyCustodyChain(sampleId: string, connection?: SqlConnection) {
  const db = connection ?? await getDatabase();
  const rows = (await db.query<QueryResultRow & Record<string, unknown>>(`SELECT * FROM sample_custody_events WHERE sample_id=$1 ORDER BY sequence_number`, [sampleId])).rows;
  let previous: string | null = null;
  for (const row of rows) {
    const occurredAt = row.occurred_at instanceof Date
      ? row.occurred_at.toISOString()
      : new Date(String(row.occurred_at)).toISOString();
    const payload = { sampleId, sequence: Number(row.sequence_number), eventType: String(row.event_type), actorType: String(row.actor_type), actorId: String(row.actor_id), location: row.location ?? null, occurredAt, metadata: json(row.metadata, {}), previousHash: previous };
    const expected = hash(payload);
    if (String(row.previous_event_hash ?? "") !== String(previous ?? "") || String(row.event_hash) !== expected) return { valid: false, count: rows.length, brokenAt: Number(row.sequence_number) };
    previous = expected;
  }
  return { valid: true, count: rows.length, headHash: previous };
}

async function seedEvidenceNetwork() {
  await ensureSellerOpsSeed();
  const db = await getDatabase();
  const labOrgId = "org:aperture-analytical";
  await db.query(
    `INSERT INTO organizations(id,slug,organization_type,display_name,legal_name,aliases,domains,profile_status,participation_status,location,founded,description,initials,accent)
     VALUES($1,'aperture-analytical','laboratory','Aperture Analytical','Aperture Analytical LLC (fictional)',$2::jsonb,$3::jsonb,'claimed','network','Miami, FL','2024','Fictional analytical laboratory used to demonstrate VialGrade chain-of-custody and structured-report workflows.','AA',$4::jsonb)
     ON CONFLICT(id) DO UPDATE SET organization_type='laboratory',updated_at=NOW()`,
    [labOrgId, JSON.stringify(["Aperture Analytical (fictional)"]), JSON.stringify(["aperture.test"]), JSON.stringify(["#7c3aed", "#2dd4bf"])]
  );
  const labId = "lab:aperture";
  await db.query(
    `INSERT INTO laboratory_profiles(id,organization_id,slug,display_name,legal_name,status,onboarding_status,accreditation_status,accreditation_body,accreditation_number,accreditation_expires_at,accreditation_scope,quality_system,impartiality_statement,website_url,contact_email,address,terms_version,terms_accepted_at)
     VALUES($1,$2,'aperture-analytical','Aperture Analytical','Aperture Analytical LLC (fictional)','sandbox','complete','sandbox-declared','Fictional Accreditation Board','FAB-17025-042','2027-06-30',$3::jsonb,'ISO/IEC 17025-aligned sandbox QMS','Testing decisions are separated from commercial sponsorship in this fictional demonstration.','https://aperture.test','quality@aperture.test',$4::jsonb,'lab-network-v1',NOW())
     ON CONFLICT(id) DO NOTHING`,
    [labId, labOrgId, JSON.stringify([{ technique: "LC-MS", matrix: "lyophilized peptide", status: "sandbox" }, { technique: "HPLC-UV", matrix: "lyophilized peptide", status: "sandbox" }]), JSON.stringify({ country: "US", region: "FL", city: "Miami" })]
  );
  await db.query(`INSERT INTO laboratory_team_members(id,laboratory_id,user_id,email,display_name,role,status) VALUES('lab-team:elena',$1,'user:lab:elena','elena@aperture.test','Dr. Elena Voss','laboratory_owner','active') ON CONFLICT(laboratory_id,email) DO UPDATE SET user_id=EXCLUDED.user_id`, [labId]);
  const sessionId = "lab-onboarding:aperture";
  await db.query(`INSERT INTO laboratory_onboarding_sessions(id,laboratory_id,status,current_step,completion_percent,blockers,submitted_at,reviewed_at,reviewed_by) VALUES($1,$2,'approved','review',100,'[]'::jsonb,NOW(),NOW(),'user:staff:maya') ON CONFLICT(id) DO NOTHING`, [sessionId, labId]);
  for (const step of onboardingSteps) await db.query(`INSERT INTO laboratory_onboarding_steps(id,session_id,step_key,status,payload,completed_at) VALUES($1,$2,$3,'complete',$4::jsonb,NOW()) ON CONFLICT(session_id,step_key) DO NOTHING`, [`lab-step:${step}`, sessionId, step, JSON.stringify({ sandbox: true })]);

  const methods = [
    { id: "method:aperture:lcms-id:v1", code: "LCMS-ID-01", name: "Peptide identity by LC-MS", technique: "LC-MS", dims: ["identity"], units: ["match"], lod: null, loq: null, unc: null, covered: true, refs: ["Laboratory-developed method"] },
    { id: "method:aperture:hplc-purity:v2", code: "HPLC-PUR-02", name: "Related-substance profile by HPLC-UV", technique: "HPLC-UV", dims: ["purity"], units: ["% area"], lod: .02, loq: .05, unc: .35, covered: true, refs: ["USP <621> chromatography principles"] },
    { id: "method:aperture:quantity:v1", code: "QTY-ASSAY-01", name: "Declared quantity assay", technique: "HPLC-UV", dims: ["quantity"], units: ["mg"], lod: .02, loq: .08, unc: .18, covered: true, refs: ["Laboratory-developed method"] },
    { id: "method:aperture:sterility:v1", code: "STERILITY-SBX-01", name: "Sterility test sandbox workflow", technique: "Microbiology", dims: ["sterility"], units: ["growth/no growth"], lod: null, loq: null, unc: null, covered: false, refs: ["USP <71> conceptual reference"] },
    { id: "method:aperture:endotoxin:v1", code: "BET-SBX-01", name: "Bacterial endotoxin sandbox workflow", technique: "rFC", dims: ["endotoxin"], units: ["EU/mL"], lod: .005, loq: .01, unc: .004, covered: false, refs: ["USP <85>/<86> conceptual reference"] },
  ];
  for (const method of methods) await db.query(
    `INSERT INTO laboratory_methods(id,laboratory_id,method_code,name,version,technique,analytes,matrices,dimensions,result_units,limit_of_detection,limit_of_quantitation,uncertainty,validation_status,accreditation_covered,standard_references,effective_at)
     VALUES($1,$2,$3,$4,'1.0',$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,'validated',$13,$14::jsonb,NOW()) ON CONFLICT(id) DO NOTHING`,
    [method.id, labId, method.code, method.name, method.technique, JSON.stringify(["peptide"]), JSON.stringify(["lyophilized powder"]), JSON.stringify(method.dims), JSON.stringify(method.units), method.lod, method.loq, method.unc, method.covered, JSON.stringify(method.refs)]
  );

  const sellerMembership = await resolveSellerMembership("marcus@helixtest.test", db);
  const sellerOrg = sellerMembership ? (await db.query<QueryResultRow & { organization_id: string }>(`SELECT organization_id FROM commerce_sellers WHERE id=$1`, [sellerMembership.seller_id])).rows[0] : null;
  const sellerBatch = sellerMembership ? (await db.query<QueryResultRow & { id: string; batch_code: string; seller_product_id: string }>(`SELECT sb.id,sb.batch_code,sb.seller_product_id FROM seller_batches sb JOIN seller_products sp ON sp.id=sb.seller_product_id WHERE sp.seller_id=$1 ORDER BY sb.created_at LIMIT 1`, [sellerMembership.seller_id])).rows[0] : null;
  const listing = (await db.query<QueryResultRow & { id: string; product_id: string; batch_code: string; slug: string }>(`SELECT id,product_id,batch_code,slug FROM listings WHERE batch_code='HX-BPC-2607' OR slug LIKE '%bpc%' ORDER BY featured DESC LIMIT 1`)).rows[0];
  const batchCode = sellerBatch?.batch_code ?? listing?.batch_code ?? "HX-BPC-2607";
  const programId = "program:blind-hx-bpc-2607";
  const root = "root:evidence:hx-bpc-2607";
  await db.query(`INSERT INTO testing_programs(id,slug,name,sponsor_type,sponsor_id,sampling_model,status,subject_type,subject_id,target_sample_count,collected_sample_count,funding_target,funding_collected,requirements,public_summary,created_by,root_event_id) VALUES($1,'blind-hx-bpc-2607','Blind HX-BPC-2607 batch check','platform','vial','blind_purchase','active','batch',$2,2,2,900,900,$3::jsonb,'Two separately obtained fictional samples were tested to demonstrate representative-sampling and conflict handling.','system',$4) ON CONFLICT(id) DO NOTHING`, [programId, sellerBatch?.id ?? listing?.id ?? "batch:hx-bpc-2607", JSON.stringify({ dimensions: ["identity", "purity", "quantity"], blind: true }), root]);

  const sampleSpecs = [
    { suffix: "A", model: "vendor_selected", order: "LAB-2607-104", sample: "SMP-2607-104", quantity: 9.64, purity: 98.72, report: "APR-2607-104", level: "S1" },
    { suffix: "B", model: "blind_purchase", order: "LAB-2607-121", sample: "SMP-2607-121", quantity: 8.91, purity: 97.91, report: "APR-2607-121", level: "S3" },
  ];
  let latestReportId = "";
  for (const spec of sampleSpecs) {
    const orderId = `lab-order:${spec.suffix}`;
    await db.query(`INSERT INTO laboratory_test_orders(id,order_number,program_id,laboratory_id,requester_type,requester_id,subject_type,subject_id,declared_batch_code,status,priority,requested_dimensions,method_assignments,quoted_amount,due_at,accepted_at,completed_at,root_event_id) VALUES($1,$2,$3,$4,'platform','vial','batch',$5,$6,'completed','standard',$7::jsonb,$8::jsonb,450,NOW(),NOW(),NOW(),$9) ON CONFLICT(id) DO NOTHING`, [orderId, spec.order, programId, labId, sellerBatch?.id ?? listing?.id ?? "batch:hx-bpc-2607", batchCode, JSON.stringify(["identity", "purity", "quantity"]), JSON.stringify(["method:aperture:lcms-id:v1", "method:aperture:hplc-purity:v2", "method:aperture:quantity:v1"]), root]);
    const kitId = `kit:${spec.suffix}`;
    await db.query(`INSERT INTO sample_kits(id,test_order_id,kit_code,status,tamper_seal_ids,instructions_version,issued_at,returned_at) VALUES($1,$2,$3,'returned',$4::jsonb,'custody-v1',NOW(),NOW()) ON CONFLICT(id) DO NOTHING`, [kitId, orderId, `KIT-2607-${spec.suffix}`, JSON.stringify([`SEAL-${spec.suffix}-01`])]);
    const sampleId = `sample:${spec.suffix}`;
    await db.query(`INSERT INTO laboratory_samples(id,test_order_id,kit_id,sample_code,blind_code,source_type,source_entity_id,declared_batch_code,sampling_model,sample_condition,seal_status,storage_condition,quantity_received,quantity_unit,accession_status,accessioned_by,received_at,root_event_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'acceptable','intact','ambient documented',1,'vial','accessioned','user:lab:elena',NOW(),$10) ON CONFLICT(id) DO NOTHING`, [sampleId, orderId, kitId, spec.sample, `BLIND-${spec.suffix}-2607`, spec.model, sellerBatch?.id ?? listing?.id ?? null, batchCode, spec.model, root]);
    const existing = Number((await db.query<QueryResultRow & { count: string | number }>(`SELECT COUNT(*) count FROM sample_custody_events WHERE sample_id=$1`, [sampleId])).rows[0]?.count ?? 0);
    if (!existing) {
      await addCustodyEventTx(db, { sampleId, eventType: "sample_registered", actorType: "platform", actorId: "vial", location: "VialGrade sampling desk", metadata: { samplingModel: spec.model }, rootEventId: root, occurredAt: new Date("2026-07-12T14:00:00Z") });
      await addCustodyEventTx(db, { sampleId, eventType: "seal_applied", actorType: "sampler", actorId: spec.model === "blind_purchase" ? "sampler:independent" : "seller:helixtest", location: "Collection point", metadata: { seal: `SEAL-${spec.suffix}-01` }, rootEventId: root, occurredAt: new Date("2026-07-12T14:15:00Z") });
      await addCustodyEventTx(db, { sampleId, eventType: "received", actorType: "laboratory", actorId: labId, location: "Aperture receiving", metadata: { condition: "acceptable", seal: "intact" }, rootEventId: root, occurredAt: new Date("2026-07-13T16:30:00Z") });
      await addCustodyEventTx(db, { sampleId, eventType: "accessioned", actorType: "user", actorId: "user:lab:elena", location: "Controlled accessioning", metadata: { blindCode: `BLIND-${spec.suffix}-2607` }, rootEventId: root, occurredAt: new Date("2026-07-13T17:00:00Z") });
    }
    const runSpecs = [
      { key: "id", method: "method:aperture:lcms-id:v1", dim: "identity", type: "categorical", text: "BPC-157 identity consistent", num: null, unit: null, conclusion: "established" },
      { key: "pur", method: "method:aperture:hplc-purity:v2", dim: "purity", type: "numeric", text: null, num: spec.purity, unit: "% area", conclusion: "established" },
      { key: "qty", method: "method:aperture:quantity:v1", dim: "quantity", type: "numeric", text: null, num: spec.quantity, unit: "mg", conclusion: spec.quantity < 9 ? "out_of_specification" : "established" },
    ];
    const resultIds: string[] = []; const methodIds: string[] = [];
    for (const runSpec of runSpecs) {
      const runId = `run:${spec.suffix}:${runSpec.key}`; const resultId = `result:${spec.suffix}:${runSpec.key}`;
      methodIds.push(runSpec.method); resultIds.push(resultId);
      await db.query(`INSERT INTO analytical_runs(id,run_code,test_order_id,sample_id,method_id,status,instrument_name,instrument_identifier,analyst_user_id,reviewer_user_id,raw_data_hash,system_suitability,started_at,completed_at,reviewed_at) VALUES($1,$2,$3,$4,$5,'reviewed',$6,$7,'user:lab:elena','user:lab:elena',$8,$9::jsonb,NOW(),NOW(),NOW()) ON CONFLICT(id) DO NOTHING`, [runId, `RUN-${spec.suffix}-${runSpec.key.toUpperCase()}`, orderId, sampleId, runSpec.method, runSpec.dim === "identity" ? "LC-MS QTOF" : "HPLC-UV", `INST-${runSpec.key.toUpperCase()}-01`, hash({ sampleId, runSpec }), JSON.stringify({ passed: true, sandbox: true })]);
      await db.query(`INSERT INTO analytical_results(id,run_id,dimension,analyte,result_type,value_numeric,value_text,unit,qualifier,specification,conclusion,uncertainty,limit_of_detection,limit_of_quantitation,review_status,reviewed_by,reviewed_at,metadata) VALUES($1,$2,$3,'BPC-157',$4,$5,$6,$7,'reported',$8::jsonb,$9,$10,$11,$12,'approved','user:lab:elena',NOW(),$13::jsonb) ON CONFLICT(id) DO NOTHING`, [resultId, runId, runSpec.dim, runSpec.type, runSpec.num, runSpec.text, runSpec.unit, JSON.stringify(runSpec.dim === "quantity" ? { target: 10, tolerancePercent: 10 } : {}), runSpec.conclusion, runSpec.dim === "purity" ? .35 : runSpec.dim === "quantity" ? .18 : null, runSpec.dim === "purity" ? .02 : null, runSpec.dim === "purity" ? .05 : null, JSON.stringify({ fictional: true })]);
    }
    const reportId = `lab-report:${spec.suffix}`; latestReportId = reportId;
    const reportPayload = { report: spec.report, sample: spec.sample, results: resultIds, methods: methodIds, status: "issued" };
    await db.query(`INSERT INTO laboratory_reports(id,laboratory_id,test_order_id,sample_id,report_number,version,status,public_summary,result_ids,method_ids,signed_payload_hash,document_hash,issued_by,reviewed_by,issued_at) VALUES($1,$2,$3,$4,$5,1,'issued',$6,$7::jsonb,$8::jsonb,$9,$10,'user:lab:elena','user:lab:elena',NOW()) ON CONFLICT(id) DO NOTHING`, [reportId, labId, orderId, sampleId, spec.report, `Fictional structured report for sample ${spec.sample}.`, JSON.stringify(resultIds), JSON.stringify(methodIds), hash(reportPayload), hash({ ...reportPayload, rendered: true })]);
    await db.query(`INSERT INTO laboratory_report_events(id,report_id,event_type,actor_type,actor_id,reason,after_json,root_event_id) VALUES($1,$2,'issued','user','user:lab:elena','Initial issue',$3::jsonb,$4) ON CONFLICT(id) DO NOTHING`, [`report-event:${spec.suffix}:issued`, reportId, JSON.stringify(reportPayload), root]);
  }
  const passportId = "passport:hx-bpc-2607";
  await db.query(`INSERT INTO batch_passports(id,slug,subject_type,subject_id,vendor_id,product_id,listing_id,seller_batch_id,declared_batch_code,status,sampling_level,evidence_confidence,current_report_id,dimensions,limitations,last_evidence_at,published_at) VALUES($1,'hx-bpc-2607','batch',$2,$3,$4,$5,$6,$7,'published','S3',0.82,$8,'{}'::jsonb,$9::jsonb,NOW(),NOW()) ON CONFLICT(id) DO NOTHING`, [passportId, sellerBatch?.id ?? listing?.id ?? "batch:hx-bpc-2607", sellerOrg?.organization_id ?? null, listing?.product_id ?? null, listing?.id ?? null, sellerBatch?.id ?? null, batchCode, latestReportId, JSON.stringify(["Two samples only", "Sterility not tested", "Endotoxin not tested", "Inventory-wide representativeness not established"])]);
  for (const suffix of ["A", "B"]) {
    const reportId = `lab-report:${suffix}`;
    for (const result of (await db.query<QueryResultRow & { id: string }>(`SELECT ar.id FROM analytical_results ar JOIN analytical_runs r ON r.id=ar.run_id WHERE r.sample_id=$1`, [`sample:${suffix}`])).rows) {
      await db.query(`INSERT INTO passport_evidence_links(id,passport_id,report_id,result_id,relationship,status,confidence) VALUES($1,$2,$3,$4,'supports','active',$5) ON CONFLICT(passport_id,report_id,result_id) DO NOTHING`, [newId("passport-link"), passportId, reportId, result.id, suffix === "B" ? .82 : .52]);
    }
  }
  await db.query(`INSERT INTO evidence_conflicts(id,passport_id,dimension,left_result_id,right_result_id,severity,status,explanation) VALUES('conflict:hx-bpc-qty',$1,'quantity','result:A:qty','result:B:qty','high','open','Two separately sourced samples produced materially different measured quantities. The passport preserves both results rather than averaging them away.') ON CONFLICT(id) DO NOTHING`, [passportId]);
  await recomputePassport(passportId, db);
  await projectEvidenceRegistry(db);
}

export async function ensureEvidenceNetworkSeed() {
  const fixturesEnabled = process.env.VIALGRADE_SEED_FIXTURES === "true" || (process.env.NODE_ENV !== "production" && process.env.VIALGRADE_SEED_FIXTURES !== "false");
  if (!fixturesEnabled) return;
  if (!globalThis.__vialEvidenceSeedPromise) globalThis.__vialEvidenceSeedPromise = seedEvidenceNetwork().catch(error => { globalThis.__vialEvidenceSeedPromise = undefined; throw error; });
  return globalThis.__vialEvidenceSeedPromise;
}

export async function recomputePassport(passportId: string, connection?: SqlConnection) {
  const db = connection ?? await getDatabase();
  const passport = (await db.query<QueryResultRow & { sampling_level: string }>(`SELECT sampling_level FROM batch_passports WHERE id=$1`, [passportId])).rows[0];
  if (!passport) throw new Error("Passport not found");
  const rows = (await db.query<QueryResultRow & Record<string, unknown>>(
    `SELECT ar.*,lr.id report_id,lr.report_number,lr.version,lr.status report_status,lr.issued_at,ls.sampling_model,lp.accreditation_status,lp.display_name laboratory_name,run.method_id
     FROM passport_evidence_links pel
     JOIN laboratory_reports lr ON lr.id=pel.report_id
     JOIN analytical_results ar ON ar.id=pel.result_id
     JOIN analytical_runs run ON run.id=ar.run_id
     JOIN laboratory_samples ls ON ls.id=run.sample_id
     JOIN laboratory_profiles lp ON lp.id=lr.laboratory_id
     WHERE pel.passport_id=$1 AND pel.status='active' AND lr.status='issued' AND ar.review_status='approved'
     ORDER BY lr.issued_at,ar.dimension`, [passportId]
  )).rows;
  const dimensions: Record<string, unknown> = {};
  for (const row of rows) {
    const dimension = String(row.dimension);
    const entry = { resultId: row.id, reportId: row.report_id, reportNumber: row.report_number, value: row.result_type === "numeric" ? Number(row.value_numeric) : row.value_text, unit: row.unit, conclusion: row.conclusion, samplingModel: row.sampling_model, laboratory: row.laboratory_name, issuedAt: row.issued_at };
    const current = dimensions[dimension] as { observations: unknown[] } | undefined;
    if (current) current.observations.push(entry); else dimensions[dimension] = { status: "established", observations: [entry] };
  }
  const conflicts = (await db.query<QueryResultRow & { dimension: string }>(`SELECT dimension FROM evidence_conflicts WHERE passport_id=$1 AND status='open'`, [passportId])).rows;
  for (const conflict of conflicts) if (dimensions[conflict.dimension]) (dimensions[conflict.dimension] as Record<string, unknown>).status = "conflicting";
  const required = ["identity", "purity", "quantity", "sterility", "endotoxin", "particulates"];
  const limitations = required.filter(key => !dimensions[key]).map(key => `${key} not established`);
  const report = (await db.query<QueryResultRow & { id: string }>(`SELECT lr.id FROM passport_evidence_links pel JOIN laboratory_reports lr ON lr.id=pel.report_id WHERE pel.passport_id=$1 AND pel.status='active' AND lr.status='issued' ORDER BY lr.issued_at DESC LIMIT 1`, [passportId])).rows[0];
  const base = samplingConfidence(passport.sampling_level);
  const conflictApplied = conflicts.length > 0;
  const factor = conflictApplied ? .86 : 1;
  const confidence = base * factor;
  // The headline confidence is preserved but never a black box: its components are
  // emitted so any consumer can see which labs, sampling models, and dimensions produced it.
  const dimensionStatus = (status: string) => Object.keys(dimensions).filter(key => (dimensions[key] as { status?: string }).status === status);
  const confidenceBasis: BatchConfidenceBasis = {
    headline: confidence,
    samplingLevel: passport.sampling_level,
    samplingBaseConfidence: base,
    conflictPenaltyApplied: conflictApplied,
    conflictPenaltyFactor: factor,
    independence: {
      samplingModels: [...new Set(rows.map(row => String(row.sampling_model)))],
      independentSampleCount: new Set(rows.filter(row => row.sampling_model === "blind_purchase").map(row => row.report_id)).size,
      totalObservations: rows.length,
    },
    laboratories: [...new Set(rows.map(row => String(row.laboratory_name)))],
    methods: [...new Set(rows.map(row => String(row.method_id)))],
    dimensionSummary: { established: dimensionStatus("established"), conflicting: dimensionStatus("conflicting"), unknown: required.filter(key => !dimensions[key]) },
  };
  await db.query(`UPDATE batch_passports SET dimensions=$2::jsonb,limitations=$3::jsonb,evidence_confidence=$4,current_report_id=$5,confidence_basis=$6::jsonb,last_evidence_at=NOW(),updated_at=NOW() WHERE id=$1`, [passportId, JSON.stringify(dimensions), JSON.stringify(limitations), confidence, report?.id ?? null, JSON.stringify(confidenceBasis)]);
  // Append an immutable version when content materially changes. A cited passport URL
  // is a record, not a mutable row — its history must be reconstructable.
  const contentHash = hash({ dimensions, limitations, confidence, confidenceBasis });
  const latest = (await db.query<QueryResultRow & { version: number; content_hash: string }>(`SELECT version,content_hash FROM passport_versions WHERE passport_id=$1 ORDER BY version DESC LIMIT 1`, [passportId])).rows[0];
  if (!latest || latest.content_hash !== contentHash) {
    const nextVersion = Number(latest?.version ?? 0) + 1;
    await db.query(`INSERT INTO passport_versions(id,passport_id,version,evidence_confidence,sampling_level,dimensions,limitations,confidence_basis,content_hash,current_report_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10) ON CONFLICT(passport_id,version) DO NOTHING`, [newId("passport-version"), passportId, nextVersion, confidence, passport.sampling_level, JSON.stringify(dimensions), JSON.stringify(limitations), JSON.stringify(confidenceBasis), contentHash, report?.id ?? null]);
  }
  return { dimensions, limitations, confidence, confidenceBasis };
}

export interface BatchConfidenceBasis {
  headline: number;
  samplingLevel: string;
  samplingBaseConfidence: number;
  conflictPenaltyApplied: boolean;
  conflictPenaltyFactor: number;
  independence: { samplingModels: string[]; independentSampleCount: number; totalObservations: number };
  laboratories: string[];
  methods: string[];
  dimensionSummary: { established: string[]; conflicting: string[]; unknown: string[] };
}

export interface BatchStandardRecord {
  registryId: string;
  declaredBatchCode: string;
  slug: string;
  status: string;
  // 'vial-operated' = evidence from VialGrade's own sampling/custody chain (demo passports);
  // 'external-certificates' = aggregated independent third-party COAs VialGrade did not sample or
  // hold in custody. The two carry differently-shaped confidenceBasis objects — consumers should
  // branch on evidenceType. External passports never assert regulatory-grade certainty.
  evidenceType: "vial-operated" | "external-certificates";
  vendorId: string | null;
  productId: string | null;
  evidenceConfidence: number;
  confidenceBasis: Record<string, unknown>;
  dimensions: Record<string, unknown>;
  limitations: string[];
  versions: { version: number; evidenceConfidence: number; samplingLevel: string; confidenceBasis: Record<string, unknown>; createdAt: string }[];
  provenanceUrl: string;
}

// The public batch-history standard record: resolves a vialgrade:batch ID to its current
// decomposed passport plus the full append-only version history.
export async function getBatchStandardRecord(batchId: string, connection?: SqlConnection): Promise<BatchStandardRecord | null> {
  await ensureEvidenceNetworkSeed();
  const db = connection ?? await getDatabase();
  const reg = (await db.query<QueryResultRow & { source_entity_id: string; provenance_url: string }>(`SELECT source_entity_id,provenance_url FROM registry_identifiers WHERE registry_id=$1 AND entity_type='batch'`, [batchId])).rows[0];
  if (!reg) return null;
  const passport = (await db.query<QueryResultRow & Record<string, unknown>>(`SELECT * FROM batch_passports WHERE id=$1 AND status='published'`, [reg.source_entity_id])).rows[0];
  if (!passport) return null;
  const versions = (await db.query<QueryResultRow & { version: number; evidence_confidence: string | number; sampling_level: string; confidence_basis: unknown; created_at: string }>(`SELECT version,evidence_confidence,sampling_level,confidence_basis,created_at FROM passport_versions WHERE passport_id=$1 ORDER BY version DESC`, [passport.id])).rows;
  return {
    registryId: batchId,
    declaredBatchCode: String(passport.declared_batch_code),
    slug: String(passport.slug),
    status: String(passport.status),
    evidenceType: passport.origin === "live" ? "external-certificates" : "vial-operated",
    vendorId: (passport.vendor_id as string | null) ?? null,
    productId: (passport.product_id as string | null) ?? null,
    evidenceConfidence: Number(passport.evidence_confidence),
    confidenceBasis: json<Record<string, unknown>>(passport.confidence_basis, {}),
    dimensions: json<Record<string, unknown>>(passport.dimensions, {}),
    limitations: json<string[]>(passport.limitations, []),
    versions: versions.map(v => ({ version: Number(v.version), evidenceConfidence: Number(v.evidence_confidence), samplingLevel: v.sampling_level, confidenceBasis: json<Record<string, unknown>>(v.confidence_basis, {}), createdAt: String(v.created_at) })),
    provenanceUrl: reg.provenance_url,
  };
}

export async function getLaboratoryContext(email: string) {
  await ensureEvidenceNetworkSeed(); const db = await getDatabase(); const membership = await resolveLaboratoryMembership(email, db); if (!membership) return null;
  const lab = (await db.query<QueryResultRow & Record<string, unknown>>(`SELECT lp.*,o.description,o.location FROM laboratory_profiles lp JOIN organizations o ON o.id=lp.organization_id WHERE lp.id=$1`, [membership.laboratory_id])).rows[0];
  const [onboarding, steps, methods, orders, samples, custody, runs, results, reports, programs, tokens] = await Promise.all([
    db.query(`SELECT * FROM laboratory_onboarding_sessions WHERE laboratory_id=$1 ORDER BY started_at DESC LIMIT 1`, [membership.laboratory_id]),
    db.query(`SELECT los.* FROM laboratory_onboarding_steps los JOIN laboratory_onboarding_sessions s ON s.id=los.session_id WHERE s.laboratory_id=$1 ORDER BY los.id`, [membership.laboratory_id]),
    db.query(`SELECT * FROM laboratory_methods WHERE laboratory_id=$1 ORDER BY technique,name`, [membership.laboratory_id]),
    db.query(`SELECT o.*,p.name program_name FROM laboratory_test_orders o LEFT JOIN testing_programs p ON p.id=o.program_id WHERE o.laboratory_id=$1 ORDER BY o.created_at DESC`, [membership.laboratory_id]),
    db.query(`SELECT s.*,o.order_number FROM laboratory_samples s JOIN laboratory_test_orders o ON o.id=s.test_order_id WHERE o.laboratory_id=$1 ORDER BY s.created_at DESC`, [membership.laboratory_id]),
    db.query(`SELECT c.*,s.sample_code FROM sample_custody_events c JOIN laboratory_samples s ON s.id=c.sample_id JOIN laboratory_test_orders o ON o.id=s.test_order_id WHERE o.laboratory_id=$1 ORDER BY c.occurred_at DESC`, [membership.laboratory_id]),
    db.query(`SELECT r.*,s.sample_code,m.name method_name,m.technique FROM analytical_runs r JOIN laboratory_samples s ON s.id=r.sample_id JOIN laboratory_methods m ON m.id=r.method_id WHERE m.laboratory_id=$1 ORDER BY r.created_at DESC`, [membership.laboratory_id]),
    db.query(`SELECT ar.*,r.run_code,s.sample_code FROM analytical_results ar JOIN analytical_runs r ON r.id=ar.run_id JOIN laboratory_samples s ON s.id=r.sample_id JOIN laboratory_methods m ON m.id=r.method_id WHERE m.laboratory_id=$1 ORDER BY ar.created_at DESC`, [membership.laboratory_id]),
    db.query(`SELECT r.*,s.sample_code,o.order_number FROM laboratory_reports r JOIN laboratory_samples s ON s.id=r.sample_id JOIN laboratory_test_orders o ON o.id=r.test_order_id WHERE r.laboratory_id=$1 ORDER BY r.created_at DESC`, [membership.laboratory_id]),
    db.query(`SELECT DISTINCT p.* FROM testing_programs p JOIN laboratory_test_orders o ON o.program_id=p.id WHERE o.laboratory_id=$1 ORDER BY p.created_at DESC`, [membership.laboratory_id]),
    db.query(`SELECT id,label,token_prefix,scopes,status,last_used_at,expires_at,created_at FROM laboratory_api_tokens WHERE laboratory_id=$1 ORDER BY created_at DESC`, [membership.laboratory_id]),
  ]);
  return { membership, lab, onboarding: onboarding.rows[0] ?? null, steps: steps.rows, methods: methods.rows, orders: orders.rows, samples: samples.rows, custody: custody.rows, runs: runs.rows, results: results.rows, reports: reports.rows, programs: programs.rows, tokens: tokens.rows };
}

export async function listPublicLaboratories() { await ensureEvidenceNetworkSeed(); const db = await getDatabase(); return (await db.query(`SELECT lp.*,o.description,o.location,(SELECT COUNT(*) FROM laboratory_methods m WHERE m.laboratory_id=lp.id AND m.validation_status='validated') method_count,(SELECT COUNT(*) FROM laboratory_reports r WHERE r.laboratory_id=lp.id AND r.status='issued') issued_reports FROM laboratory_profiles lp JOIN organizations o ON o.id=lp.organization_id WHERE lp.status IN ('sandbox','active') ORDER BY lp.display_name`)).rows; }
export async function getPublicLaboratory(slug: string) { await ensureEvidenceNetworkSeed(); const db = await getDatabase(); const lab = (await db.query(`SELECT lp.*,o.description,o.location FROM laboratory_profiles lp JOIN organizations o ON o.id=lp.organization_id WHERE lp.slug=$1 AND lp.status IN ('sandbox','active')`, [slug])).rows[0]; if (!lab) return null; const [methods, reports] = await Promise.all([db.query(`SELECT * FROM laboratory_methods WHERE laboratory_id=$1 AND validation_status='validated' ORDER BY technique,name`, [lab.id]), db.query(`SELECT r.id,r.report_number,r.version,r.status,r.public_summary,r.issued_at,s.sample_code,o.declared_batch_code FROM laboratory_reports r JOIN laboratory_samples s ON s.id=r.sample_id JOIN laboratory_test_orders o ON o.id=r.test_order_id WHERE r.laboratory_id=$1 AND r.status='issued' ORDER BY r.issued_at DESC`, [lab.id])]); return { lab, methods: methods.rows, reports: reports.rows }; }
export async function listPublicPassports() { await ensureEvidenceNetworkSeed(); const db = await getDatabase(); return (await db.query(`SELECT bp.*,o.display_name vendor_name,o.slug vendor_slug,p.name product_name,c.canonical_name compound_name,c.slug compound_slug_join,l.slug listing_slug,(SELECT COUNT(*) FROM passport_evidence_links pel WHERE pel.passport_id=bp.id AND pel.status='active')+(SELECT COUNT(*) FROM passport_lab_tests plt WHERE plt.passport_id=bp.id) evidence_links,(SELECT COUNT(*) FROM evidence_conflicts ec WHERE ec.passport_id=bp.id AND ec.status='open') open_conflicts FROM batch_passports bp LEFT JOIN organizations o ON o.id=bp.vendor_id LEFT JOIN products p ON p.id=bp.product_id LEFT JOIN compounds c ON c.slug=bp.compound_slug LEFT JOIN listings l ON l.id=bp.listing_id WHERE bp.status='published' ORDER BY bp.origin='live' DESC,bp.evidence_confidence DESC,bp.updated_at DESC`)).rows; }
// Passports for ONE compound, filtered and limited in SQL.
//
// The compound page used to call listPublicPassports() — every published passport, every column,
// no limit — and then filter in JavaScript down to twelve. That is the whole table read out of the
// database on every compound page view, including every crawler hit across hundreds of pages, to
// display a dozen rows. Managed Postgres bills for bytes read, so this was a standing egress leak.
export async function listPublicPassportsForCompound(compoundSlug: string, limit = 12) {
  await ensureEvidenceNetworkSeed();
  const db = await getDatabase();
  return (await db.query(`SELECT bp.id,bp.slug,bp.declared_batch_code,bp.origin,bp.sampling_level,bp.evidence_confidence,bp.compound_slug,o.display_name vendor_name,o.slug vendor_slug,p.name product_name,c.canonical_name compound_name,c.slug compound_slug_join,l.slug listing_slug,(SELECT COUNT(*) FROM passport_evidence_links pel WHERE pel.passport_id=bp.id AND pel.status='active')+(SELECT COUNT(*) FROM passport_lab_tests plt WHERE plt.passport_id=bp.id) evidence_links,(SELECT COUNT(*) FROM evidence_conflicts ec WHERE ec.passport_id=bp.id AND ec.status='open') open_conflicts FROM batch_passports bp LEFT JOIN organizations o ON o.id=bp.vendor_id LEFT JOIN products p ON p.id=bp.product_id LEFT JOIN compounds c ON c.slug=bp.compound_slug LEFT JOIN listings l ON l.id=bp.listing_id WHERE bp.status='published' AND (bp.compound_slug=$1 OR c.slug=$1) ORDER BY bp.origin='live' DESC,bp.evidence_confidence DESC,bp.updated_at DESC LIMIT $2`, [compoundSlug, limit])).rows;
}
export async function getPublicPassportForBatchCode(batchCode: string) { await ensureEvidenceNetworkSeed(); const db = await getDatabase(); return (await db.query(`SELECT bp.*,o.display_name vendor_name,p.name product_name FROM batch_passports bp LEFT JOIN organizations o ON o.id=bp.vendor_id LEFT JOIN products p ON p.id=bp.product_id WHERE bp.status='published' AND LOWER(bp.declared_batch_code)=LOWER($1) ORDER BY bp.updated_at DESC LIMIT 1`, [batchCode])).rows[0] ?? null; }
export async function getPublicPassport(slug: string) { await ensureEvidenceNetworkSeed(); const db = await getDatabase(); const passport = (await db.query(`SELECT bp.*,o.display_name vendor_name,o.slug vendor_slug,p.name product_name,c.canonical_name compound_name,l.slug listing_slug FROM batch_passports bp LEFT JOIN organizations o ON o.id=bp.vendor_id LEFT JOIN products p ON p.id=bp.product_id LEFT JOIN compounds c ON c.slug=bp.compound_slug LEFT JOIN listings l ON l.id=bp.listing_id WHERE bp.slug=$1 AND bp.status='published'`, [slug])).rows[0]; if (!passport) return null;
  // A live passport aggregates real external certificates, not VialGrade-run reports/custody, so its
  // evidence is the linked COAs — the demo report/custody joins are empty for it.
  if (passport.origin === "live") { const labTests = await getLivePassportEvidence(db, String(passport.id)); return { passport, labTests, reports: [], conflicts: [], custody: [] }; }
  const [reports, conflicts, custody] = await Promise.all([db.query(`SELECT DISTINCT lr.*,pel.status evidence_link_status,lp.display_name laboratory_name,lp.slug laboratory_slug,ls.sample_code,ls.sampling_model FROM passport_evidence_links pel JOIN laboratory_reports lr ON lr.id=pel.report_id JOIN laboratory_profiles lp ON lp.id=lr.laboratory_id JOIN laboratory_samples ls ON ls.id=lr.sample_id WHERE pel.passport_id=$1 ORDER BY lr.issued_at DESC,lr.version DESC`, [passport.id]), db.query(`SELECT * FROM evidence_conflicts WHERE passport_id=$1 ORDER BY created_at DESC`, [passport.id]), db.query(`SELECT DISTINCT c.*,s.sample_code,s.sampling_model FROM sample_custody_events c JOIN laboratory_samples s ON s.id=c.sample_id JOIN laboratory_reports lr ON lr.sample_id=s.id JOIN passport_evidence_links pel ON pel.report_id=lr.id WHERE pel.passport_id=$1 ORDER BY s.sample_code,c.sequence_number`, [passport.id])]); return { passport, labTests: [], reports: reports.rows, conflicts: conflicts.rows, custody: custody.rows }; }
export async function getEvidenceNetworkDashboard() { await ensureEvidenceNetworkSeed(); const db = await getDatabase(); const counts = await db.query(`SELECT (SELECT COUNT(*) FROM laboratory_profiles) laboratories,(SELECT COUNT(*) FROM laboratory_methods) methods,(SELECT COUNT(*) FROM laboratory_samples) samples,(SELECT COUNT(*) FROM sample_custody_events) custody_events,(SELECT COUNT(*) FROM laboratory_reports WHERE status='issued') issued_reports,(SELECT COUNT(*) FROM batch_passports WHERE status='published') passports,(SELECT COUNT(*) FROM evidence_conflicts WHERE status='open') conflicts,(SELECT COUNT(*) FROM testing_programs WHERE status='active') programs`); const [labs, programs, passports, conflicts, reports] = await Promise.all([db.query(`SELECT lp.*,o.location FROM laboratory_profiles lp JOIN organizations o ON o.id=lp.organization_id ORDER BY lp.display_name`), db.query(`SELECT * FROM testing_programs ORDER BY created_at DESC`), db.query(`SELECT * FROM batch_passports ORDER BY updated_at DESC`), db.query(`SELECT ec.*,bp.declared_batch_code FROM evidence_conflicts ec JOIN batch_passports bp ON bp.id=ec.passport_id ORDER BY ec.created_at DESC`), db.query(`SELECT lr.*,lp.display_name laboratory_name,ls.sample_code FROM laboratory_reports lr JOIN laboratory_profiles lp ON lp.id=lr.laboratory_id JOIN laboratory_samples ls ON ls.id=lr.sample_id ORDER BY lr.created_at DESC`)]); return { counts: counts.rows[0], laboratories: labs.rows, programs: programs.rows, passports: passports.rows, conflicts: conflicts.rows, reports: reports.rows }; }

export async function getLaboratoryAnalytics(laboratoryId: string) {
  const db = await getDatabase();
  const totals = (await db.query<Record<string, string | number>>(`SELECT
    (SELECT COUNT(*) FROM laboratory_reports WHERE laboratory_id=$1) total_reports,
    (SELECT COUNT(*) FROM laboratory_reports WHERE laboratory_id=$1 AND status='issued') issued_reports,
    (SELECT COUNT(*) FROM laboratory_reports WHERE laboratory_id=$1 AND status='revoked') revoked_reports,
    (SELECT COUNT(*) FROM laboratory_test_orders WHERE laboratory_id=$1) total_orders,
    (SELECT COUNT(*) FROM laboratory_samples s JOIN laboratory_test_orders o ON o.id=s.test_order_id WHERE o.laboratory_id=$1) total_samples,
    (SELECT COUNT(*) FROM laboratory_methods WHERE laboratory_id=$1) total_methods,
    (SELECT COUNT(*) FROM laboratory_methods WHERE laboratory_id=$1 AND validation_status='validated') validated_methods,
    (SELECT COUNT(*) FROM sample_custody_events ce JOIN laboratory_samples s ON s.id=ce.sample_id JOIN laboratory_test_orders o ON o.id=s.test_order_id WHERE o.laboratory_id=$1) custody_events
  `, [laboratoryId])).rows[0] ?? {};
  const orderStatus = (await db.query<{ status: string; n: string | number }>(`SELECT status, COUNT(*) n FROM laboratory_test_orders WHERE laboratory_id=$1 GROUP BY status ORDER BY n DESC`, [laboratoryId])).rows;
  return { totals, orderStatus };
}

export async function accessionSample(input: { laboratoryId: string; sampleId: string; actorId: string; condition: string; sealStatus: string; location: string }) {
  return withTransaction(async db => { const sample = (await db.query<QueryResultRow & { root_event_id: string; accession_status: string }>(`SELECT root_event_id,accession_status FROM laboratory_samples WHERE id=$1 AND test_order_id IN(SELECT id FROM laboratory_test_orders WHERE laboratory_id=$2)`, [input.sampleId, input.laboratoryId])).rows[0]; if (!sample) throw new Error("Sample not found"); if (sample.accession_status === "accessioned") return sample; await db.query(`UPDATE laboratory_samples SET accession_status='accessioned',sample_condition=$2,seal_status=$3,accessioned_by=$4,received_at=COALESCE(received_at,NOW()),updated_at=NOW() WHERE id=$1`, [input.sampleId, input.condition, input.sealStatus, input.actorId]); await addCustodyEventTx(db, { sampleId: input.sampleId, eventType: "accessioned", actorType: "user", actorId: input.actorId, location: input.location, metadata: { condition: input.condition, sealStatus: input.sealStatus }, rootEventId: sample.root_event_id }); return { id: input.sampleId, accessionStatus: "accessioned" }; });
}

export async function issueLaboratoryReport(input: { laboratoryId: string; testOrderId: string; sampleId: string; reportNumber: string; actorId: string; summary: string }) {
  return withTransaction(async db => { const runs = (await db.query<QueryResultRow & { id: string; method_id: string }>(`SELECT id,method_id FROM analytical_runs WHERE test_order_id=$1 AND sample_id=$2 AND status='reviewed'`, [input.testOrderId, input.sampleId])).rows; if (!runs.length) throw new Error("No reviewed runs available"); const results = (await db.query<QueryResultRow & { id: string }>(`SELECT ar.id FROM analytical_results ar JOIN analytical_runs r ON r.id=ar.run_id WHERE r.test_order_id=$1 AND r.sample_id=$2 AND ar.review_status='approved'`, [input.testOrderId, input.sampleId])).rows; if (!results.length) throw new Error("No approved results available"); const existing = (await db.query<QueryResultRow & { version: number; id: string }>(`SELECT version,id FROM laboratory_reports WHERE laboratory_id=$1 AND report_number=$2 ORDER BY version DESC LIMIT 1`, [input.laboratoryId, input.reportNumber])).rows[0]; const version = Number(existing?.version ?? 0) + 1; const id = newId("lab-report"); const payload = { laboratoryId: input.laboratoryId, order: input.testOrderId, sample: input.sampleId, reportNumber: input.reportNumber, version, results: results.map(r => r.id), methods: [...new Set(runs.map(r => r.method_id))] }; await db.query(`INSERT INTO laboratory_reports(id,laboratory_id,test_order_id,sample_id,report_number,version,status,public_summary,result_ids,method_ids,signed_payload_hash,document_hash,issued_by,reviewed_by,issued_at,supersedes_report_id) VALUES($1,$2,$3,$4,$5,$6,'issued',$7,$8::jsonb,$9::jsonb,$10,$11,$12,$12,NOW(),$13)`, [id, input.laboratoryId, input.testOrderId, input.sampleId, input.reportNumber, version, input.summary, JSON.stringify(results.map(r => r.id)), JSON.stringify([...new Set(runs.map(r => r.method_id))]), hash(payload), hash({ ...payload, rendered: true }), input.actorId, existing?.id ?? null]); if (existing) await db.query(`UPDATE laboratory_reports SET status='superseded',updated_at=NOW() WHERE id=$1`, [existing.id]); await db.query(`INSERT INTO laboratory_report_events(id,report_id,event_type,actor_type,actor_id,reason,after_json,root_event_id) SELECT $1,$2,$3,'user',$4,$5,$6::jsonb,root_event_id FROM laboratory_test_orders WHERE id=$7`, [newId("report-event"), id, existing ? "amended" : "issued", input.actorId, existing ? "Superseding version" : "Initial issue", JSON.stringify(payload), input.testOrderId]); return { id, version }; });
}

export async function revokeLaboratoryReport(input: { laboratoryId: string; reportId: string; actorId: string; reason: string }) {
  return withTransaction(async db => { const report = (await db.query<QueryResultRow & { status: string; test_order_id: string }>(`SELECT status,test_order_id FROM laboratory_reports WHERE id=$1 AND laboratory_id=$2`, [input.reportId, input.laboratoryId])).rows[0]; if (!report) throw new Error("Report not found"); if (report.status === "revoked") return { id: input.reportId, status: "revoked" }; await db.query(`UPDATE laboratory_reports SET status='revoked',revocation_reason=$2,revoked_at=NOW(),updated_at=NOW() WHERE id=$1`, [input.reportId, input.reason]); await db.query(`UPDATE passport_evidence_links SET status='revoked' WHERE report_id=$1`, [input.reportId]); await db.query(`INSERT INTO laboratory_report_events(id,report_id,event_type,actor_type,actor_id,reason,root_event_id) SELECT $1,$2,'revoked','user',$3,$4,root_event_id FROM laboratory_test_orders WHERE id=$5`, [newId("report-event"), input.reportId, input.actorId, input.reason, report.test_order_id]); const passports = (await db.query<QueryResultRow & { passport_id: string }>(`SELECT DISTINCT passport_id FROM passport_evidence_links WHERE report_id=$1`, [input.reportId])).rows; for (const passport of passports) await recomputePassport(passport.passport_id, db); return { id: input.reportId, status: "revoked" }; });
}

export async function createLaboratoryApiToken(input: { laboratoryId: string; label: string; scopes: string[]; actorId: string }) { const raw = `vlab_${randomBytes(24).toString("base64url")}`; const id = newId("lab-token"); const db = await getDatabase(); await db.query(`INSERT INTO laboratory_api_tokens(id,laboratory_id,label,token_prefix,token_hash,scopes,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`, [id, input.laboratoryId, input.label, raw.slice(0, 12), tokenHash(raw), JSON.stringify(input.scopes), input.actorId]); return { id, token: raw, prefix: raw.slice(0, 12) }; }
export async function revokeLaboratoryApiToken(input: { laboratoryId: string; tokenId: string }) { const db = await getDatabase(); const result = await db.query(`UPDATE laboratory_api_tokens SET status='revoked',revoked_at=NOW() WHERE id=$1 AND laboratory_id=$2 AND status='active' RETURNING id`, [input.tokenId, input.laboratoryId]); return Boolean(result.rows[0]); }

const EVIDENCE_PROPOSAL_TYPES = new Set(["evidence-link", "batch-claim", "report-reference"]);
export type EvidenceProposalResult = { ok: true; id: string; status: string } | { ok: false; code: number; error: string };

// The external-submission flywheel: an authenticated lab attaches evidence against a
// public VialGrade ID. It ALWAYS lands as a pending proposal in the human review queue and can
// NEVER publish, issue, or approve (AGENTS: no bearer/MCP path may publish or approve
// evidence). Extracted/submitted content is inert data until a human reviews it.
// Authentication + scope are enforced by the route's requireLaboratoryBearerScope gate;
// this function receives the already-authenticated laboratory identity.
export async function submitEvidenceProposal(input: { laboratoryId: string; tokenId: string; registryId: string; proposalType: string; payload: Record<string, unknown> }): Promise<EvidenceProposalResult> {
  if (!EVIDENCE_PROPOSAL_TYPES.has(input.proposalType)) return { ok: false, code: 400, error: `Unknown proposal type. Allowed: ${[...EVIDENCE_PROPOSAL_TYPES].join(", ")}` };
  const serialized = JSON.stringify(input.payload ?? {});
  if (serialized.length > 8192) return { ok: false, code: 400, error: "Payload exceeds 8KB" };

  const db = await getDatabase();
  // Throttle FIRST, on the authenticated lab, so the unknown-ID (404) path cannot be used
  // to spin unbounded DB reads from a single credential.
  const limit = await consumeRateLimit({ bucket: "evidence-proposal", key: input.laboratoryId, limit: 30, windowSeconds: 60 });
  if (!limit.allowed) return { ok: false, code: 429, error: "Rate limit exceeded" };

  const reg = (await db.query<QueryResultRow & { source_entity_type: string; source_entity_id: string; entity_type: string }>(`SELECT source_entity_type,source_entity_id,entity_type FROM registry_identifiers WHERE registry_id=$1 AND status='active'`, [input.registryId])).rows[0];
  if (!reg) return { ok: false, code: 404, error: "Unknown VialGrade ID" };

  const id = newId("lab-proposal");
  await db.query(
    `INSERT INTO laboratory_work_proposals(id,laboratory_id,proposal_type,subject_type,subject_id,payload,status,created_by)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,'pending',$7)`,
    [id, input.laboratoryId, input.proposalType, reg.source_entity_type, reg.source_entity_id, JSON.stringify({ registryId: input.registryId, entityType: reg.entity_type, submitted: input.payload ?? {} }), `lab-token:${input.tokenId}`],
  );
  return { ok: true, id, status: "pending" };
}
export async function authenticateLaboratoryApiToken(raw: string) { await ensureEvidenceNetworkSeed(); const db = await getDatabase(); const row = (await db.query<QueryResultRow & { id: string; laboratory_id: string; scopes: unknown }>(`SELECT id,laboratory_id,scopes FROM laboratory_api_tokens WHERE token_hash=$1 AND status='active' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())`, [tokenHash(raw)])).rows[0]; if (!row) return null; await db.query(`UPDATE laboratory_api_tokens SET last_used_at=NOW() WHERE id=$1`, [row.id]); return { tokenId: row.id, laboratoryId: row.laboratory_id, scopes: json<string[]>(row.scopes, []) }; }

// Slug-only reads for the sitemap.
//
// Both page families exist and serve, and neither was listed in the sitemap — so ~279 batch
// passports and every laboratory profile were invisible to search engines. Those passport pages are
// the actual differentiator: they are the certificates nobody else publishes free.
//
// Deliberately SELECT slug and nothing else. listPublicPassports() returns full rows with
// correlated subqueries per passport, which is far more than a list of links needs, and the whole
// point of the recent work was to stop reading rows nobody renders.
export async function listSitemapPassportSlugs(connection?: SqlConnection): Promise<string[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<{ slug: string }>(
    `SELECT slug FROM batch_passports WHERE status='published' ORDER BY updated_at DESC`,
  )).rows.map((r) => r.slug);
}

// NOTE: there is deliberately no laboratory equivalent here. /labs renders the static LAB_REGISTRY
// in server/labs/registry.ts, not the laboratory_profiles table, so the sitemap reads that instead.
// A query against the table returns zero rows and looks like a working fix.
