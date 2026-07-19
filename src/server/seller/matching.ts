import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { combinedSimilarity, compactTerm, normalizeTerm } from "@/server/market-data/normalize";

interface CompoundCandidate extends QueryResultRow {
  id: string;
  display_name: string;
  aliases: unknown;
}

export interface SellerProductInput {
  externalId?: string;
  title: string;
  description?: string;
  sku?: string;
  price?: number;
  inventory?: number;
  tags?: string[];
}

export interface ProductMatch {
  status: "auto_matched" | "needs_review" | "unmatched";
  compoundEntityId: string | null;
  compoundName: string | null;
  score: number;
  reasons: string[];
  quantityLabel: string;
  candidates: Array<{ id: string; name: string; score: number; matchedOn: string }>;
}

export function extractQuantityLabel(value: string) {
  const match = value.match(/\b(\d+(?:\.\d+)?)\s*(mcg|mg|g|ml)\b/i);
  return match ? `${match[1]} ${match[2].toLowerCase()}` : "Not declared";
}

function parseAliases(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function matchSellerProduct(input: SellerProductInput, connection?: SqlConnection): Promise<ProductMatch> {
  const db = connection ?? await getDatabase();
  const compounds = await db.query<CompoundCandidate & { source_entity_id: string | null }>(
    `SELECT e.id,e.display_name,e.source_entity_id,COALESCE(json_agg(a.alias) FILTER(WHERE a.alias IS NOT NULL),'[]'::json) aliases
     FROM canonical_entities e
     LEFT JOIN entity_aliases a ON a.entity_id=e.id AND a.active=TRUE
     WHERE e.entity_type='compound' AND e.status='active'
     GROUP BY e.id
     ORDER BY e.display_name`,
  );
  const text = [input.title, input.description ?? "", ...(input.tags ?? []), input.sku ?? ""].join(" ");
  const normalizedText = normalizeTerm(text);
  const ranked = compounds.rows
    .map((compound) => {
      const labels = [compound.display_name, ...parseAliases(compound.aliases)];
      const labelScores = labels.map((label) => ({ label, score: combinedSimilarity(text, label) }));
      const compactText = compactTerm(text);
      const direct = labels.find((label) => normalizedText.includes(normalizeTerm(label)) || compactText.includes(compactTerm(label)));
      const best = labelScores.sort((left, right) => right.score - left.score)[0] ?? { label: compound.display_name, score: 0 };
      const exactBoost = direct ? Math.max(best.score, 0.97) : best.score;
      return { id: compound.id, name: compound.display_name, score: Math.min(1, exactBoost), matchedOn: direct ?? best.label };
    })
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const second = ranked[1];
  const margin = best ? best.score - (second?.score ?? 0) : 0;
  let status: ProductMatch["status"] = "unmatched";
  if (best && best.score >= 0.92 && margin >= 0.08) status = "auto_matched";
  else if (best && best.score >= 0.66) status = "needs_review";
  const reasons = best
    ? [
        `Closest canonical label: ${best.matchedOn}`,
        `Similarity ${(best.score * 100).toFixed(0)}%`,
        margin < 0.08 ? "Another compound candidate is close; confirmation required" : "Candidate separation is sufficient",
      ]
    : ["No compound candidates were available"];
  return {
    status,
    compoundEntityId: status === "unmatched" ? null : best.id,
    compoundName: status === "unmatched" ? null : best.name,
    score: best?.score ?? 0,
    reasons,
    quantityLabel: extractQuantityLabel(text),
    candidates: ranked.slice(0, 5),
  };
}

export interface SellerBusinessCandidate {
  organizationId: string;
  name: string;
  domains: string[];
  score: number;
  reasons: string[];
}

function hostname(value: string) {
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ""); } catch { return value.trim().toLowerCase().replace(/^www\./, "").split("/")[0]; }
}

export async function matchSellerBusiness(input: { name?: string; websiteUrl?: string }, connection?: SqlConnection): Promise<SellerBusinessCandidate[]> {
  const db = connection ?? await getDatabase();
  const organizations = await db.query<QueryResultRow & { id: string; display_name: string; domains: unknown }>(`SELECT id,display_name,domains FROM organizations ORDER BY display_name`);
  const targetDomain = input.websiteUrl ? hostname(input.websiteUrl) : "";
  const targetName = input.name?.trim() ?? "";
  return organizations.rows.map((organization) => {
    const domains = parseAliases(organization.domains).map(hostname);
    const reasons: string[] = [];
    let score = 0;
    if (targetDomain && domains.includes(targetDomain)) { score = 1; reasons.push("Exact website domain match"); }
    else if (targetDomain && domains.some((domain) => targetDomain.endsWith(`.${domain}`) || domain.endsWith(`.${targetDomain}`))) { score = Math.max(score, .91); reasons.push("Related domain match"); }
    if (targetName) {
      const nameScore = combinedSimilarity(targetName, organization.display_name);
      if (nameScore >= .65) reasons.push(`Business-name similarity ${(nameScore * 100).toFixed(0)}%`);
      score = Math.max(score, nameScore * .88);
    }
    return { organizationId: organization.id, name: organization.display_name, domains, score: Math.min(1, score), reasons };
  }).filter((candidate) => candidate.score >= .58).sort((left, right) => right.score - left.score).slice(0, 5);
}
