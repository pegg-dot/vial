import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { combinedSimilarity, normalizeTerm } from "./normalize";

export type CanonicalEntityType = "organization" | "compound" | "product" | "listing" | "source" | "laboratory" | "batch" | "method" | "report" | "evidence_dimension";

interface EntityRow extends QueryResultRow {
  id: string;
  entity_type: CanonicalEntityType;
  canonical_key: string;
  display_name: string;
  normalized_name: string;
  status: string;
  attributes: unknown;
}

function stableId(type: CanonicalEntityType, key: string) {
  return `entity:${type}:${key}`;
}

async function upsertEntity(db: SqlConnection, input: {type: CanonicalEntityType; key: string; name: string; sourceType?: string; sourceId?: string; attributes?: Record<string, unknown>}) {
  const id = stableId(input.type, input.key);
  await db.query(
    `INSERT INTO canonical_entities
     (id,entity_type,canonical_key,display_name,normalized_name,attributes,source_entity_type,source_entity_id)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
     ON CONFLICT(entity_type,canonical_key) DO UPDATE SET
       display_name=EXCLUDED.display_name,
       normalized_name=EXCLUDED.normalized_name,
       attributes=canonical_entities.attributes || EXCLUDED.attributes,
       source_entity_type=COALESCE(EXCLUDED.source_entity_type,canonical_entities.source_entity_type),
       source_entity_id=COALESCE(EXCLUDED.source_entity_id,canonical_entities.source_entity_id),
       updated_at=NOW()`,
    [id,input.type,input.key,input.name,normalizeTerm(input.name),JSON.stringify(input.attributes ?? {}),input.sourceType ?? null,input.sourceId ?? null],
  );
  return id;
}

async function addAlias(db: SqlConnection, entityId: string, alias: string, aliasType = "common", source = "catalog", confidence = 1) {
  const normalized = normalizeTerm(alias);
  if (!normalized) return;
  await db.query(
    `INSERT INTO entity_aliases(id,entity_id,alias,normalized_alias,alias_type,source,confidence)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(entity_id,normalized_alias) DO UPDATE SET confidence=GREATEST(entity_aliases.confidence,EXCLUDED.confidence),active=TRUE`,
    [`alias:${entityId}:${normalized.replace(/\s+/g,"-")}`,entityId,alias,normalized,aliasType,source,confidence],
  );
}

async function relate(db: SqlConnection, from: string, relation: string, to: string, confidence = 1, evidence: Record<string, unknown> = {}) {
  await db.query(
    `INSERT INTO entity_relationships(id,from_entity_id,relation_type,to_entity_id,confidence,evidence)
     VALUES($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT(from_entity_id,relation_type,to_entity_id) DO UPDATE SET confidence=EXCLUDED.confidence,evidence=EXCLUDED.evidence,status='confirmed',valid_to=NULL`,
    [`rel:${from}:${relation}:${to}`,from,relation,to,confidence,JSON.stringify(evidence)],
  );
}

