import { spawnSync } from "node:child_process";
const result=spawnSync(process.execPath,["./node_modules/vitest/vitest.mjs","run","tests/integration/backup-restore.test.ts","--maxWorkers=1","--no-file-parallelism"],{stdio:"inherit",env:{...process.env,VIAL_SESSION_SECRET:"backup-drill-session-secret-at-least-32-characters",VIAL_PRIVACY_HASH_SECRET:"backup-drill-privacy-secret-at-least-32-characters",VIAL_SEED_FIXTURES:"true",VIAL_SEED_DEMO_ACCOUNTS:"true"}});
process.exit(result.status??1);
