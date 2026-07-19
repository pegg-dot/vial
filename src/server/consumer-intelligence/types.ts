export type EvidencePriority = "batch_linkage" | "report_confirmation" | "freshness" | "sampling" | "quantity" | "issuer";
export type HomeView = "balanced" | "evidence-first" | "price-first" | "changes-first";

export interface ConsumerPreferences {
  priceFloor: number;
  priceCeiling: number;
  maxShippingDays: number;
  evidencePriorities: EvidencePriority[];
  requiredEvidenceLevels: string[];
  preferredVendorSlugs: string[];
  hiddenVendorSlugs: string[];
  preferredCompoundSlugs: string[];
  homeView: HomeView;
  personalizationEnabled: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  alertMode: "off" | "important" | "all";
  active: boolean;
  lastResultCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComparisonSession {
  id: string;
  name: string;
  listingSlugs: string[];
  notes: Record<string, string>;
  status: string;
  isDefault: boolean;
  lastViewedAt: string;
  updatedAt: string;
}

export interface DecisionEvent {
  id: string;
  eventType: string;
  subjectType: string;
  subjectId: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface UserNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  actionHref?: string;
  relevanceScore: number;
  status: "unread" | "read" | "dismissed";
  createdAt: string;
  readAt?: string;
}

export interface ChangeSummaryItem {
  kind: string;
  title: string;
  detail: string;
  href: string;
  relevance: number;
  occurredAt: string;
}

export interface MarketChangeSummary {
  id: string;
  title: string;
  summary: string;
  items: ChangeSummaryItem[];
  relevanceScore: number;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  readAt?: string;
}
