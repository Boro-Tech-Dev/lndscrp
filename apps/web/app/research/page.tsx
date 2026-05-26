import { TerminalShell } from "../components/TerminalShell";
import { ResearchChat } from "../components/ResearchChat";
import { getAlerts, getDashboard } from "../lib/api";
import { getShellContext } from "../lib/shellContext";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug, userEmail, tenants } = await getShellContext(sp, "/research");
  const qRaw = typeof sp.q === "string" ? sp.q.trim() : "";
  const initialQuery = qRaw.length > 0 ? qRaw.slice(0, 4000) : undefined;

  const [dashboardData, alertsData] = await Promise.all([getDashboard(tenantSlug), getAlerts(tenantSlug)]);

  return (
    <TerminalShell
      activePath="/research"
      tenantSlug={tenantSlug}
      tenantDisplayName={dashboardData.tenant.display_name}
      brandColor={dashboardData.tenant.brand_color}
      title="Research"
      subtitle="Agent-assisted market intelligence with public clinical reference tools"
      openAlertsCount={alertsData.items.length}
      tenants={tenants}
      userEmail={userEmail}
    >
      <ResearchChat tenantSlug={tenantSlug} initialQuery={initialQuery} />
    </TerminalShell>
  );
}
