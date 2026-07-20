import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { DeterministicExtractor } from "./extractors";
import { runExtractionBenchmark, type BenchmarkReport } from "./benchmark-runner";
import { goldenCases, GOLDEN_DATASET_VERSION } from "./golden";
import { resolveExtractorSelection } from "./extractors";

export interface BenchmarkRunRow {
  id: string;
  extractor_id: string;
  prompt_version: string;
  dataset_version: string;
  precision: string | number;
  recall: string | number;
  f1: string | number;
  abstention_correct_rate: string | number;
  total_cost_cents: string | number;
  case_count: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  is_baseline: boolean;
  created_at: string;
}
export interface CaseResultRow {
  case_name: string;
  difficulty: string;
  false_negatives: string | number;
  false_positives: string | number;
  correct_abstention: boolean;
}
export interface ActivationRow {
  extractor_id: string;
  prompt_version: string;
  active: boolean;
  reason: string;
  activated_by: string;
  created_at: string;
}
export interface PromptRow {
  prompt_key: string;
  version: number;
  status: string;
  notes: string;
  activated_at: string | null;
}
export interface ShadowRunRow {
  id: string;
  model_extractor_version: string;
  agreement_rate: string | number;
  cost_cents: string | number;
  created_at: string;
}

export interface ExtractionControlPlane {
  runs: BenchmarkRunRow[];
  latestBaseline: BenchmarkRunRow | null;
  latestModelRun: BenchmarkRunRow | null;
  modelRuns: BenchmarkRunRow[];
  caseResults: CaseResultRow[];
  prompts: PromptRow[];
  activations: ActivationRow[];
  shadowRuns: ShadowRunRow[];
  shadowCount: number;
  selection: { mode: string; clientAvailable: boolean; modelApproved: boolean; resolved: string };
  modelBeatsBaseline: boolean;
}

export async function recordBenchmarkRun(
  db: SqlConnection,
  report: BenchmarkReport,
  meta: { isBaseline: boolean; promptVersion: string; datasetVersion: string },
): Promise<string> {
  const runId = newId("bench");
  await db.query(
    `INSERT INTO extraction_benchmark_runs
     (id, extractor_id, prompt_version, dataset_version, precision, recall, f1, abstention_correct_rate, total_cost_cents, case_count, true_positives, false_positives, false_negatives, is_baseline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [runId, report.extractorId, meta.promptVersion, meta.datasetVersion, report.score.precision, report.score.recall, report.score.f1, report.score.abstentionCorrectRate, report.totalCostCents, report.score.caseCount, report.score.tp, report.score.fp, report.score.fn, meta.isBaseline],
  );
  for (const result of report.caseResults) {
    await db.query(
      `INSERT INTO extraction_benchmark_case_results
       (id, run_id, case_name, difficulty, true_positives, false_positives, false_negatives, correct_abstention, predicted_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [newId("bcase"), runId, result.name, result.difficulty, result.tp, result.fp, result.fn, result.correctAbstention, JSON.stringify(result.predicted)],
    );
  }
  return runId;
}

export async function recordExtractorActivation(
  db: SqlConnection,
  input: { extractorId: string; promptVersion: string; reason: string; activatedBy: string },
): Promise<void> {
  await db.query(`UPDATE extractor_activations SET active = FALSE WHERE active = TRUE`);
  await db.query(
    `INSERT INTO extractor_activations (id, extractor_id, prompt_version, active, reason, activated_by)
     VALUES ($1,$2,$3,TRUE,$4,$5)`,
    [newId("activation"), input.extractorId, input.promptVersion, input.reason, input.activatedBy],
  );
}

export async function logShadowRun(
  db: SqlConnection,
  input: { agentRunId: string | null; modelExtractorVersion: string; deterministicClaims: unknown; modelClaims: unknown; agreementRate: number; costCents: number },
): Promise<void> {
  await db.query(
    `INSERT INTO extraction_shadow_runs (id, agent_run_id, model_extractor_version, deterministic_claims_json, model_claims_json, agreement_rate, cost_cents)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)`,
    [newId("shadow"), input.agentRunId, input.modelExtractorVersion, JSON.stringify(input.deterministicClaims), JSON.stringify(input.modelClaims), input.agreementRate, input.costCents],
  );
}

