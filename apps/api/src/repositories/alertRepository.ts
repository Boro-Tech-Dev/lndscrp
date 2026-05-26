import { one, query } from "@landscrape/db";

export interface AlertRow {
  alertId: string;
  severity: string;
  item: string;
  owner: string;
  status: string;
  createdAt: string;
}

export async function listAlertsByTenant(tenantId: string): Promise<AlertRow[]> {
  const rows = await query<{
    alert_id: string;
    alert_level: string;
    alert_title: string;
    alert_message: string;
    status: string;
    created_at: string;
  }>(
    `
    SELECT
      alert_id,
      alert_level,
      COALESCE(alert_title, 'Untitled alert') AS alert_title,
      COALESCE(alert_message, '') AS alert_message,
      CASE WHEN is_open THEN 'Open' ELSE 'Closed' END AS status,
      created_at::text AS created_at
    FROM alerts
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [tenantId]
  );

  return rows.map((row) => ({
    alertId: row.alert_id,
    severity: row.alert_level === 'info' ? 'Medium' : row.alert_level.charAt(0).toUpperCase() + row.alert_level.slice(1),
    item: `${row.alert_title} — ${row.alert_message}`,
    owner: inferOwner(row.alert_title, row.alert_message),
    status: row.status,
    createdAt: row.created_at
  }));
}

export async function getAlertApprovalSummary(tenantId: string): Promise<{ pendingReview: number; readyToDistribute: number; blockedByNotes: number; }> {
  const row = await one<{
    pending_review: string;
    ready_to_distribute: string;
    blocked_by_notes: string;
  }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE approval_status = 'pending_review')::text AS pending_review,
      COUNT(*) FILTER (WHERE approval_status = 'approved')::text AS ready_to_distribute,
      COUNT(*) FILTER (WHERE approval_status = 'rejected')::text AS blocked_by_notes
    FROM reports
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  return {
    pendingReview: Number(row?.pending_review ?? 0),
    readyToDistribute: Number(row?.ready_to_distribute ?? 0),
    blockedByNotes: Number(row?.blocked_by_notes ?? 0)
  };
}

function inferOwner(title: string, message: string): string {
  const text = `${title} ${message}`.toLowerCase();
  if (text.includes('payer') || text.includes('access')) return 'Access';
  if (text.includes('congress') || text.includes('medical')) return 'Medical';
  if (text.includes('competitor') || text.includes('launch')) return 'Strategy';
  return 'Insights';
}
