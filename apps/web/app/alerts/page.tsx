import { TerminalShell } from "../components/TerminalShell";
import { getAlerts, getDashboard } from "../lib/api";
import { getShellContext } from "../lib/shellContext";

export default async function AlertsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug, userEmail, tenants } = await getShellContext(sp, "/alerts");
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const [data, dashboardData] = await Promise.all([
    getAlerts(tenantSlug),
    getDashboard(tenantSlug)
  ]);

  const rows =
    q.length >= 2
      ? data.items.filter(
          (row) =>
            row.item.toLowerCase().includes(q) ||
            row.severity.toLowerCase().includes(q) ||
            row.owner.toLowerCase().includes(q)
        )
      : data.items;

  const openAlerts = data.items.filter((a) => a.status === "Open").length;

  return (
    <TerminalShell
      activePath="/alerts"
      tenantSlug={tenantSlug}
      tenantDisplayName={dashboardData.tenant.display_name}
      brandColor={dashboardData.tenant.brand_color}
      title="Alerts"
      subtitle="Review-gated escalations and monitored convergence events"
      openAlertsCount={openAlerts}
      tenants={tenants}
      userEmail={userEmail}
    >
      <section className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-[1.35fr_340px] lg:items-start">
        <div className="overflow-hidden rounded-soft border border-border bg-surface shadow-sm">
          <div className="grid grid-cols-1 gap-0 border-b border-border text-2xs font-semibold uppercase tracking-wide text-muted sm:grid-cols-[100px_minmax(0,1fr)_100px_90px]">
            <div className="hidden px-3 py-2 sm:block">Severity</div>
            <div className="hidden px-3 py-2 sm:block">Item</div>
            <div className="hidden px-3 py-2 sm:block">Owner</div>
            <div className="hidden px-3 py-2 sm:block">Status</div>
          </div>
          {rows.map((row) => (
            <div
              key={row.alertId}
              className="grid grid-cols-1 gap-1 border-b border-border px-3 py-2.5 text-sm last:border-b-0 sm:grid-cols-[100px_minmax(0,1fr)_100px_90px] sm:items-start sm:gap-3"
            >
              <div
                className={
                  row.severity === "Critical"
                    ? "font-medium text-red-700"
                    : row.severity === "High"
                      ? "font-medium text-amber-700"
                      : "text-muted"
                }
              >
                {row.severity}
              </div>
              <div className="text-stone-800">{row.item}</div>
              <div className="text-xs text-muted">{row.owner}</div>
              <div className="text-xs text-accent-green">{row.status}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-2">
          <div className="rounded-soft border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Approval gate</div>
            <div className="divide-y divide-border text-xs">
              <div className="flex justify-between px-3 py-2">
                <span className="text-muted">Pending review</span>
                <strong>{data.approvalSummary.pendingReview}</strong>
              </div>
              <div className="flex justify-between px-3 py-2">
                <span className="text-muted">Ready to distribute</span>
                <strong>{data.approvalSummary.readyToDistribute}</strong>
              </div>
              <div className="flex justify-between px-3 py-2">
                <span className="text-muted">Blocked by notes</span>
                <strong>{data.approvalSummary.blockedByNotes}</strong>
              </div>
            </div>
          </div>
          <div className="rounded-soft border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Escalation notes</div>
            {data.escalationNotes.map((note) => (
              <div key={note} className="border-b border-border px-3 py-2 text-xs text-stone-700 last:border-b-0">
                {note}
              </div>
            ))}
          </div>
        </div>
      </section>
    </TerminalShell>
  );
}
