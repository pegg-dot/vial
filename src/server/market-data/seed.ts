import type { QueryResultRow } from "pg";
import type { SqlConnection } from "@/server/db/client";
import { rebuildCanonicalGraph } from "./graph";
import { seedBenchmarkProgram, runParserBenchmark } from "./benchmarks";
import { recomputeFreshness, recomputeSourceReliability, seedFreshnessPolicies } from "./quality";
import { rebuildSearchIndex, seedSearchEvaluations, seedSearchSynonyms } from "@/server/search/engine";

export async function seedMarketDataEngine(db:SqlConnection){
 await rebuildCanonicalGraph(db);
 await seedFreshnessPolicies(db);
 await seedBenchmarkProgram(db);
 await seedSearchSynonyms(db);
 await rebuildSearchIndex(db);
 const sources=await db.query<QueryResultRow & {source_id:string;parser_profile:string}>(`SELECT source_id,parser_profile FROM source_refresh_policies`);
 for(const source of sources.rows)await db.query(`INSERT INTO source_pilots(id,source_id,program_status,legal_scope,parser_contract_id,reviewer_owner,freshness_slo_minutes,reliability_target,promotion_gate) VALUES($1,$2,'sandbox','fictional-fixture-only',$3,'data-quality-team',360,0.98,$4::jsonb) ON CONFLICT(source_id) DO UPDATE SET parser_contract_id=EXCLUDED.parser_contract_id,updated_at=NOW()`,[`pilot:${source.source_id}`,source.source_id,`parser:${source.parser_profile}:v2`,JSON.stringify({minimumExamples:25,minimumF1:0.95,maxCorrectionRate:0.02,requiresCounselApproval:true})]);
 const benchmarkCount=await db.query<QueryResultRow & {count:string|number}>(`SELECT COUNT(*) count FROM benchmark_runs`);if(Number(benchmarkCount.rows[0]?.count??0)===0)await runParserBenchmark('catalog',db);
 const searchEvalCount=await db.query<QueryResultRow & {count:string|number}>(`SELECT COUNT(*) count FROM search_evaluations`);if(Number(searchEvalCount.rows[0]?.count??0)===0)await seedSearchEvaluations(db);
 await recomputeFreshness(db);
 const reliabilityCount=await db.query<QueryResultRow & {count:string|number}>(`SELECT COUNT(*) count FROM source_reliability_snapshots`);if(Number(reliabilityCount.rows[0]?.count??0)===0)await recomputeSourceReliability(db);
 await db.query(`INSERT INTO confidence_models(id,model_key,version,status,calibration_bins,expected_calibration_error,sample_count) VALUES('confidence:extractor:v1','deterministic-claim-extractor',1,'active',$1::jsonb,0.041,140) ON CONFLICT(model_key,version) DO NOTHING`,[JSON.stringify([{min:0.6,max:0.7,observedAccuracy:0.64,count:18},{min:0.7,max:0.8,observedAccuracy:0.76,count:31},{min:0.8,max:0.9,observedAccuracy:0.86,count:47},{min:0.9,max:1,observedAccuracy:0.95,count:44}])]);
}
