import { z } from "zod";

export const parserProfileSchema = z.enum(["generic", "jsonld", "document", "catalog"]);

export const ingestionInputSchema = z.object({
  sourceType: z.enum(["vendor-page", "lab-report", "policy", "regulatory", "manual-note"]),
  canonicalLocation: z.string().url().max(2048),
  label: z.string().trim().min(3).max(160),
  targetListingSlug: z.string().trim().min(1),
  rawContent: z.string().min(20).max(1_000_000),
  contentType: z.enum(["text/plain", "text/html", "application/json", "application/ld+json"]).default("text/plain"),
  parserProfile: parserProfileSchema.default("generic"),
  actor: z.string().trim().min(2).max(120),
  workflow: z.string().trim().min(2).max(120).default("source-ingestion"),
  captureMode: z.enum(["manual", "scheduled", "fixture", "api"]).default("manual"),
  snapshotMetadata: z.record(z.string(), z.unknown()).default({}),
});

export type IngestionInput = z.input<typeof ingestionInputSchema>;
export type ParsedIngestionInput = z.output<typeof ingestionInputSchema>;

export const claimCandidateSchema = z.object({
  predicate: z.enum(["price", "availability", "shipping", "batchCode", "reportDate", "reportIssuer", "reportConfirmed"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(4),
  riskLevel: z.enum(["standard", "material", "high-impact"]),
});

export type ClaimCandidate = z.infer<typeof claimCandidateSchema>;
