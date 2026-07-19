import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const databasePath = mkdtempSync(join(tmpdir(), "vial-lab-mcp-db-"));
const baseEnv = {
  ...process.env,
  VIAL_PGLITE_MEMORY: "false",
  VIAL_PGLITE_PATH: databasePath,
  VIAL_SEED_FIXTURES: "true",
  VIAL_SEED_DEMO_ACCOUNTS: "true",
  VIAL_SESSION_SECRET: "lab-mcp-audit-session-secret-at-least-32",
  VIAL_PRIVACY_HASH_SECRET: "lab-mcp-audit-privacy-secret-at-least-32",
};
Object.assign(process.env, baseEnv);

const { resetDatabaseForTests, getDatabase } = await import("../src/server/db/client.ts");
const { ensureEvidenceNetworkSeed, getLaboratoryContext, createLaboratoryApiToken } = await import("../src/server/evidence-network/repository.ts");

let transport;
let stderrOutput = "";
try {
  await resetDatabaseForTests();
  globalThis.__vialEvidenceSeedPromise = undefined;
  await ensureEvidenceNetworkSeed();
  const context = await getLaboratoryContext("elena@aperture.test");
  if (!context) throw new Error("Demo laboratory workspace missing");
  const token = await createLaboratoryApiToken({ laboratoryId: String(context.lab.id), label: "MCP audit", scopes: ["lab:read", "lab:propose"], actorId: "lab-mcp-audit" });
  const sample = context.samples[0];
  const order = context.orders.find((row) => String(row.id) === String(sample.test_order_id)) ?? context.orders[0];
  const run = context.runs.find((row) => String(row.sample_id) === String(sample.id)) ?? context.runs[0];
  await resetDatabaseForTests();
  globalThis.__vialEvidenceSeedPromise = undefined;

  const client = new Client({ name: "vial-lab-mcp-audit", version: "6.0.0" }, { capabilities: {} });
  transport = new StdioClientTransport({
    command: process.execPath,
    args: ["node_modules/tsx/dist/cli.mjs", "mcp/lab-server.ts"],
    cwd: process.cwd(),
    env: { ...baseEnv, VIAL_MCP_LAB_TOKEN: token.token },
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => { stderrOutput += chunk.toString(); });
  await client.connect(transport);
  const tools = await client.listTools();
  const names = new Set(tools.tools.map((tool) => tool.name));
  for (const required of ["get_lab_status", "list_test_orders", "list_methods", "get_sample_custody", "prepare_result_proposal", "prepare_report_draft"]) {
    if (!names.has(required)) throw new Error(`Laboratory MCP tool ${required} is missing`);
  }
  const status = await client.callTool({ name: "get_lab_status", arguments: {} });
  if (status.isError || !JSON.stringify(status.structuredContent ?? status.content).includes("Aperture")) throw new Error("Laboratory status tool failed");
  const methods = await client.callTool({ name: "list_methods", arguments: {} });
  if (methods.isError || !JSON.stringify(methods.structuredContent ?? methods.content).includes("LC-MS")) throw new Error("Method scope tool failed");
  const custody = await client.callTool({ name: "get_sample_custody", arguments: { sampleId: String(sample.id) } });
  if (custody.isError || custody.structuredContent?.verification?.valid !== true) throw new Error(`Custody verification tool failed: ${JSON.stringify(custody.structuredContent ?? custody.content)}`);
  const resultProposal = await client.callTool({ name: "prepare_result_proposal", arguments: { runId: String(run.id), dimension: "identity", analyte: "BPC-157", resultType: "categorical", valueText: "Identity consistent", conclusion: "established" } });
  if (resultProposal.isError || !JSON.stringify(resultProposal.structuredContent ?? resultProposal.content).includes("approvalRequired")) throw new Error("Result proposal did not remain proposal-only");
  const reportProposal = await client.callTool({ name: "prepare_report_draft", arguments: { testOrderId: String(order.id), sampleId: String(sample.id), reportNumber: "MCP-DRAFT-001", summary: "MCP audit report draft" } });
  if (reportProposal.isError || !JSON.stringify(reportProposal.structuredContent ?? reportProposal.content).includes("approvalRequired")) throw new Error("Report draft did not remain proposal-only");
  await client.close();
  transport = undefined;

  Object.assign(process.env, baseEnv);
  globalThis.__vialEvidenceSeedPromise = undefined;
  const db = await getDatabase();
  const proposalCount = Number((await db.query(`SELECT COUNT(*) count FROM laboratory_work_proposals WHERE laboratory_id=$1`, [String(context.lab.id)])).rows[0]?.count ?? 0);
  const issuedByMcp = Number((await db.query(`SELECT COUNT(*) count FROM laboratory_reports WHERE issued_by LIKE 'mcp:%'`)).rows[0]?.count ?? 0);
  if (proposalCount < 2) throw new Error(`Expected two MCP proposals, found ${proposalCount}`);
  if (issuedByMcp > 0) throw new Error("MCP directly issued a report");
  console.log(`Laboratory MCP audit passed: ${tools.tools.length} scoped tools listed, status/method/custody reads succeeded, and result/report automation remained proposal-only.`);
} catch (error) {
  if (stderrOutput) console.error(`Laboratory MCP server stderr:\n${stderrOutput}`);
  throw error;
} finally {
  if (transport) await transport.close().catch(() => {});
  await resetDatabaseForTests().catch(() => {});
  globalThis.__vialEvidenceSeedPromise = undefined;
  rmSync(databasePath, { recursive: true, force: true });
}
