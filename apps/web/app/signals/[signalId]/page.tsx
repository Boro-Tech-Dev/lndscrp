import Link from "next/link";
import { notFound } from "next/navigation";
import { TerminalShell } from "../../components/TerminalShell";
import { getAlerts, getDashboard, getSignal } from "../../lib/api";
import { withTenant } from "../../lib/navigation";
import { getShellContext } from "../../lib/shellContext";

export default async function SignalDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ signalId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { signalId } = await params;
  const sp = await searchParams;
  const { tenantSlug, userEmail, tenants } = await getShellContext(sp, "/signals");

  let signal!: Awaited<ReturnType<typeof getSignal>>;
  try {
    signal = await getSignal(tenantSlug, signalId);
  } catch {
    notFound();
  }

  const [dashboardData, alertsData] = await Promise.all([
    getDashboard(tenantSlug),
    getAlerts(tenantSlug)
  ]);

  const openAlerts = alertsData.items.filter((a) => a.status === "Open").length;

  return (
    <TerminalShell
      activePath="/signals"
      tenantSlug={tenantSlug}
      tenantDisplayName={dashboardData.tenant.display_name}
      brandColor={dashboardData.tenant.brand_color}
      title={signal.title}
      subtitle={`${signal.signalType.replace(/_/g, " ")} · importance ${signal.importanceScore}`}
      openAlertsCount={openAlerts}
      tenants={tenants}
      userEmail={userEmail}
    >
      <div className="mx-auto max-w-3xl rounded-soft border border-border bg-surface p-4 text-sm shadow-sm">
        <Link
          href={withTenant("/signals", tenantSlug)}
          className="text-xs font-medium text-accent-green hover:underline"
        >
          ← Signals
        </Link>
        <dl className="mt-4 space-y-3 text-stone-800">
          <div>
            <dt className="text-2xs font-semibold uppercase text-muted">Summary</dt>
            <dd className="mt-1 leading-relaxed">{signal.summary}</dd>
          </div>
          {signal.fullText ? (
            <div>
              <dt className="text-2xs font-semibold uppercase text-muted">Full text</dt>
              <dd className="mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-stone-700">
                {signal.fullText}
              </dd>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-2xs font-semibold uppercase text-muted">Competitor</dt>
              <dd>{signal.competitorBrand ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold uppercase text-muted">Region</dt>
              <dd>{signal.marketRegion ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold uppercase text-muted">Confidence</dt>
              <dd>{signal.confidenceScore}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold uppercase text-muted">Approval</dt>
              <dd>{signal.approvalStatus.replace(/_/g, " ")}</dd>
            </div>
          </div>
        </dl>
      </div>
    </TerminalShell>
  );
}
