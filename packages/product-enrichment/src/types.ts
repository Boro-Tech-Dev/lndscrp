export interface LabelUpdateEntry {
  date: string;
  title: string;
  url: string;
  source: "DailyMed" | "openFDA";
}

export interface TrialSummary {
  nctId?: string;
  title?: string;
  phases?: string[];
  overallStatus?: string;
  primaryCompletionDate?: string;
  inferredTimelineDate?: string;
  pdufaDateFromText?: string;
  timelineIsEstimated?: boolean;
  url?: string;
}

export interface RegulatorySummary {
  approvalDate?: string;
  latestLabelDate?: string;
  labelTitle?: string;
  splId?: string;
  openfdaApplicationNumber?: string;
}

export interface ProductEnrichmentInput {
  genericName: string;
  brandName: string;
  lifecycleStage: "pipeline" | "approved" | "generic";
  enrichIntervention?: string;
  enrichBrandSearch?: string;
}

export interface ProductEnrichmentResult {
  trialSummary: TrialSummary;
  regulatorySummary: RegulatorySummary;
  labelUpdates: LabelUpdateEntry[];
  enrichedPdufaDate: string | null;
  enrichedApprovalDate: string | null;
  enrichmentErrors: string[];
}

export type FetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<string>;
