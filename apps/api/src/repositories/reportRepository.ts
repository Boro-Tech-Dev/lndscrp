import { query } from "@landscrape/db";

export interface ReportExportState {
  exportId: string;
  status: string;
  storageUrl: string | null;
  errorMessage: string | null;
}

export interface ReportRow {
  reportId: string;
  title: string;
  reportType: string;
  approvalStatus: string;
  createdAt: string;
  exports: {
    pdf?: ReportExportState;
    markdown_bundle?: ReportExportState;
  };
}

export async function listReportsByTenant(tenantId: string): Promise<ReportRow[]> {
  const rows = await query<{
    report_id: string;
    title: string;
    report_type: string;
    approval_status: string;
    created_at: string;
  }>(
    `
    SELECT report_id, title, report_type, approval_status, created_at::text AS created_at
    FROM reports
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [tenantId]
  );

  if (rows.length === 0) return [];

  const reportIds = rows.map((row) => row.report_id);
  const exportRows = await query<{
    export_id: string;
    report_id: string;
    format: string;
    status: string;
    storage_url: string | null;
    error_message: string | null;
  }>(
    `
    SELECT DISTINCT ON (report_id, format)
      export_id, report_id, format, status, storage_url, error_message
    FROM report_exports
    WHERE tenant_id = $1 AND report_id = ANY($2::uuid[])
      AND format IN ('pdf', 'markdown_bundle')
    ORDER BY report_id, format, created_at DESC
    `,
    [tenantId, reportIds]
  );

  const exportsByReport = new Map<string, ReportRow["exports"]>();
  for (const exportRow of exportRows) {
    const existing = exportsByReport.get(exportRow.report_id) ?? {};
    const state: ReportExportState = {
      exportId: exportRow.export_id,
      status: exportRow.status,
      storageUrl: exportRow.storage_url,
      errorMessage: exportRow.error_message,
    };
    if (exportRow.format === "pdf") {
      existing.pdf = state;
    } else if (exportRow.format === "markdown_bundle") {
      existing.markdown_bundle = state;
    }
    exportsByReport.set(exportRow.report_id, existing);
  }

  return rows.map((row) => ({
    reportId: row.report_id,
    title: row.title,
    reportType: row.report_type,
    approvalStatus: row.approval_status,
    createdAt: row.created_at,
    exports: exportsByReport.get(row.report_id) ?? {},
  }));
}
