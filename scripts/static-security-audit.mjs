import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
const root=process.cwd();const failures=[];
async function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())out.push(...await files(p));else out.push(p)}return out}
const source=await files(path.join(root,"src"));
const proxy=await readFile(path.join(root,"src/proxy.ts"),"utf8");
const policy=await readFile(path.join(root,"src/server/auth/access-policy.ts"),"utf8");
if(!proxy.includes('decodeSessionEnvelope')||!proxy.includes('accessDecision')||!policy.includes('path.startsWith("/admin")'))failures.push("Central proxy does not visibly protect /admin routes with signed sessions.");
for(const file of source.filter(f=>f.includes(`${path.sep}app${path.sep}admin${path.sep}`)&&f.endsWith(`${path.sep}page.tsx`)&&!f.endsWith(`${path.sep}login${path.sep}page.tsx`))){const text=await readFile(file,"utf8");if(!/requireStaff|requirePermission/.test(text))failures.push(`Missing server-side defense-in-depth guard: ${path.relative(root,file)}`)}
for(const file of source.filter(f=>f.includes(`${path.sep}app${path.sep}api${path.sep}`)&&f.endsWith("route.ts"))){const text=await readFile(file,"utf8");if(!/export async function (POST|PUT|PATCH|DELETE)/.test(text))continue;const relative=path.relative(root,file);if(relative.includes("/auth/login/")||relative.includes("/auth/logout/"))continue;const sessionAuthorized=/requireApiPrincipal|requireApiPermission|requireApiSellerPermission|requireSellerBearerScope|requireApiLaboratoryPermission|requireLaboratoryBearerScope|authorized\(/.test(text);const providerSigned=/ingestProviderWebhook/.test(text)&&/signature/.test(text)&&/secret/.test(text);if(!sessionAuthorized&&!providerSigned)failures.push(`Mutation route lacks a visible authorization gate: ${relative}`)}
for(const file of source.filter(f=>/\.(ts|tsx|js|jsx)$/.test(f))){const text=await readFile(file,"utf8");const relative=path.relative(root,file);if(/\beval\s*\(|new Function\s*\(/.test(text))failures.push(`Dynamic code execution found: ${relative}`);if(text.includes("dangerouslySetInnerHTML")&&!text.includes('JSON.stringify')&&!text.includes('replace(/</g'))failures.push(`Unreviewed raw HTML sink: ${relative}`)}
const envelope=await readFile(path.join(root,"src/server/auth/session-envelope.ts"),"utf8");if(!envelope.includes('timingSafeEqual')||!envelope.includes('SESSION_TTL_SECONDS'))failures.push("Session envelope is missing timing-safe verification or lifetime enforcement.");
const env=await readFile(path.join(root,"src/server/config/env.ts"),"utf8");if(!env.includes('Missing production environment variables'))failures.push("Production environment validation is not fail-closed.");
if(failures.length){console.error("Static security audit failed:\n- "+failures.join("\n- "));process.exit(1)}
console.log(`Static security audit passed across ${source.length} source files.`);
