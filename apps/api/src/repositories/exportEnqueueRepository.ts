import { one } from "@landscrape/db";

export async function getReportExport(tenantId: string, exportId: string) {
  return one<{ status: string; storage_url: string | null; error_message: string | null }>(
    `SELECT status, storage_url, error_message FROM report_exports WHERE tenant_id = $1 AND export_id = $2`,
    [tenantId, exportId]
  );
}
