import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";

export function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "VIAL Evidence API",
      version: "3.0.0",
      description: "Published fictional market data plus authenticated consumer-intelligence endpoints for preferences, saved searches, comparisons, follows, notifications, and change summaries.",
    },
    servers: [{ url: siteUrl }],
    paths: {
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
