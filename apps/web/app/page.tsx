import Link from "next/link";
import { TerminalShell } from "./components/TerminalShell";
import {
  getAlerts,
  getCompetitors,
  getDashboard,
  getInterpretation,
  getReports,
  getSignals,
  getSources,
  searchTenant
} from "./lib/api";
import { externalFusionLines, internalFusionLines } from "./lib/fusion";
import { withTenant } from "./lib/navigation";
import { getShellContext } from "./lib/shellContext";
import { computeSourceHealthPercent } from "./lib/sourceHealth";
import { parseHideParam } from "./lib/signalTopics";
import { SignalTopicFilter } from "./components/SignalTopicFilter";
import { SignalFeedList } from "./components/SignalFeedList";
import { HOME_SIGNAL_LIMIT } from "./lib/signals";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug, userEmail, tenants } = await getShellContext(sp, "/");
  const qRaw = typeof sp.q === "string" ? sp.q.trim() : "";
  const q = qRaw.slice(0, 200);
  const hiddenTypes = parseHideParam(sp.hide);
  const hideSet = new Set(hiddenTypes);

  const [
    dashboardData,
    signalData,
    reportsData,
    alertsData,
    sourcesData,
    interpretation,
    competitorsData
  ] = await Promise.all([
    getDashboard(tenantSlug),
    getSignals(tenantSlug, HOME_SIGNAL_LIMIT),
    getReports(tenantSlug),
    getAlerts(tenantSlug),
    getSources(tenantSlug),
    getInterpretation(tenantSlug),
    getCompetitors(tenantSlug)
  ]);

  const searchHits = q.length >= 2 ? await searchTenant(tenantSlug, q, 12, "hybrid").catch(() => null) : null;

  const sourceHealth = computeSourceHealthPercent(sourcesData.items);
  const openAlerts = alertsData.items.filter((a) => a.status === "Open").length;

  const summary = dashboardData.summary;
  const signals = signalData.items;
  const qLower = q.toLowerCase();
  const apiSignalIds = new Set(searchHits?.signals.map((s) => s.signalId) ?? []);
  const topicFiltered =
    hideSet.size === 0 ? signals : signals.filter((s) => !hideSet.has(s.signalType));
  const displayedSignals =
    q.length >= 2 && searchHits && searchHits.signals.length > 0
      ? topicFiltered.filter((s) => apiSignalIds.has(s.signalId))
      : q.length >= 2
        ? topicFiltered.filter(
            (s) =>
              s.title.toLowerCase().includes(qLower) || s.summary.toLowerCase().includes(qLower)
          )
        : topicFiltered;

  const ext = externalFusionLines(signals);
  const int = internalFusionLines(signals);
  const watchlist = competitorsData.products
    .filter((p) => p.role === "competitor")
    .slice(0, 8)
    .map((p) => p.brandName);
  const briefingTitles = reportsData.items.slice(0, 6).map((r) => r.title);
  const modeLabel = process.env.NODE_ENV === "production" ? "Live" : "Dev";

  const kpiRows: [string, string | number][] = [
    ["Signals", summary.openSignals],
    ["Priority", summary.prioritySignals],
    ["Competitors", summary.activeCompetitors],
    ["Pend.", summary.pendingApprovals],
    ["Brief.", reportsData.items.length],
    ["Mode", modeLabel],
    ["Health", `${sourceHealth}%`]
  ];

  const kpiItems = kpiRows.map(([label, value], i) => (
    <span key={label} className="inline-flex items-baseline gap-1">
      {i > 0 ? <span className="text-border select-none">|</span> : null}
      <span className="text-muted">{label}</span>
      <strong className="tabular-nums text-stone-900">{String(value)}</strong>
    </span>
  ));

  const overflowHref =
    summary.openSignals > HOME_SIGNAL_LIMIT
      ? withTenant("/signals", tenantSlug, {
          q: q.length >= 2 ? q : undefined,
          hide: hiddenTypes.length > 0 ? hiddenTypes.join(",") : undefined
        })
      : null;

  return (
    <TerminalShell
      activePath="/"
      tenantSlug={tenantSlug}
      tenantDisplayName={dashboardData.tenant.display_name}
      brandColor={dashboardData.tenant.brand_color}
      title="Dashboard"
      subtitle="Always-ready market intelligence dashboard"
      headerExtra={<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">{kpiItems}</div>}
      openAlertsCount={openAlerts}
      tenants={tenants}
      userEmail={userEmail}
    >
      <section className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-[1.45fr_320px] lg:items-start">
        <div className="flex min-h-[320px] flex-col overflow-hidden rounded-soft border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold text-stone-900">Live intelligence feed</span>
            <div className="flex items-center gap-3">
              {overflowHref ? (
                <Link href={overflowHref} className="text-2xs font-medium text-accent-brown hover:underline">
                  View all {summary.openSignals} →
                </Link>
              ) : null}
              <span className="text-2xs uppercase tracking-wide text-muted">Monitored signals</span>
            </div>
          </div>

          <SignalTopicFilter tenantSlug={tenantSlug} hiddenTypes={hiddenTypes} currentQuery={q} />

          {searchHits && (searchHits.signals.length > 0 || searchHits.reports.length > 0) ? (
            <div className="border-b border-border bg-accent-brown/5 px-3 py-2 text-xs">
              <div className="font-semibold text-stone-800">
                Hybrid search
                <span className="ml-1.5 font-normal text-muted">keyword + semantic</span>
              </div>
              {searchHits.signals.length > 0 ? (
                <ul className="mt-1 space-y-1 text-muted">
                  {searchHits.signals.map((s) => (
                    <li key={s.signalId}>
                      <Link
                        href={withTenant(`/signals/${s.signalId}`, tenantSlug)}
                        className="text-accent-green hover:underline"
                      >
                        {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {searchHits.reports.length > 0 ? (
                <ul className="mt-1 space-y-1 text-muted">
                  {searchHits.reports.map((r) => (
                    <li key={r.reportId}>
                      <Link href={withTenant("/reports", tenantSlug)} className="text-accent-brown hover:underline">
                        {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <SignalFeedList tenantSlug={tenantSlug} signals={displayedSignals} />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-soft border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">
              Priority interpretation
            </div>
            <div className="space-y-3 px-3 py-3 text-xs leading-relaxed text-stone-700">
              {interpretation.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          <div className="rounded-soft border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Briefing queue</div>
            {briefingTitles.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted">No reports yet. Generate a briefing from the sidebar.</div>
            ) : (
              briefingTitles.map((title) => (
                <div key={title} className="border-b border-border px-3 py-2 text-xs text-stone-700 last:border-b-0">
                  {title}
                </div>
              ))
            )}
          </div>

          <div className="rounded-soft border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">
              Signal-based view
            </div>
            <div className="grid grid-cols-1 divide-y divide-border border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="px-3 py-2.5">
                <div className="text-2xs font-semibold uppercase tracking-wide text-accent-brown">Internal</div>
                {int.map((line) => (
                  <div key={line} className="mt-1.5 text-xs leading-snug text-stone-700">
                    {line}
                  </div>
                ))}
              </div>
              <div className="px-3 py-2.5">
                <div className="text-2xs font-semibold uppercase tracking-wide text-accent-green">External</div>
                {ext.map((line) => (
                  <div key={line} className="mt-1.5 text-xs leading-snug text-stone-700">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-soft border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Watchlist</div>
            {watchlist.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted">No tracked entities yet.</div>
            ) : (
              watchlist.map((item) => (
                <div key={item} className="border-b border-border px-3 py-2 text-xs text-stone-700 last:border-b-0">
                  {item}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </TerminalShell>
  );
}
