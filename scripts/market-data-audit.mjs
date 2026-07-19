process.env.VIAL_PGLITE_MEMORY="true";
process.env.VIAL_SEED_FIXTURES="true";
process.env.VIAL_SEED_DEMO_ACCOUNTS="true";
process.env.VIAL_SESSION_SECRET="market-data-audit-session-secret-32-characters";
process.env.VIAL_PRIVACY_HASH_SECRET="market-data-audit-privacy-secret-32-characters";
const {getDatabase,resetDatabaseForTests}=await import("../src/server/db/client.ts");
const {searchMarket}=await import("../src/server/search/engine.ts");
await resetDatabaseForTests();
const db=await getDatabase();
const required=["canonical_entities","entity_relationships","parser_contracts","benchmark_runs","source_pilots","source_reliability_snapshots","data_freshness_status","search_documents","search_evaluations"];
const missing=[];
for(const table of required){const result=await db.query(`SELECT COUNT(*) count FROM ${table}`);const count=Number(result.rows[0]?.count??0);if(count===0)missing.push(`${table} is empty`);}
const cases=[
  ["bpc157","cmp:bpc-157"],
  ["epithalon","cmp:epitalon"],
  ["northstar","org:northstar-research"],
  ["copper tripeptide","cmp:ghk-cu"],
];
for(const [query,expected] of cases){const result=await searchMarket({query,limit:5,log:false});if(!result.results.some(item=>item.entityId===expected))missing.push(`search ${query} did not return ${expected}`);}
const benchmark=await db.query(`SELECT f1,status FROM benchmark_runs ORDER BY created_at DESC LIMIT 1`);if(Number(benchmark.rows[0]?.f1??0)<0.85)missing.push("latest parser F1 below 0.85");
const searchEval=await db.query(`SELECT AVG(reciprocal_rank) mrr,AVG(recall_at_five) recall FROM search_evaluations`);if(Number(searchEval.rows[0]?.mrr??0)<0.7)missing.push("search MRR below 0.70");
if(missing.length){console.error("Market data audit failed:\n- "+missing.join("\n- "));process.exit(1)}
console.log("Market data audit passed: canonical graph, parser benchmarks, source pilots, freshness, reliability, search index, and ranking evaluations are populated.");
await resetDatabaseForTests();
