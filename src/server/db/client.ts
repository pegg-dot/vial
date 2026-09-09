import type { PGlite as PGliteClient } from "@electric-sql/pglite";import{Pool,type PoolClient,type QueryResultRow}from"pg";import{mkdir}from"node:fs/promises";import path from"node:path";import{runMigrations}from"./migrations";import{seedDatabase}from"./seed";import{seedProductionFoundation}from"@/server/auth/foundation-seed";import{ensureOwnerAdmin}from"@/server/auth/owner-admin";import{seedMarketDataEngine}from"@/server/market-data/seed";import{seedConsumerIntelligence}from"@/server/consumer-intelligence/seed";import{ensureSearchIndex}from"@/server/search/engine";import{ensureCompoundLiterature}from"./compound-literature-seed";import{normalizePostgresUrl}from"./postgres-url";
import{ensureCuratedNews}from"./curated-news-seed";
export interface SqlResult<T extends QueryResultRow=QueryResultRow>{rows:T[];rowCount?:number|null}export interface SqlConnection{query<T extends QueryResultRow=QueryResultRow>(text:string,params?:unknown[]):Promise<SqlResult<T>>}interface DatabaseAdapter extends SqlConnection{readonly dialect:"postgres"|"pglite";transaction<T>(work:(tx:SqlConnection)=>Promise<T>):Promise<T>;close():Promise<void>}
class PGliteAdapter implements DatabaseAdapter{readonly dialect="pglite" as const;private tail:Promise<void>=Promise.resolve();constructor(private client:PGliteClient){}private exclusive<T>(work:()=>Promise<T>){const result=this.tail.then(work,work);this.tail=result.then(()=>undefined,()=>undefined);return result}async query<T extends QueryResultRow=QueryResultRow>(text:string,params:unknown[]=[]){return this.exclusive(async()=>{const r=await this.client.query<T>(text,params);return{rows:r.rows,rowCount:r.affectedRows??r.rows.length}})}async transaction<T>(work:(tx:SqlConnection)=>Promise<T>){return this.exclusive(()=>this.client.transaction(async t=>work({query:async<R extends QueryResultRow=QueryResultRow>(text:string,params:unknown[]=[])=>{const r=await t.query<R>(text,params);return{rows:r.rows,rowCount:r.affectedRows??r.rows.length}}})))}async close(){await this.tail;await this.client.close()}}
class PgAdapter implements DatabaseAdapter{readonly dialect="postgres" as const;constructor(private pool:Pool){}async query<T extends QueryResultRow=QueryResultRow>(text:string,params:unknown[]=[]){const r=await this.pool.query<T>(text,params);return{rows:r.rows,rowCount:r.rowCount}}async transaction<T>(work:(tx:SqlConnection)=>Promise<T>){const c=await this.pool.connect();try{await c.query("BEGIN");const v=await work(new PgTx(c));await c.query("COMMIT");return v}catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}}async close(){await this.pool.end()}}
class PgTx implements SqlConnection{constructor(private c:PoolClient){}async query<T extends QueryResultRow=QueryResultRow>(text:string,params:unknown[]=[]){const r=await this.c.query<T>(text,params);return{rows:r.rows,rowCount:r.rowCount}}}
declare global{var __vialDbPromise:Promise<DatabaseAdapter>|undefined}
/**
 * Which database should this process open?
 *
 * Pure and exported so the decision can be tested directly. It used to be inline, which meant the
 * only way to exercise it was to mutate process.env inside a test runner that also sets these vars
 * — so the branch that mattered was never actually covered.
 */
export interface DatabaseEnv {
  DATABASE_URL?: string | undefined;
  VIALGRADE_PGLITE_MEMORY?: string | undefined;
  VIALGRADE_PGLITE_PATH?: string | undefined;
}

export function databaseChoice(env: DatabaseEnv = process.env as DatabaseEnv):
  | { kind: "postgres"; url: string }
  | { kind: "memory" }
  | { kind: "file"; dir: string } {
  const url = env.DATABASE_URL?.trim();
  const wantsMemory = env.VIALGRADE_PGLITE_MEMORY === "true";
  // Both readings of this pair are bad. Preferring DATABASE_URL points an isolated test run at
  // whatever that is — on a deploy machine, production. Preferring memory would serve a live site
  // from an empty database. DATABASE_URL was checked first, so it was the first of those, and the
  // integration runner spread process.env into its children without stripping it.
  if (url && wantsMemory) {
    throw new Error(
      "Refusing to open a database: VIALGRADE_PGLITE_MEMORY=true asks for an isolated in-memory database, but DATABASE_URL is also set. Unset one. Tests must never reach a real database.",
    );
  }
  if (url) return { kind: "postgres", url };
  if (wantsMemory) return { kind: "memory" };
  return { kind: "file", dir: env.VIALGRADE_PGLITE_PATH?.trim() || path.join(process.cwd(), ".data", "pglite") };
}

async function createAdapter():Promise<DatabaseAdapter>{const choice=databaseChoice();
if(choice.kind==="postgres")return new PgAdapter(new Pool({connectionString:normalizePostgresUrl(choice.url),max:Number(process.env.DATABASE_POOL_MAX??5),ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:true}:undefined}));
const d=choice.kind==="memory"?"memory://":choice.dir;if(d!=="memory://")await mkdir(d,{recursive:true});const{PGlite}=await import("@electric-sql/pglite");return new PGliteAdapter(new PGlite(d))}
async function initialize(a:DatabaseAdapter){const version=await a.transaction(async tx=>{if(a.dialect==="postgres")await tx.query(`SELECT pg_advisory_xact_lock($1)`,[7031042026]);return runMigrations(tx)});const seed=process.env.VIALGRADE_SEED_FIXTURES==="false"?false:(process.env.NODE_ENV!=="production"||process.env.VIALGRADE_SEED_FIXTURES==="true");if(seed)await seedDatabase(a);await seedProductionFoundation(a);await ensureOwnerAdmin(a);await ensureCompoundLiterature(a);await ensureCuratedNews(a);if(seed)await seedMarketDataEngine(a);if(seed)await seedConsumerIntelligence(a);await ensureSearchIndex(a);await a.query(`INSERT INTO app_meta(key,value,updated_at) VALUES('schema_version',$1::jsonb,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,[JSON.stringify({version,appliedAt:new Date().toISOString()})])}
export async function getDatabase(){if(!globalThis.__vialDbPromise)globalThis.__vialDbPromise=(async()=>{const a=await createAdapter();await initialize(a);return a})();return globalThis.__vialDbPromise}export async function withTransaction<T>(work:(tx:SqlConnection)=>Promise<T>){return(await getDatabase()).transaction(work)}export async function resetDatabaseForTests(){const c=globalThis.__vialDbPromise;globalThis.__vialDbPromise=undefined;if(c)try{await(await c).close()}catch{}}
