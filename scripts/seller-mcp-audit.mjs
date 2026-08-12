import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const databasePath = mkdtempSync(join(tmpdir(), "vial-mcp-db-"));
const baseEnv = {
  ...process.env,
  VIALGRADE_PGLITE_MEMORY: "false",
  VIALGRADE_PGLITE_PATH: databasePath,
  VIALGRADE_SEED_FIXTURES: "true",
  VIALGRADE_SEED_DEMO_ACCOUNTS: "true",
  VIALGRADE_SESSION_SECRET: "seller-mcp-audit-session-secret-at-least-32",
  VIALGRADE_PRIVACY_HASH_SECRET: "seller-mcp-audit-privacy-secret-at-least-32",
};
Object.assign(process.env, baseEnv);

const { resetDatabaseForTests } = await import("../src/server/db/client.ts");
const { ensureSellerOpsSeed, getSellerContext, createSellerApiToken } = await import("../src/server/seller/ops.ts");

let transport;
let stderrOutput = "";
try {
  await resetDatabaseForTests();
  globalThis.__vialSellerOpsSeedPromise = undefined;
  await ensureSellerOpsSeed();
  const context = await getSellerContext("marcus@helixtest.test");
  if (!context) throw new Error("Demo seller workspace missing");
  const token = await createSellerApiToken({
    sellerId: context.sellerId,
    name: "MCP audit",
    scopes: ["seller:read", "catalog:read", "catalog:propose", "evidence:read", "evidence:propose"],
    actorId: "seller-mcp-audit",
  });
  await resetDatabaseForTests();
  globalThis.__vialSellerOpsSeedPromise = undefined;

  const client = new Client({ name: "vial-mcp-audit", version: "4.0.0" }, { capabilities: {} });
  transport = new StdioClientTransport({
    command: process.execPath,
    args: ["node_modules/tsx/dist/cli.mjs", "mcp/seller-server.ts"],
    cwd: process.cwd(),
    env: { ...baseEnv, VIALGRADE_MCP_SELLER_TOKEN: token.token },
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => { stderrOutput += chunk.toString(); });
  await client.connect(transport);
  const tools = await client.listTools();
  const names = new Set(tools.tools.map((tool) => tool.name));
  for (const required of ["get_onboarding_status", "list_catalog", "match_product", "list_evidence_gaps", "prepare_catalog_import", "prepare_evidence_document"]) {
    if (!names.has(required)) throw new Error(`MCP tool ${required} is missing`);
  }
  const status = await client.callTool({ name: "get_onboarding_status", arguments: {} });
  if (status.isError) throw new Error("MCP onboarding status tool returned an error");
  const match = await client.callTool({ name: "match_product", arguments: { title: "BPC157 Research Vial 10 mg", sku: "MCP-AUDIT" } });
  if (match.isError || !JSON.stringify(match.structuredContent ?? match.content).includes("BPC-157")) throw new Error("MCP product matching did not resolve BPC-157");
  const proposal = await client.callTool({
    name: "prepare_catalog_import",
    arguments: { provider: "csv", rows: [{ title: "GHK-Cu 50 mg", sku: "MCP-GHK50", price: 63, inventory: 5 }] },
  });
  if (proposal.isError || !JSON.stringify(proposal.structuredContent ?? proposal.content).includes("approvalRequired")) throw new Error("MCP catalog proposal was not created");
  await client.close();
  transport = undefined;
  console.log(`Seller MCP audit passed: ${tools.tools.length} scoped tools listed, read tools responded, canonical matching succeeded, and catalog automation remained proposal-only.`);
} catch (error) {
  if (stderrOutput) console.error(`MCP server stderr:\n${stderrOutput}`);
  throw error;
} finally {
  if (transport) await transport.close().catch(() => {});
  await resetDatabaseForTests().catch(() => {});
  globalThis.__vialSellerOpsSeedPromise = undefined;
  rmSync(databasePath, { recursive: true, force: true });
}
