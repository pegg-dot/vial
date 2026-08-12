import { afterAll, describe, expect, it } from "vitest";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";

const env=process.env as Record<string,string|undefined>;
describe("embedded backup and restore drill",()=>{
 let root="";
 afterAll(async()=>{await resetDatabaseForTests();if(root)await rm(root,{recursive:true,force:true})});
 it("restores the complete database directory after a corruption marker",async()=>{
  root=await mkdtemp(path.join(os.tmpdir(),"vial-backup-drill-"));const live=path.join(root,"live"),backup=path.join(root,"backup");
  Object.assign(env,{VIALGRADE_PGLITE_MEMORY:"false",VIALGRADE_PGLITE_PATH:live,VIALGRADE_SEED_FIXTURES:"true",VIALGRADE_SEED_DEMO_ACCOUNTS:"true"});
  await resetDatabaseForTests();let db=await getDatabase();
  await db.query(`INSERT INTO app_meta(key,value) VALUES('backup_drill',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,[JSON.stringify({state:"original"})]);
  const before=await db.query<{count:number|string}>(`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public'`);expect(Number(before.rows[0]?.count)).toBeGreaterThan(50);
  await resetDatabaseForTests();await cp(live,backup,{recursive:true});await writeFile(path.join(root,"manifest.json"),JSON.stringify({tables:Number(before.rows[0]?.count)}));
  db=await getDatabase();await db.query(`UPDATE app_meta SET value=$1::jsonb WHERE key='backup_drill'`,[JSON.stringify({state:"corrupted"})]);await db.query(`DELETE FROM user_watchlists`);await resetDatabaseForTests();
  await rm(live,{recursive:true,force:true});await cp(backup,live,{recursive:true});
  db=await getDatabase();const restored=await db.query<{value:{state:string}|string}>(`SELECT value FROM app_meta WHERE key='backup_drill'`);const value=typeof restored.rows[0]?.value==="string"?JSON.parse(restored.rows[0].value):restored.rows[0]?.value;expect(value?.state).toBe("original");
  const manifest=JSON.parse(await readFile(path.join(root,"manifest.json"),"utf8")) as {tables:number};const after=await db.query<{count:number|string}>(`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public'`);expect(Number(after.rows[0]?.count)).toBe(manifest.tables);
 });
});
