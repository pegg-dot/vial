#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { getDatabase } from "../src/server/db/client";
import { authenticateSellerApiToken, createEvidenceDocument, proposeEvidenceLinks, runCatalogImport } from "../src/server/seller/ops";
import { matchSellerProduct } from "../src/server/seller/matching";

async function main() {

const rawToken = process.env.VIAL_MCP_SELLER_TOKEN?.trim();
if (!rawToken) {
  console.error("VIAL_MCP_SELLER_TOKEN is required");
  process.exit(1);
}

const authenticated = await authenticateSellerApiToken(rawToken);
if (!authenticated) {
  console.error("The seller MCP token is invalid, expired, or revoked");
  process.exit(1);
}
const auth = authenticated!;

function requireScope(scope: string) {
  if (!auth.scopes.includes(scope)) throw new Error(`Token does not include ${scope}`);
}

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> };
}

const server = new McpServer({ name: "vial-seller", version: "4.0.0" });

server.registerTool(
  "get_onboarding_status",
  { description: "Read the current seller onboarding and readiness state.", inputSchema: {} },
  async () => {
    requireScope("seller:read");
    const db = await getDatabase();
    const [profile, onboarding, readiness] = await Promise.all([
      db.query(`SELECT seller_id,display_name,website_url,onboarding_status,readiness_state,updated_at FROM seller_profiles WHERE seller_id=$1`, [auth.sellerId]),
      db.query(`SELECT status,current_step,completion_percent,updated_at FROM seller_onboarding_sessions WHERE seller_id=$1 ORDER BY started_at DESC LIMIT 1`, [auth.sellerId]),
      db.query(`SELECT overall_state,completion_percent,dimensions,blockers,warnings,created_at FROM seller_readiness_snapshots WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 1`, [auth.sellerId]),
    ]);
    return result({ profile: profile.rows[0] ?? null, onboarding: onboarding.rows[0] ?? null, readiness: readiness.rows[0] ?? null });
  },
);

server.registerTool(
  "list_catalog",
  { description: "List the authenticated seller's catalog records. Read-only.", inputSchema: { status: z.string().optional() } },
  async ({ status }) => {
    requireScope("catalog:read");
    const db = await getDatabase();
    const rows = await db.query(
      `SELECT p.id,p.title,p.quantity_label,p.sku,p.price,p.inventory,p.status,p.match_confidence,e.display_name compound_name
       FROM seller_products p LEFT JOIN canonical_entities e ON e.id=p.compound_entity_id
       WHERE p.seller_id=$1 AND ($2::text IS NULL OR p.status=$2)
       ORDER BY p.updated_at DESC`,
      [auth.sellerId, status ?? null],
    );
    return result({ products: rows.rows });
  },
);

server.registerTool(
  "match_product",
  {
    description: "Propose a canonical compound match for a product label. This does not publish or update the catalog.",
    inputSchema: { title: z.string(), description: z.string().optional(), sku: z.string().optional(), tags: z.array(z.string()).optional() },
  },
  async (input) => {
    requireScope("catalog:read");
    return result(await matchSellerProduct(input));
  },
);

server.registerTool(
  "list_evidence_gaps",
  { description: "List seller products without a confirmed evidence relationship. Read-only.", inputSchema: {} },
  async () => {
    requireScope("evidence:read");
    const db = await getDatabase();
    const rows = await db.query(
      `SELECT p.id,p.title,p.quantity_label,e.display_name compound_name,
              COUNT(l.id) FILTER(WHERE l.status='confirmed') confirmed_links,
              COUNT(l.id) FILTER(WHERE l.status='proposed') proposed_links
       FROM seller_products p
       LEFT JOIN canonical_entities e ON e.id=p.compound_entity_id
       LEFT JOIN seller_evidence_links l ON l.seller_product_id=p.id
       WHERE p.seller_id=$1
       GROUP BY p.id,e.display_name
       HAVING COUNT(l.id) FILTER(WHERE l.status='confirmed')=0
       ORDER BY p.updated_at DESC`,
      [auth.sellerId],
    );
    return result({ gaps: rows.rows });
  },
);

server.registerTool(
  "prepare_catalog_import",
  {
    description: "Create a reviewable catalog import job. This only proposes matches and never publishes products.",
    inputSchema: {
      provider: z.enum(["shopify", "woocommerce", "csv", "website"]),
      rows: z.array(z.object({ externalId: z.string().optional(), title: z.string(), description: z.string().optional(), sku: z.string().optional(), price: z.number().optional(), inventory: z.number().int().optional(), tags: z.array(z.string()).optional() })).max(200),
    },
  },
  async ({ provider, rows }) => {
    requireScope("catalog:propose");
    const job = await runCatalogImport({ sellerId: auth.sellerId, provider, rows, actorId: `mcp:${auth.tokenId}` });
    return result({ approvalRequired: true, job });
  },
);

server.registerTool(
  "prepare_evidence_document",
  {
    description: "Create an evidence-document proposal and candidate product links. This never confirms evidence or publishes claims.",
    inputSchema: {
      filename: z.string(),
      documentType: z.string().default("coa"),
      issuer: z.string().optional(),
      reportIdentifier: z.string().optional(),
      reportDate: z.string().optional(),
      expiresAt: z.string().optional(),
      identity: z.string().optional(),
      quantity: z.string().optional(),
      batchCode: z.string().optional(),
    },
  },
  async ({ identity, quantity, batchCode, ...document }) => {
    requireScope("evidence:propose");
    const documentId = await createEvidenceDocument({ sellerId: auth.sellerId, ...document, extractedFields: { identity, quantity, batchCode } });
    const proposals = await proposeEvidenceLinks({ sellerId: auth.sellerId, documentId });
    return result({ approvalRequired: true, documentId, proposals });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("VIAL Seller MCP server ready on stdio");

}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
