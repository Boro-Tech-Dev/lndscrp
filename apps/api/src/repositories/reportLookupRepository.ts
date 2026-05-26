import { one } from "@landscrape/db";

export async function getReportById(tenantId: string, reportId: string): Promise<{ report_id: string; title: string } | null> {
  return one<{ report_id: string; title: string }>(
    `SELECT report_id, title FROM reports WHERE tenant_id = $1 AND report_id = $2`,
    [tenantId, reportId]
  );
}
