process.env.VIAL_PGLITE_MEMORY="true";
process.env.VIAL_SEED_FIXTURES="true";
process.env.VIAL_SEED_DEMO_ACCOUNTS="true";
process.env.VIAL_SESSION_SECRET="seller-ops-audit-session-secret-at-least-32";
process.env.VIAL_PRIVACY_HASH_SECRET="seller-ops-audit-privacy-secret-at-least-32";

const {getDatabase,resetDatabaseForTests}=await import("../src/server/db/client.ts");
const {connectorDefinitions}=await import("../src/server/seller/connectors.ts");
const {matchSellerBusiness,matchSellerProduct}=await import("../src/server/seller/matching.ts");
const {
  ensureSellerOpsSeed,getSellerContext,runCatalogImport,getImportJob,
  createSellerApiToken,authenticateSellerApiToken,createSellerWebhookEndpoint,
  testSellerWebhookEndpoint
}=await import("../src/server/seller/ops.ts");

const failures=[];
try{
  await resetDatabaseForTests();
  globalThis.__vialSellerOpsSeedPromise=undefined;
  await ensureSellerOpsSeed();
  const db=await getDatabase();
  const version=Number((await db.query(`SELECT MAX(version) version FROM schema_migrations`)).rows[0]?.version??0);
  if(version<6)failures.push(`Expected schema version 6, got ${version}`);
  if(connectorDefinitions.length<7)failures.push(`Expected at least 7 connector definitions, got ${connectorDefinitions.length}`);

  const context=await getSellerContext("marcus@helixtest.test");
  if(!context)failures.push("Demo seller workspace missing");
  if(context && context.integrations.length<7)failures.push("Connector registry was not materialized for seller");
  const rawDimensions=context?.readiness && typeof context.readiness==="object" ? context.readiness.dimensions : [];
  const dimensions=typeof rawDimensions==="string" ? JSON.parse(rawDimensions) : Array.isArray(rawDimensions) ? rawDimensions : [];
  if(dimensions.length!==8)failures.push(`Expected 8 readiness dimensions, got ${dimensions.length}`);

  const productMatch=await matchSellerProduct({title:"BPC157 Research Vial 10 mg",sku:"AUDIT-BPC10"});
  if(productMatch.status!=="auto_matched"||productMatch.compoundName!=="BPC-157")failures.push("Canonical product matching failed for BPC157 alias");
  const profile=context?.profile && typeof context.profile==="object" ? context.profile : undefined;
  const businessMatches=await matchSellerBusiness({name:String(profile?.display_name??""),websiteUrl:String(profile?.website_url??"")});
  if(!businessMatches.length||businessMatches[0].score<0.8)failures.push("Existing seller profile matching did not return a strong proposal");

  if(context){
    const first=await runCatalogImport({sellerId:context.sellerId,provider:"csv",actorId:"seller-ops-audit"});
    const second=await runCatalogImport({sellerId:context.sellerId,provider:"csv",actorId:"seller-ops-audit"});
    if(!second?.idempotent)failures.push("Catalog dry-run import is not idempotent");
    const jobId=String(first?.job && typeof first.job==="object" ? first.job.id : "");
    const job=jobId?await getImportJob(jobId,context.sellerId):null;
    if(!job||job.rows.length<3)failures.push("Catalog import did not produce reviewable rows");

    const token=await createSellerApiToken({sellerId:context.sellerId,name:"Seller ops audit",scopes:["seller:read","catalog:read","catalog:propose","evidence:read","evidence:propose"],actorId:"seller-ops-audit"});
    const authenticated=await authenticateSellerApiToken(token.token);
    if(authenticated?.sellerId!==context.sellerId||!authenticated.scopes.includes("catalog:propose"))failures.push("Scoped seller token authentication failed");

    const endpoint=await createSellerWebhookEndpoint({sellerId:context.sellerId,url:"https://seller-audit.example.test/vial-events",events:["catalog.import.completed","evidence.link.updated"]});
    const delivery=await testSellerWebhookEndpoint({sellerId:context.sellerId,endpointId:endpoint.id});
    if(delivery.status!=="sandbox_delivered")failures.push("Webhook sandbox delivery failed");

    const evidenceCount=Number((await db.query(`SELECT COUNT(*) count FROM seller_evidence_documents WHERE seller_id=$1`,[context.sellerId])).rows[0]?.count??0);
    if(evidenceCount<1)failures.push("Seller evidence workspace is empty");
    const publishedCount=Number((await db.query(`SELECT COUNT(*) count FROM seller_products WHERE seller_id=$1 AND status IN ('published','active')`,[context.sellerId])).rows[0]?.count??0);
    if(publishedCount>0)failures.push("Seller import or evidence workflow published products automatically");
  }

  if(failures.length){console.error("Seller operating-system audit failed:\n- "+failures.join("\n- "));process.exitCode=1;}
  else console.log(`Seller operating-system audit passed: ${connectorDefinitions.length} connectors, 8 readiness dimensions, canonical matching, idempotent dry-run import, evidence workspace, scoped API token, webhook sandbox, and proposal-only publication controls.`);
}finally{
  await resetDatabaseForTests();
  globalThis.__vialSellerOpsSeedPromise=undefined;
}
