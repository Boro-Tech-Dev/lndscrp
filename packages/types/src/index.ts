export type SignalType =
  | "competitive_activity"
  | "clinical_landscape"
  | "congress_intelligence"
  | "market_access"
  | "regulatory"
  | "social_intelligence"
  | "professional_discourse"
  | "internal_performance";

export type ApprovalStatus = "draft" | "pending_review" | "approved" | "rejected";

export interface Signal {
  signalId: string;
  tenantId: string;
  sourceId: string | null;
  signalType: SignalType;
  title: string;
  summary: string;
  fullText: string | null;
  competitorBrand: string | null;
  diseaseState: string | null;
  marketRegion: string | null;
  importanceScore: number;
  confidenceScore: number;
  sentimentScore: number | null;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  firstSeenAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  openSignals: number;
  prioritySignals: number;
  activeCompetitors: number;
  pendingApprovals: number;
}

export interface ReportRequest {
  tenantSlug: string;
  title: string;
  signalIds?: string[];
}

export type ProductRole = "owned" | "competitor";
export type LifecycleStage = "pipeline" | "approved" | "generic";

export interface LabelUpdateEntry {
  date: string;
  title: string;
  url: string;
  source: string;
}

export interface WorkspaceProductTile {
  productId: string;
  brandName: string;
  genericName: string;
  company: string | null;
  role: ProductRole;
  therapeuticClass: string | null;
  indications: string[];
  lifecycleStage: LifecycleStage;
  sortOrder: number;
  hcpUrl: string | null;
  dtcUrl: string | null;
  labelUrl: string | null;
  pdufaDate: string | null;
  pdufaIsEstimated: boolean;
  approvalDate: string | null;
  loeDate: string | null;
  labelUpdates: LabelUpdateEntry[];
  trialNctId: string | null;
  trialStatus: string | null;
  trialPhases: string[];
  lastEnrichedAt: string | null;
  enrichmentErrors: string[];
  hcpSourceCount: number;
  dtcSourceCount: number;
}

export interface CompetitorWorkspace {
  products: WorkspaceProductTile[];
  workspaceSummary: string;
  actions: string[];
}

export type CongressPriority = "imminent" | "pivotal" | "expected" | "watch";
export type CongressBrandPresence = "confirmed" | "expected";

export interface CongressEventBrand {
  brandName: string;
  role: ProductRole;
  presence: CongressBrandPresence;
}

export interface CongressHeadlineSession {
  title: string;
  brandName: string;
  startsAt: string;
  endsAt?: string;
  sessionLabel?: string;
  abstractId?: string;
  url?: string;
}

export interface WorkspaceCongressEvent {
  eventId: string;
  eventSlug: string;
  acronym: string;
  name: string;
  location: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  focusTags: string[];
  priority: CongressPriority;
  summary: string;
  brands: CongressEventBrand[];
  headlineSessions: CongressHeadlineSession[];
  programUrl: string | null;
}

export interface SourceCheckResult {
  sourceExternalId: string;
  sourceName: string;
  sourceType: string;
  title: string;
  summary: string;
  signalType: SignalType;
  importanceScore: number;
  confidenceScore: number;
  diseaseState?: string;
  competitorBrand?: string;
  marketRegion?: string;
}
