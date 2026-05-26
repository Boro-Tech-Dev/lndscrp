import { Suspense } from "react";
import { TerminalShell } from "../components/TerminalShell";
import { SignalDateFilter } from "../components/SignalDateFilter";
import { SignalFeedList } from "../components/SignalFeedList";
import { SignalPagination } from "../components/SignalPagination";
import { SignalSortControls } from "../components/SignalSortControls";
import { SignalTopicFilter } from "../components/SignalTopicFilter";
import { getAlerts, getDashboard, getSignals } from "../lib/api";
import { getShellContext } from "../lib/shellContext";
import { parseHideParam } from "../lib/signalTopics";
import { SIGNALS_PAGE_SIZE, type SignalSort } from "../lib/signals";

function parseSort(raw: unknown): SignalSort {
  const s = typeof raw === "string" ? raw : "";
  return s === "importance_desc" || s === "first_seen_desc" || s === "updated_desc" ? s : "updated_desc";
}

function parseOffset(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function parseDate(raw: unknown): string | undefined {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s : undefined;
}

export default async function SignalsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug, userEmail, tenants } = await getShellContext(sp, "/signals");

  const qRaw = typeof sp.q === "string" ? sp.q.trim() : "";
  const q = qRaw.slice(0, 200);
  const qLower = q.toLowerCase();

  const hiddenTypes = parseHideParam(sp.hide);
  const sort = parseSort(sp.sort);
  const offset = parseOffset(sp.offset);
  const from = parseDate(sp.from);
  const to = parseDate(sp.to);

  const [dashboardData, alertsData, signalData] = await Promise.all([
    getDashboard(tenantSlug),
    getAlerts(tenantSlug),
    getSignals(tenantSlug, {
      limit: SIGNALS_PAGE_SIZE,
      offset,
      sort,
      excludeTypes: hiddenTypes,
      from,
      to
    })
  ]);

  const openAlerts = alertsData.items.filter((a) => a.status === "Open").length;

  const pageItems =
    q.length >= 2
      ? signalData.items.filter(
          (s) => s.title.toLowerCase().includes(qLower) || s.summary.toLowerCase().includes(qLower)
        )
      : signalData.items;

  const params = new URLSearchParams();
  if (q.length >= 2) params.set("q", q);
  if (hiddenTypes.length > 0) params.set("hide", hiddenTypes.join(","));
  if (sort !== "updated_desc") params.set("sort", sort);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (offset > 0) params.set("offset", String(offset));

  const total = typeof signalData.total === "number" ? signalData.total : signalData.items.length;
  const limit = typeof signalData.limit === "number" ? signalData.limit : SIGNALS_PAGE_SIZE;
  const effectiveOffset = typeof signalData.offset === "number" ? signalData.offset : offset;

  return (
    <TerminalShell
      activePath="/signals"
      tenantSlug={tenantSlug}
      tenantDisplayName={dashboardData.tenant.display_name}
      brandColor={dashboardData.tenant.brand_color}
      title="Signals"
      subtitle="Full signal history for triage and review"
      openAlertsCount={openAlerts}
      tenants={tenants}
      userEmail={userEmail}
    >
      <section className="grid min-h-0 grid-cols-1 gap-2">
        <div className="flex min-h-[320px] flex-col overflow-hidden rounded-soft border border-border bg-surface shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-stone-900">All signals</div>
            <Suspense
              fallback={
                <div className="flex flex-wrap items-center gap-3 text-2xs text-muted">
                  Filters…
                </div>
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                <SignalSortControls tenantSlug={tenantSlug} value={sort} />
                <SignalDateFilter tenantSlug={tenantSlug} from={from} to={to} />
              </div>
            </Suspense>
          </div>

          <SignalTopicFilter
            tenantSlug={tenantSlug}
            hiddenTypes={hiddenTypes}
            currentQuery={q}
            basePath="/signals"
          />

          {sort !== "updated_desc" || from || to ? (
            <div className="border-b border-border bg-stone-50/40 px-3 py-2 text-2xs text-muted">
              Sorted server-side; date/type filters apply to totals and pagination.
              {q.length >= 2 ? " Search filters the current page." : null}
            </div>
          ) : q.length >= 2 ? (
            <div className="border-b border-border bg-stone-50/40 px-3 py-2 text-2xs text-muted">
              Search filters the current page.
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="hidden grid-cols-[minmax(0,96px)_minmax(0,1fr)_minmax(0,84px)_minmax(0,98px)_minmax(0,44px)] gap-3 border-b border-border px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted sm:grid">
              <div>Type</div>
              <div>Signal</div>
              <div>First seen</div>
              <div>Status</div>
              <div className="text-right">Imp.</div>
            </div>
            <SignalFeedList tenantSlug={tenantSlug} signals={pageItems} variant="signals" />
          </div>

          <SignalPagination
            tenantSlug={tenantSlug}
            total={total}
            limit={limit}
            offset={effectiveOffset}
            queryString={params.toString()}
          />
        </div>
      </section>
    </TerminalShell>
  );
}

