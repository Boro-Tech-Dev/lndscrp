export type JobName =
  | "ingest:source"
  | "pdf:extract"
  | "portal:ingest"
  | "social:ingest"
  | "embed:signal"
  | "export:report"
  | "reconcile:scan"
  | "inbound:normalize"
  | "enrich:signal"
  | "enrich:product"
  | "agent:turn"
  | "agent:brief";

export interface IngestSourcePayload {
  tenantId: string;
  sourceId: string;
  tenantSlug?: string;
}

export interface PdfExtractPayload {
  tenantId: string;
  sourceItemId: string;
  sourceId: string;
  pdfUrl?: string | null;
}

export interface PortalIngestPayload {
  tenantId: string;
  sourceId: string;
  connectorId: string;
}

export interface SocialIngestPayload {
  tenantId: string;
  sourceId: string;
  connectorId: string;
}

export type EmbedSignalSource = "backfill" | "ingest" | "inbound";

export interface EmbedSignalPayload {
  tenantId: string;
  signalId: string;
  source?: EmbedSignalSource;
}

export interface ExportReportPayload {
  tenantId: string;
  reportId: string;
  exportId: string;
  format: "pdf" | "pptx" | "markdown_bundle";
}

export interface ReconcileScanPayload {
  mode: "scheduled";
}

export interface InboundNormalizePayload {
  tenantId: string;
  inboundEventId: string;
  channel: "webhook" | "email";
}

export interface EnrichSignalPayload {
  tenantId: string;
  signalId: string;
}

export interface EnrichProductPayload {
  tenantId: string;
  productId: string;
}

export interface AgentTurnPayload {
  tenantId: string;
  sessionId: string;
  userMessage: string;
  turnId: string;
}

export interface AgentBriefPayload {
  tenantId: string;
  title: string;
  signalLimit?: number;
  briefJobId: string;
}

export type JobPayload =
  | { name: "ingest:source"; data: IngestSourcePayload }
  | { name: "pdf:extract"; data: PdfExtractPayload }
  | { name: "portal:ingest"; data: PortalIngestPayload }
  | { name: "social:ingest"; data: SocialIngestPayload }
  | { name: "embed:signal"; data: EmbedSignalPayload }
  | { name: "export:report"; data: ExportReportPayload }
  | { name: "reconcile:scan"; data: ReconcileScanPayload }
  | { name: "inbound:normalize"; data: InboundNormalizePayload }
  | { name: "enrich:signal"; data: EnrichSignalPayload }
  | { name: "enrich:product"; data: EnrichProductPayload }
  | { name: "agent:turn"; data: AgentTurnPayload }
  | { name: "agent:brief"; data: AgentBriefPayload };
