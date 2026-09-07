export type ParserProfile = "generic" | "jsonld" | "document" | "catalog";
export type RefreshTransport = "http" | "fixture";
export type RefreshJobStatus = "queued" | "running" | "retrying" | "succeeded" | "failed" | "cancelled";

export interface RefreshPolicy {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sourceLocation: string;
  sourceType: string;
  targetListingId: string;
  targetListingSlug: string;
  productName: string;
  vendorName: string;
  transport: RefreshTransport;
  parserProfile: ParserProfile;
  enabled: boolean;
  intervalMinutes: number;
  nextRunAt: string;
  lastStartedAt?: string;
  lastSucceededAt?: string;
  lastFailedAt?: string;
  consecutiveFailures: number;
  timeoutMs: number;
  maxResponseBytes: number;
  allowedContentTypes: string[];
  allowedHostnames: string[];
  etag?: string;
  lastModified?: string;
  fixtureVersion?: number;
  fixtureMaxVersion?: number;
}

export interface RefreshJob {
  id: string;
  policyId: string;
  sourceLabel: string;
  targetListingSlug: string;
  /** The storefront this job will fetch from. The sweep never runs two jobs for one vendor at once. */
  vendorId?: string;
  triggerType: string;
  triggerEventId?: string;
  status: RefreshJobStatus;
  priority: number;
  availableAt: string;
  startedAt?: string;
  completedAt?: string;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  result: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  body: string;
  bytes: number;
  etag?: string;
  lastModified?: string;
  resolvedIp: string;
  notModified: boolean;
  redirects: string[];
}

export interface SnapshotDiff {
  changed: boolean;
  addedLines: number;
  removedLines: number;
  previousHash?: string;
  currentHash: string;
  summary: {
    previousLength: number;
    currentLength: number;
    addedPreview: string[];
    removedPreview: string[];
  };
}
