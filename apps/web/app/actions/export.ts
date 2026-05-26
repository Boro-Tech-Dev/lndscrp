"use server";

import { authorizedFetch } from "../lib/api";

export type ExportFormat = "pdf" | "markdown_bundle";

export async function enqueueReportExport(tenantSlug: string, reportId: string, format: ExportFormat) {
  const res = await authorizedFetch(`/v1/tenants/${tenantSlug}/reports/${reportId}/export`, {
    method: "POST",
    body: JSON.stringify({ format })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Export enqueue failed (${res.status})`);
  }

  return res.json() as Promise<{ exportId: string; status: string }>;
}

export async function getExportStatus(tenantSlug: string, exportId: string) {
  const res = await authorizedFetch(`/v1/tenants/${tenantSlug}/exports/${exportId}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Export status failed (${res.status})`);
  }

  return res.json() as Promise<{ status: string; storage_url: string | null; error_message: string | null }>;
}
