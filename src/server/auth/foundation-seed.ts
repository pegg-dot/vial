import type{SqlConnection}from"@/server/db/client";import{hashPassword}from"./password";import type{AccountType,UserRole}from"./types";interface U{id:string;email:string;name:string;type:AccountType;roles:UserRole[];password:string}/**
 * Demo accounts are published fixtures — their passwords are printed in README.md and docs/HANDOFF.md,
 * and one of them (`jon@vialgrade.test`) holds the `administrator` role.
 *
 * The gate used to be an OR: `NODE_ENV !== "production" || VIALGRADE_SEED_DEMO_ACCOUNTS === "true"`.
 * The flag therefore *overrode* the production check rather than narrowing it — and docker-compose.yml
 * set both `NODE_ENV: production` and that flag, so anyone who ran `docker compose up` from this
 * public repository got a real Postgres database seeded with an administrator whose password is in
 * the README. Not a leak of data; a working administrator login, published.
 *
 * Now production is a floor no flag can lift. The single exception is an in-memory PGlite database
 * on a loopback site URL — the e2e harness runs `next start` (which forces NODE_ENV=production)
 * against `memory://`. That combination is already constrained by server/config/env.ts, which
 * refuses `VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS` unless the database really is in memory and the
 * site URL really is loopback. A database that vanishes with the process is not a deployment, so it
 * is the one production-flagged runtime where seeded fixtures cannot outlive the test run.
 */
function ephemeralTestRuntime(){return process.env.VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS==="true"&&process.env.VIALGRADE_PGLITE_MEMORY==="true"&&!process.env.DATABASE_URL?.trim()}
function enabled(){
  if(process.env.NODE_ENV!=="production")return true;
  // Production runtime: both conditions required, never either.
  if(!ephemeralTestRuntime()){
    if(process.env.VIALGRADE_SEED_DEMO_ACCOUNTS==="true")console.warn("[foundation-seed] VIALGRADE_SEED_DEMO_ACCOUNTS is set but ignored: demo accounts are never seeded into a production runtime with a durable database.");
    return false;
  }
  return process.env.VIALGRADE_SEED_DEMO_ACCOUNTS==="true";
}export async function seedProductionFoundation(db:SqlConnection){if(!enabled())return;const users:U[]=[{id:"user:customer:nora",email:"nora@example.test",name:"Nora Chen",type:"customer",roles:["customer"],password:process.env.VIALGRADE_DEMO_CUSTOMER_PASSWORD||"VialGradeDemoCustomer!2026"},{id:"user:seller:marcus",email:"marcus@helixtest.test",name:"Marcus Vale",type:"seller",roles:["seller_owner","seller_finance"],password:process.env.VIALGRADE_DEMO_SELLER_PASSWORD||"VialGradeDemoSeller!2026"},{id:"user:lab:elena",email:"elena@aperture.test",name:"Dr. Elena Voss",type:"laboratory",roles:["laboratory_owner","laboratory_quality"],password:process.env.VIALGRADE_DEMO_LAB_PASSWORD||"VialGradeDemoLaboratory!2026"},{id:"user:staff:jon",email:"jon@vialgrade.test",name:"Jon Bell",type:"staff",roles:["administrator","finance_analyst"],password:process.env.VIALGRADE_DEMO_ADMIN_PASSWORD||"VialGradeDemoAdmin!2026"},{id:"user:staff:maya",email:"maya@vialgrade.test",name:"Maya Ortiz",type:"staff",roles:["reviewer","compliance_analyst"],password:process.env.VIALGRADE_DEMO_REVIEWER_PASSWORD||"VialGradeDemoReviewer!2026"}];for(const u of users){await db.query(`INSERT INTO auth_users(id,email,display_name,account_type,roles,email_verified_at,mfa_enabled) VALUES($1,$2,$3,$4,$5::jsonb,NOW(),$6) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,display_name=EXCLUDED.display_name,account_type=EXCLUDED.account_type,roles=EXCLUDED.roles,updated_at=NOW()`,[u.id,u.email,u.name,u.type,JSON.stringify(u.roles),u.type==="staff"]);const e=await db.query(`SELECT 1 FROM auth_credentials WHERE user_id=$1`,[u.id]);if(!e.rows[0])await db.query(`INSERT INTO auth_credentials(user_id,password_hash) VALUES($1,$2)`,[u.id,await hashPassword(u.password)]);await db.query(`INSERT INTO user_notification_preferences(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[u.id])}}
