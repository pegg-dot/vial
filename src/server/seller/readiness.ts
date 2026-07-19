import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

export interface ReadinessDimension {
  key: string;
  label: string;
  score: number;
  status: "complete" | "attention" | "blocked";
  detail: string;
}

function dimension(key: string, label: string, score: number, detail: string): ReadinessDimension {
  return { key, label, score, detail, status: score >= 1 ? "complete" : score > 0 ? "attention" : "blocked" };
}

export async function computeSellerReadiness(sellerId: string, connection?: SqlConnection) {
  const db = connection ?? await getDatabase();
  const [profile, integrations, products, evidence, team] = await Promise.all([
    db.query<QueryResultRow & { legal_name: string; website_url: string | null; support_email: string | null; returns_policy: string; shipping_origin: unknown; terms_accepted_at: string | null }>(`SELECT * FROM seller_profiles WHERE seller_id=$1`, [sellerId]),
    db.query<QueryResultRow & { provider: string; status: string }>(`SELECT provider,status FROM seller_integrations WHERE seller_id=$1`, [sellerId]),
    db.query<QueryResultRow & { total: string | number; matched: string | number; ready: string | number }>(`SELECT COUNT(*) total,COUNT(*) FILTER(WHERE compound_entity_id IS NOT NULL) matched,COUNT(*) FILTER(WHERE status IN ('review','ready','active')) ready FROM seller_products WHERE seller_id=$1`, [sellerId]),
    db.query<QueryResultRow & { documents: string | number; linked: string | number }>(`SELECT COUNT(DISTINCT d.id) documents,COUNT(DISTINCT l.id) linked FROM seller_evidence_documents d LEFT JOIN seller_evidence_links l ON l.document_id=d.id AND l.status IN ('confirmed','proposed') WHERE d.seller_id=$1`, [sellerId]),
    db.query<QueryResultRow & { active: string | number }>(`SELECT COUNT(*) FILTER(WHERE status='active') active FROM seller_team_members WHERE seller_id=$1`, [sellerId]),
  ]);
  const p = profile.rows[0];
  const product = products.rows[0];
  const evidenceRow = evidence.rows[0];
  const connectedProviders = new Set(integrations.rows.filter((row) => ["connected", "sandbox_ready"].includes(row.status)).map((row) => row.provider));
  const total = Number(product?.total ?? 0);
  const matched = Number(product?.matched ?? 0);
  const linked = Number(evidenceRow?.linked ?? 0);
  const identityScore = p?.legal_name && p.website_url ? 1 : p?.legal_name || p?.website_url ? 0.5 : 0;
  const operationsScore = p?.support_email && p.returns_policy && p.shipping_origin ? 1 : p?.support_email || p?.returns_policy ? 0.5 : 0;
  const integrationScore = connectedProviders.has("shopify") || connectedProviders.has("woocommerce") || connectedProviders.has("csv") ? 1 : connectedProviders.size ? 0.5 : 0;
  const paymentScore = connectedProviders.has("stripe_connect") ? 1 : 0;
  const catalogScore = total > 0 ? Math.min(1, matched / total) : 0;
  const evidenceScore = total > 0 ? Math.min(1, linked / total) : 0;
  const teamScore = Number(team.rows[0]?.active ?? 0) > 0 ? 1 : 0;
  const policyScore = p?.terms_accepted_at ? 1 : 0;
  const dimensions = [
    dimension("identity", "Business identity", identityScore, identityScore === 1 ? "Legal identity and website are complete." : "Add the legal entity and website."),
    dimension("operations", "Operations", operationsScore, operationsScore === 1 ? "Support, shipping, returns, and SLA are defined." : "Complete support, shipping, and returns information."),
    dimension("integration", "Catalog connection", integrationScore, integrationScore === 1 ? "A catalog connector is ready." : "Connect a store or import a catalog."),
    dimension("catalog", "Catalog matching", catalogScore, total ? `${matched} of ${total} products have canonical compound matches.` : "Import at least one product."),
    dimension("evidence", "Evidence coverage", evidenceScore, total ? `${linked} evidence links across ${total} products.` : "Evidence coverage begins after catalog import."),
    dimension("payments", "Payment onboarding", paymentScore, paymentScore === 1 ? "Payment onboarding is connected in sandbox." : "Connect the sandbox payment onboarding flow."),
    dimension("team", "Team access", teamScore, teamScore === 1 ? "At least one active seller user exists." : "Activate a seller owner."),
    dimension("policy", "Seller agreement", policyScore, policyScore === 1 ? "Current seller terms accepted." : "Accept the current seller agreement."),
  ];
  const completionPercent = Math.round((dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length) * 100);
  const blockers = dimensions.filter((item) => item.status === "blocked").map((item) => item.detail);
  const warnings = dimensions.filter((item) => item.status === "attention").map((item) => item.detail);
  const overallState = blockers.length === 0 ? "ready_for_sandbox" : completionPercent >= 60 ? "needs_attention" : "blocked";
  const id = newId("readiness");
  await db.query(
    `INSERT INTO seller_readiness_snapshots(id,seller_id,overall_state,completion_percent,dimensions,blockers,warnings)
     VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
    [id, sellerId, overallState, completionPercent, JSON.stringify(dimensions), JSON.stringify(blockers), JSON.stringify(warnings)],
  );
  await db.query(`UPDATE seller_profiles SET readiness_state=$2,updated_at=NOW() WHERE seller_id=$1`, [sellerId, overallState]);
  return { id, overallState, completionPercent, dimensions, blockers, warnings };
}
