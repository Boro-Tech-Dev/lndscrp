import { TerminalShell } from "../components/TerminalShell";
import { CompetitorProductTile } from "../components/CompetitorProductTile";
import { CompetitorSidebarActions } from "../components/CompetitorSidebarActions";
import { getAlerts, getCompetitors, getDashboard } from "../lib/api";
import { getShellContext } from "../lib/shellContext";

export default async function CompetitorsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug, userEmail, tenants } = await getShellContext(sp, "/competitors");
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const [data, dashboardData, alertsData] = await Promise.all([
    getCompetitors(tenantSlug),
    getDashboard(tenantSlug),
    getAlerts(tenantSlug)
  ]);

  const products =
    q.length >= 2
      ? data.products.filter(
          (p) =>
            p.brandName.toLowerCase().includes(q) ||
            p.genericName.toLowerCase().includes(q) ||
            (p.therapeuticClass?.toLowerCase().includes(q) ?? false) ||
            p.indications.some((i) => i.toLowerCase().includes(q))
        )
      : data.products;

  const openCount = alertsData.items.filter((a) => a.status === "Open").length;

  return (
    <TerminalShell
      activePath="/competitors"
      tenantSlug={tenantSlug}
      tenantDisplayName={dashboardData.tenant.display_name}
      brandColor={dashboardData.tenant.brand_color}
      title="Competitor landscape"
      subtitle="Your brand and tracked competitors"
      openAlertsCount={openCount}
      tenants={tenants}
      userEmail={userEmail}
      sidebarFooter={
        <CompetitorSidebarActions
          tenantSlug={tenantSlug}
          actions={data.actions}
          products={data.products}
          workspaceSummary={data.workspaceSummary}
        />
      }
    >
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.length === 0 ? (
          <div className="col-span-full rounded-soft border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
            No products in this workspace roster yet.
          </div>
        ) : (
          products.map((product) => <CompetitorProductTile key={product.productId} product={product} />)
        )}
      </section>
    </TerminalShell>
  );
}
