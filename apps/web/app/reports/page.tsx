import { TerminalShell } from "../components/TerminalShell";
import { ReportExportButton } from "../components/ReportExportButton";
import { getAlerts, getDashboard, getReports } from "../lib/api";
import { getShellContext } from "../lib/shellContext";

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug, userEmail, tenants } = await getShellContext(sp, "/reports");
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const [data, dashboardData, alertsData] = await Promise.all([
    getReports(tenantSlug),
    getDashboard(tenantSlug),
    getAlerts(tenantSlug)
  ]);

  const items =
    q.length >= 2
      ? data.items.filter(
          (r) =>
            r.title.toLowerCase().includes(q) || r.reportType.toLowerCase().includes(q)
        )
      : data.items;

  const openCount = alertsData.items.filter((a) => a.status === "Open").length;

  return (
    <TerminalShell
      activePath="/reports"
      tenantSlug={tenantSlug}
      tenantDisplayName={dashboardData.tenant.display_name}
      brandColor={dashboardData.tenant.brand_color}
      title="Briefings & reports"
      subtitle="Analyst-reviewed distributed outputs"
      openAlertsCount={openCount}
      tenants={tenants}
      userEmail={userEmail}
    >
      <section className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-[1.2fr_380px] lg:items-start">
        <div className="overflow-hidden rounded-soft border border-border bg-surface shadow-sm">
          {items.map((report, index) => (
            <div
              key={report.reportId}
              className="grid grid-cols-1 gap-2 border-b border-border px-3 py-3 text-sm last:border-b-0 lg:grid-cols-[64px_minmax(0,1fr)_120px_120px_1fr] lg:items-center lg:gap-3"
            >
              <div className="text-2xs font-medium uppercase text-accent-green">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="font-medium text-stone-900">{report.title}</div>
              <div className="text-xs text-accent-brown">{formatStatus(report.approvalStatus)}</div>
              <div className="text-xs text-muted">{formatStatus(report.reportType)}</div>
              <div className="min-w-0">
                <ReportExportButton
                  tenantSlug={tenantSlug}
                  reportId={report.reportId}
                  initialExports={report.exports}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2">
          <div className="rounded-soft border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Export formats</div>
            {data.exportFormats.map((item) => (
              <div key={item} className="border-b border-border px-3 py-2 text-xs text-stone-700 last:border-b-0">
                {item}
              </div>
            ))}
          </div>
          <div className="rounded-soft border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Distribution controls</div>
            {data.distributionControls.map((item) => (
              <div key={item} className="border-b border-border px-3 py-2 text-xs text-stone-700 last:border-b-0">
                {item}
              </div>
            ))}
          </div>
          <div className="rounded-soft border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Ready templates</div>
            {data.templates.map((item) => (
              <div key={item} className="border-b border-border px-3 py-2 text-xs text-stone-700 last:border-b-0">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </TerminalShell>
  );
}
