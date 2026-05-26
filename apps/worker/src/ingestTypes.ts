export interface SourceRow {
  source_id: string;
  external_id: string | null;
  source_name: string;
  source_type: string;
  base_url: string | null;
  source_config: Record<string, unknown> | null;
}

export interface SourceArtifactDraft {
  artifactType: "screenshot" | "dom_snapshot" | "pdf" | "extracted_text";
  storageKind: "s3";
  contentType: string;
  body: Buffer | string;
  fileName: string;
  metadata?: Record<string, unknown>;
}

export interface IngestedItem {
  externalItemId: string;
  title: string;
  summary: string;
  url: string | null;
  publishedAt: string | null;
  rawContent: string;
  metadata?: Record<string, unknown>;
  artifacts?: SourceArtifactDraft[];
}

export interface PortalLoginConfig {
  loginUrl: string;
  username: string;
  password: string;
  userSelector: string;
  passSelector: string;
  submitSelector: string;
  postLoginWaitMs?: number;
}

export interface SignalDraft {
  signalType:
    | "competitive_activity"
    | "clinical_landscape"
    | "congress_intelligence"
    | "market_access"
    | "regulatory"
    | "social_intelligence"
    | "professional_discourse"
    | "internal_performance";
  title: string;
  summary: string;
  fullText: string;
  competitorBrand?: string;
  diseaseState?: string;
  marketRegion?: string;
  importanceScore: number;
  confidenceScore: number;
  entities: Array<{ entityType: string; entityValue: string }>;
  evidenceLinks: string[];
}