async function seed() {
  const db = await getDatabase();
  const existing = await db.query<{ id: string }>(`SELECT id FROM extraction_benchmark_runs WHERE is_baseline = TRUE LIMIT 1`);
  if (existing.rows[0]) return;
  const report = await runExtractionBenchmark(new DeterministicExtractor(), goldenCases);
  await recordBenchmarkRun(db, report, { isBaseline: true, promptVersion: "n/a", datasetVersion: GOLDEN_DATASET_VERSION });
  await db.query(
    `INSERT INTO agent_prompts (id, prompt_key, version, template, status, notes, activated_at)
     VALUES ($1,'extract',1,$2,'active','Extraction prompt v1 — used only when the model extractor is enabled. The deterministic extractor uses no prompt.',NOW())
     ON CONFLICT (prompt_key, version) DO NOTHING`,
    [newId("prompt"), "Extract bounded market claims from an untrusted vendor page; emit only the allowlisted predicate vocabulary; abstain when nothing is extractable."],
  );
  await recordExtractorActivation(db, { extractorId: "deterministic-v2", promptVersion: "n/a", reason: "Default authoritative extractor at launch of the control plane.", activatedBy: "system" });
}

export async function ensureAgentControlSeed(): Promise<void> {
  const globals = globalThis as { __vialAgentControlSeed?: Promise<void> };
  if (!globals.__vialAgentControlSeed) {
    globals.__vialAgentControlSeed = seed().catch((error) => {
      globals.__vialAgentControlSeed = undefined;
      throw error;
    });
  }
  return globals.__vialAgentControlSeed;
}

export async function getExtractionControlPlane(): Promise<ExtractionControlPlane> {
  await ensureAgentControlSeed();
  const db = await getDatabase();
  const runs = (await db.query<BenchmarkRunRow>(`SELECT * FROM extraction_benchmark_runs ORDER BY created_at DESC, id DESC`)).rows;
  const latestBaseline = runs.find((r) => r.is_baseline) ?? null;
  const modelRuns = runs.filter((r) => !r.is_baseline && r.extractor_id.startsWith("model-"));
  const latestModelRun = modelRuns[0] ?? null;
  const caseResults = latestBaseline
    ? (await db.query<CaseResultRow>(`SELECT case_name, difficulty, false_negatives, false_positives, correct_abstention FROM extraction_benchmark_case_results WHERE run_id = $1 ORDER BY difficulty DESC, case_name`, [latestBaseline.id])).rows
    : [];
  const prompts = (await db.query<PromptRow>(`SELECT prompt_key, version, status, notes, activated_at FROM agent_prompts ORDER BY prompt_key, version DESC`)).rows;
  const activations = (await db.query<ActivationRow>(`SELECT extractor_id, prompt_version, active, reason, activated_by, created_at FROM extractor_activations ORDER BY created_at DESC LIMIT 20`)).rows;
  const shadowRuns = (await db.query<ShadowRunRow>(`SELECT id, model_extractor_version, agreement_rate, cost_cents, created_at FROM extraction_shadow_runs ORDER BY created_at DESC LIMIT 20`)).rows;
  const shadowCount = Number((await db.query<{ n: string | number }>(`SELECT COUNT(*) n FROM extraction_shadow_runs`)).rows[0]?.n ?? 0);

  const clientAvailable = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const modelApproved = process.env.VIAL_MODEL_EXTRACTOR_APPROVED === "true";
  const mode = process.env.VIAL_EXTRACTOR ?? "deterministic";
  const modelBeatsBaseline = Boolean(latestBaseline && latestModelRun && Number(latestModelRun.f1) > Number(latestBaseline.f1) && Number(latestModelRun.precision) >= Number(latestBaseline.precision));

  return {
    runs,
    latestBaseline,
    latestModelRun,
    modelRuns,
    caseResults,
    prompts,
    activations,
    shadowRuns,
    shadowCount,
    selection: { mode, clientAvailable, modelApproved, resolved: resolveExtractorSelection({ mode, clientAvailable, modelApproved }) },
    modelBeatsBaseline,
  };
}
