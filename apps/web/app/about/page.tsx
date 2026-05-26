import { AboutGuide } from "../components/AboutGuide";
import { TerminalShell } from "../components/TerminalShell";
import { getAlerts, getDashboard } from "../lib/api";
import { getShellContext } from "../lib/shellContext";

export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug, userEmail, tenants } = await getShellContext(sp, "/about");

  const [dashboardData, alertsData] = await Promise.all([getDashboard(tenantSlug), getAlerts(tenantSlug)]);

  return (
    <TerminalShell
      activePath="/about"
      tenantSlug={tenantSlug}
      tenantDisplayName={dashboardData.tenant.display_name}
      brandColor={dashboardData.tenant.brand_color}
      title="About"
      subtitle="How LandScrape uses models, tools, and public clinical data"
      openAlertsCount={alertsData.items.length}
      tenants={tenants}
      userEmail={userEmail}
    >
      <AboutGuide tenantSlug={tenantSlug} />
    </TerminalShell>
  );
}
