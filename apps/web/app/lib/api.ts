import { redirect } from "next/navigation";
import { getServerAccessToken } from "./auth/session";
import { authEnabled } from "./auth/constants";
import { DEFAULT_TENANT } from "./tenantConstants";

function apiBaseUrl(): string {
  return process.env.API_INTERNAL_URL ?? "http://api:4000";
}

export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (authEnabled()) {
    const token = await getServerAccessToken();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: init.cache ?? "no-store"
  });
}

async function request<T>(path: string): Promise<T> {
  const response = await authorizedFetch(path);

  if (response.status === 401) {
    redirect("/login");
  }
  if (response.status === 403) {
    throw new Error("Forbidden");
  }
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}

export type DashboardSummary = {
  openSignals: number;
  prioritySignals: number;
  activeCompetitors: number;
  pendingApprovals: number;
};

export type DashboardResponse = {
  tenant: {
    tenant_id: string;
    tenant_slug: string;
    display_name: string;
    brand_color: string;
    industry_pack: string;
  };
  summary: DashboardSummary;
};

export type SignalItem = import("@landscrape/types").Signal;

export type SignalResponse = {
  items: SignalItem[];
  total?: number;
  limit?: number;
  offset?: number;
};

export type CompetitorResponse = import("@landscrape/types").CompetitorWorkspace;

export type CongressResponse = {
  events: import("@landscrape/types").WorkspaceCongressEvent[];
  timeline: Array<{
    slot: string;
    session: string;
    takeaway: string;
  }>;
  eventState: {
    sessionDensity: number;
    competitorPresence: number;
    kolEngagement: number;
  };
  themes: string[];
  outputs: string[];
};

export type AlertResponse = {
  items: Array<{
    alertId: string;
    severity: string;
    item: string;
    owner: string;
    status: string;
    createdAt: string;
  }>;
  approvalSummary: {
    pendingReview: number;
    readyToDistribute: number;
    blockedByNotes: number;
  };
  escalationNotes: string[];
};

export type ReportExportState = {
  exportId: string;
  status: string;
  storageUrl: string | null;
  errorMessage: string | null;
};

export type ReportResponse = {
  items: Array<{
    reportId: string;
    title: string;
    reportType: string;
    approvalStatus: string;
    createdAt: string;
    exports: {
      pdf?: ReportExportState;
      markdown_bundle?: ReportExportState;
    };
  }>;
  exportFormats: string[];
  distributionControls: string[];
  templates: string[];
};

export type SourceItem = {
  source_id: string;
  source_name: string;
  source_type: string;
  last_checked_at: string | null;
  last_status: string | null;
  latest_item_at: string | null;
  screenshot_count: number;
  dom_snapshot_count: number;
  latest_screenshot_url: string | null;
  latest_dom_snapshot_url: string | null;
};

export type SourcesResponse = {
  tenant: DashboardResponse["tenant"];
  items: SourceItem[];
};

export type TenantsListResponse = {
  items: Array<{
    tenant_id: string;
    tenant_slug: string;
    display_name: string;
    brand_color: string;
  }>;
};

export type InterpretationResponse = {
  paragraphs: string[];
};

export type SearchResponse = {
  tenant: DashboardResponse["tenant"];
  query: string;
  mode?: string;
  signals: Array<{ signalId: string; title: string; summary: string; signalType: string }>;
  reports: Array<{ reportId: string; title: string; reportType: string }>;
};

export { DEFAULT_TENANT } from "./tenantConstants";

export async function getDashboard(tenantId = DEFAULT_TENANT) {
  return request<DashboardResponse>(`/v1/tenants/${tenantId}/dashboard`);
}

export async function getInterpretation(tenantId = DEFAULT_TENANT) {
  return request<InterpretationResponse>(`/v1/tenants/${tenantId}/dashboard/interpretation`);
}

export async function getSignals(
  tenantId = DEFAULT_TENANT,
  opts: number | import("./signals").GetSignalsOptions = 12
) {
  const options = typeof opts === "number" ? { limit: opts } : opts;
  const params = new URLSearchParams();
  if (typeof options.limit === "number") params.set("limit", String(options.limit));
  if (typeof options.offset === "number") params.set("offset", String(options.offset));
  if (typeof options.sort === "string") params.set("sort", options.sort);
  if (Array.isArray(options.excludeTypes) && options.excludeTypes.length > 0) {
    params.set("excludeTypes", options.excludeTypes.join(","));
  }
  if (typeof options.from === "string" && options.from.trim()) params.set("from", options.from.trim());
  if (typeof options.to === "string" && options.to.trim()) params.set("to", options.to.trim());
  const qs = params.toString();
  return request<SignalResponse>(`/v1/tenants/${tenantId}/signals${qs ? `?${qs}` : ""}`);
}

export async function getSignal(tenantId: string, signalId: string) {
  return request<SignalItem>(`/v1/tenants/${tenantId}/signals/${signalId}`);
}

export async function getCompetitors(tenantId = DEFAULT_TENANT) {
  return request<CompetitorResponse>(`/v1/tenants/${tenantId}/competitors`);
}

export async function getCongress(tenantId = DEFAULT_TENANT) {
  return request<CongressResponse>(`/v1/tenants/${tenantId}/congress`);
}

export async function getAlerts(tenantId = DEFAULT_TENANT) {
  return request<AlertResponse>(`/v1/tenants/${tenantId}/alerts`);
}

export async function getReports(tenantId = DEFAULT_TENANT) {
  return request<ReportResponse>(`/v1/tenants/${tenantId}/reports`);
}

export async function getSources(tenantId = DEFAULT_TENANT) {
  return request<SourcesResponse>(`/v1/tenants/${tenantId}/sources`);
}

export async function listTenants() {
  return request<TenantsListResponse>("/v1/tenants");
}

export async function searchTenant(
  tenantId: string,
  q: string,
  limit = 15,
  mode: "keyword" | "semantic" | "hybrid" = "hybrid"
) {
  const params = new URLSearchParams({ q, limit: String(limit), mode });
  return request<SearchResponse>(`/v1/tenants/${tenantId}/search?${params.toString()}`);
}

export { authorizedFetch as apiFetch };