export async function rebuildCanonicalGraph(connection?: SqlConnection) {
  const db = connection ?? await getDatabase();
  const [organizations,compounds,products,listings,sources] = await Promise.all([
    db.query<QueryResultRow & {id:string;slug:string;display_name:string;aliases:unknown;domains:unknown;organization_type:string}>(`SELECT id,slug,display_name,aliases,domains,organization_type FROM organizations`),
    db.query<QueryResultRow & {id:string;slug:string;canonical_name:string;aliases:unknown;category:string}>(`SELECT id,slug,canonical_name,aliases,category FROM compounds`),
    db.query<QueryResultRow & {id:string;slug:string;name:string;vendor_id:string;compound_id:string;declared_quantity:string;declared_form:string}>(`SELECT id,slug,name,vendor_id,compound_id,declared_quantity,declared_form FROM products`),
    db.query<QueryResultRow & {id:string;slug:string;product_id:string;batch_code:string;report_issuer:string;report_date:string;source_id:string|null;evidence:unknown}>(`SELECT id,slug,product_id,batch_code,report_issuer,report_date,source_id,evidence FROM listings`),
    db.query<QueryResultRow & {id:string;canonical_location:string;label:string;source_type:string;owner_organization_id:string|null}>(`SELECT id,canonical_location,label,source_type,owner_organization_id FROM sources`),
  ]);
  const map = new Map<string,string>();
  for (const row of organizations.rows) {
    const id = await upsertEntity(db,{type:"organization",key:row.slug,name:row.display_name,sourceType:"organization",sourceId:row.id,attributes:{organizationType:row.organization_type,domains:row.domains}});
    map.set(row.id,id); await addAlias(db,id,row.display_name,"official");
    for (const alias of Array.isArray(row.aliases)?row.aliases:[]) if (typeof alias === "string") await addAlias(db,id,alias);
  }
  for (const row of compounds.rows) {
    const id = await upsertEntity(db,{type:"compound",key:row.slug,name:row.canonical_name,sourceType:"compound",sourceId:row.id,attributes:{category:row.category}});
    map.set(row.id,id); await addAlias(db,id,row.canonical_name,"official");
    for (const alias of Array.isArray(row.aliases)?row.aliases:[]) if (typeof alias === "string") await addAlias(db,id,alias);
  }
  for (const row of products.rows) {
    const id = await upsertEntity(db,{type:"product",key:row.slug,name:`${row.name} ${row.declared_quantity}`,sourceType:"product",sourceId:row.id,attributes:{quantity:row.declared_quantity,form:row.declared_form}});
    map.set(row.id,id); await addAlias(db,id,row.name,"label");
    if (map.get(row.vendor_id)) await relate(db,id,"sold_by",map.get(row.vendor_id)!);
    if (map.get(row.compound_id)) await relate(db,id,"contains",map.get(row.compound_id)!);
  }
  for (const row of listings.rows) {
    const listingId = await upsertEntity(db,{type:"listing",key:row.slug,name:row.slug.replace(/-/g," "),sourceType:"listing",sourceId:row.id});
    map.set(row.id,listingId); if (map.get(row.product_id)) await relate(db,listingId,"offers",map.get(row.product_id)!);
    if (row.batch_code && row.batch_code !== "Not declared") {
      const batchId=await upsertEntity(db,{type:"batch",key:normalizeTerm(row.batch_code).replace(/ /g,"-"),name:row.batch_code,attributes:{declared:true}});
      await relate(db,listingId,"declares_batch",batchId,0.9);
    }
    if (row.report_issuer && row.report_issuer !== "Not displayed") {
      const laboratoryKey=normalizeTerm(row.report_issuer.replace(/\s*\(fictional\)\s*/i,"")).replace(/ /g,"-");
      const labId=await upsertEntity(db,{type:"laboratory",key:laboratoryKey,name:row.report_issuer,attributes:{fictional:row.report_issuer.toLowerCase().includes("fictional")}});
      await addAlias(db,labId,row.report_issuer,"reported"); await relate(db,listingId,"references_laboratory",labId,0.72,{reportDate:row.report_date});
      const reportKey=`${row.slug}-${normalizeTerm(row.report_date || "undated").replace(/ /g,"-")}`;
      const reportId=await upsertEntity(db,{type:"report",key:reportKey,name:`${row.slug} report · ${row.report_date || "undated"}`,attributes:{reportDate:row.report_date,issuer:row.report_issuer}});
      await relate(db,listingId,"supported_by_report",reportId,0.78);
      await relate(db,reportId,"issued_by",labId,0.72);
      const dimensions=Array.isArray(row.evidence)?row.evidence:[];
      for(const dimension of dimensions){
        if(!dimension||typeof dimension!=="object")continue;
        const record=dimension as {label?:unknown;status?:unknown};
        if(typeof record.label!=="string")continue;
        const dimensionKey=normalizeTerm(record.label).replace(/ /g,"-");
        const dimensionId=await upsertEntity(db,{type:"evidence_dimension",key:dimensionKey,name:record.label,attributes:{kind:"evidence-dimension"}});
        await relate(db,reportId,"addresses_dimension",dimensionId,record.status==="established"?0.9:0.65,{status:record.status});
      }
    }
  }
  for (const row of sources.rows) {
    const id=await upsertEntity(db,{type:"source",key:row.id.replace(/[^a-zA-Z0-9-]/g,"-"),name:row.label,sourceType:"source",sourceId:row.id,attributes:{location:row.canonical_location,sourceType:row.source_type}});
    map.set(row.id,id); if (row.owner_organization_id && map.get(row.owner_organization_id)) await relate(db,id,"owned_by",map.get(row.owner_organization_id)!,0.95);
  }
  return {entities:organizations.rows.length+compounds.rows.length+products.rows.length+listings.rows.length+sources.rows.length};
}

