import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";

export function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "VIAL Evidence API",
      version: "10.0.0",
      description: "Published fictional market data plus authenticated consumer-intelligence endpoints, and a bearer-authenticated public API (/api/public/v1) for programmatic read access, exports, and the category-standard identity registry over published, review-gated data.",
    },
    servers: [{ url: siteUrl }],
    components: {
      securitySchemes: {
        apiKey: { type: "http", scheme: "bearer", description: "A VIAL API key (vial_pk_…) with the required scope." },
      },
    },
    paths: {
      "/api/public/v1/me": { get: { summary: "Echo the calling key's owner and scopes", security: [{ apiKey: [] }], responses: { "200": { description: "Key identity" }, "401": { description: "Missing or invalid key" } } } },
      "/api/public/v1/catalog": { get: { summary: "Published catalog projection (scope market:read)", security: [{ apiKey: [] }], responses: { "200": { description: "Normalized catalog snapshot" }, "401": { description: "Invalid key" }, "403": { description: "Missing scope" }, "429": { description: "Rate limited" } } } },
      "/api/public/v1/signals": { get: { summary: "Published opportunity signals (scope signals:read)", security: [{ apiKey: [] }], parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "Opportunity signals" }, "403": { description: "Missing scope" } } } },
      "/api/public/v1/export": { get: { summary: "Bounded export of catalog or signals (scope export:read)", security: [{ apiKey: [] }], parameters: [{ name: "dataset", in: "query", schema: { type: "string", enum: ["catalog", "signals"] } }, { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv"] } }], responses: { "200": { description: "Export payload" }, "400": { description: "Bad dataset/format" }, "403": { description: "Missing scope" } } } },
      "/api/public/v1/id/{vialId}": { get: { summary: "Resolve a canonical VIAL ID to its registry record (scope identity:read)", security: [{ apiKey: [] }], parameters: [{ name: "vialId", in: "path", required: true, schema: { type: "string" }, description: "e.g. vial:compound:bpc-157, vial:lab:aperture-analytical, vial:batch:hx-bpc-2607" }], responses: { "200": { description: "Registry record with aliases, provenance URL, and relationships" }, "403": { description: "Missing scope" }, "404": { description: "Unknown VIAL ID" } } } },
      "/api/public/v1/resolve": { get: { summary: "Map a real-world label to a canonical VIAL ID (scope identity:read)", security: [{ apiKey: [] }], parameters: [{ name: "label", in: "query", required: true, schema: { type: "string" } }, { name: "type", in: "query", schema: { type: "string", enum: ["compound", "vendor", "product", "lab", "batch", "source"] } }], responses: { "200": { description: "Best match plus ranked candidates" }, "400": { description: "Missing label" }, "403": { description: "Missing scope" } } } },

      "/api/v1/catalog": {
        get: {
          summary: "Published catalog projection",
          responses: { "200": { description: "Current normalized catalog snapshot" } },
        },
      },
      "/api/v1/alerts": {
        get: {
          summary: "Reviewed alerts for listing slugs",
          parameters: [{ name: "slugs", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated listing slugs" }],
          responses: { "200": { description: "Reviewed change alerts" }, "400": { description: "No valid listing slugs supplied" } },
        },
      },
      "/api/v1/health": {
        get: {
          summary: "Database, refresh, and workflow health",
          responses: { "200": { description: "Healthy" }, "503": { description: "Degraded" } },
        },
      },

      "/api/v1/consumer/preferences": { get: { summary: "Authenticated market preferences", responses: { "200": { description: "Preference model" }, "401": { description: "Unauthorized" } } }, patch: { summary: "Update market preferences", responses: { "200": { description: "Updated preferences" } } } },
      "/api/v1/saved-searches": { get: { summary: "List or run saved searches", responses: { "200": { description: "Saved searches or results" } } }, post: { summary: "Create saved search", responses: { "201": { description: "Created" } } }, delete: { summary: "Delete saved search", responses: { "200": { description: "Deletion result" } } } },
      "/api/v1/comparisons": { get: { summary: "List comparison sessions", responses: { "200": { description: "Comparison sessions" } } }, put: { summary: "Sync current comparison", responses: { "200": { description: "Current comparison" } } }, post: { summary: "Save named comparison", responses: { "201": { description: "Saved comparison" } } } },
      "/api/v1/notifications": { get: { summary: "Relevance-ranked notification inbox", responses: { "200": { description: "Notifications" } } }, patch: { summary: "Update notification state", responses: { "200": { description: "Updated" } } } },
      "/api/v1/runs": {
        get: {
          summary: "Staff run ledger",
          responses: { "200": { description: "Authenticated staff response" }, "401": { description: "Unauthorized" } },
        },
      },
    },
  });
}