export async function resolveEntityLabel(rawLabel: string, type?: CanonicalEntityType) {
  const db=await getDatabase();
  const rows=await db.query<EntityRow & {aliases:unknown}>(`SELECT e.*,COALESCE(json_agg(a.alias) FILTER(WHERE a.alias IS NOT NULL),'[]'::json) aliases FROM canonical_entities e LEFT JOIN entity_aliases a ON a.entity_id=e.id AND a.active=TRUE WHERE ($1::text IS NULL OR e.entity_type=$1) GROUP BY e.id`,[type ?? null]);
  const ranked=rows.rows.map(row=>{const aliases=Array.isArray(row.aliases)?row.aliases.filter((v):v is string=>typeof v==="string"):[];const labels=[row.display_name,...aliases];const score=Math.max(...labels.map(label=>combinedSimilarity(rawLabel,label)));return {entity:row,score,matchedOn:labels.sort((a,b)=>combinedSimilarity(rawLabel,b)-combinedSimilarity(rawLabel,a))[0]};}).sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  return {best:best ?? null,candidates:ranked.slice(0,5)};
}

export async function getEntityGraphSummary() {
  const db=await getDatabase();
  const [types,relations,pending]=await Promise.all([
    db.query<QueryResultRow & {entity_type:string;count:string|number}>(`SELECT entity_type,COUNT(*) count FROM canonical_entities GROUP BY entity_type ORDER BY count DESC`),
    db.query<QueryResultRow & {relation_type:string;count:string|number}>(`SELECT relation_type,COUNT(*) count FROM entity_relationships WHERE status='confirmed' GROUP BY relation_type ORDER BY count DESC`),
    db.query<QueryResultRow & {count:string|number}>(`SELECT COUNT(*) count FROM entity_resolution_cases WHERE status='pending'`),
  ]);
  return {types:types.rows.map(row=>({type:row.entity_type,count:Number(row.count)})),relations:relations.rows.map(row=>({type:row.relation_type,count:Number(row.count)})),pending:Number(pending.rows[0]?.count??0)};
}

export async function createResolutionCase(input:{subjectType:string;subjectId:string;rawLabel:string;entityType?:CanonicalEntityType}){
  const db=await getDatabase();const resolution=await resolveEntityLabel(input.rawLabel,input.entityType);const id=newId("resolve");
  await db.query(`INSERT INTO entity_resolution_cases(id,subject_type,subject_id,raw_label,normalized_label,candidate_entity_id,match_score,match_method,status,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,'hybrid-normalized-trigram',$8,$9::jsonb)`,[id,input.subjectType,input.subjectId,input.rawLabel,normalizeTerm(input.rawLabel),resolution.best?.entity.id??null,resolution.best?.score??0,resolution.best&&resolution.best.score>=0.94?'auto-confirmed':'pending',JSON.stringify({candidates:resolution.candidates.map(item=>({id:item.entity.id,name:item.entity.display_name,type:item.entity.entity_type,score:item.score,matchedOn:item.matchedOn}))})]);
  return {id,...resolution};
}

export async function getEntityDashboard(){const db=await getDatabase();const [summary,entities,cases,relationships]=await Promise.all([
 getEntityGraphSummary(),
 db.query<QueryResultRow & {id:string;entity_type:string;display_name:string;canonical_key:string;status:string;alias_count:string|number;relationship_count:string|number}>(`SELECT e.id,e.entity_type,e.display_name,e.canonical_key,e.status,COUNT(DISTINCT a.id) alias_count,COUNT(DISTINCT r.id) relationship_count FROM canonical_entities e LEFT JOIN entity_aliases a ON a.entity_id=e.id LEFT JOIN entity_relationships r ON r.from_entity_id=e.id OR r.to_entity_id=e.id GROUP BY e.id ORDER BY relationship_count DESC,e.display_name LIMIT 80`),
 db.query<QueryResultRow & {id:string;subject_type:string;subject_id:string;raw_label:string;match_score:number;match_method:string;status:string;display_name:string|null;created_at:string}>(`SELECT c.*,e.display_name FROM entity_resolution_cases c LEFT JOIN canonical_entities e ON e.id=c.candidate_entity_id ORDER BY c.created_at DESC LIMIT 40`),
 db.query<QueryResultRow & {relation_type:string;from_name:string;to_name:string;confidence:number;status:string}>(`SELECT r.relation_type,f.display_name from_name,t.display_name to_name,r.confidence,r.status FROM entity_relationships r JOIN canonical_entities f ON f.id=r.from_entity_id JOIN canonical_entities t ON t.id=r.to_entity_id ORDER BY r.created_at DESC LIMIT 60`),
 ]);return {summary,entities:entities.rows.map(r=>({...r,alias_count:Number(r.alias_count),relationship_count:Number(r.relationship_count),match_score:undefined})),cases:cases.rows.map(r=>({...r,match_score:Number(r.match_score)})),relationships:relationships.rows.map(r=>({...r,confidence:Number(r.confidence)}))};}
