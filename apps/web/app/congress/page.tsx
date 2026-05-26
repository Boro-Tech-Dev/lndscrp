import { CongressEventTile } from "../components/CongressEventTile";
import { CongressSidebarPanels } from "../components/CongressSidebarPanels";
import { TerminalShell } from "../components/TerminalShell";
import { getAlerts, getCongress, getDashboard } from "../lib/api";
import { getShellContext } from "../lib/shellContext";

function eventMatchesQuery(
  event: import("@landscrape/types").WorkspaceCongressEvent,
  q: string
): boolean {
  const haystack = [
    event.acronym,
    event.name,
    event.location,
    event.summary,
    ...event.focusTags,
    ...event.brands.map((b) => b.brandName),
    ...event.headlineSessions.map((s) => s.title),
    ...event.headlineSessions.map((s) => s.brandName),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export default async function CongressPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug, userEmail, tenants } = await getShellContext(sp, "/congress");
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const [data, dashboardData, alertsData] = await Promise.all([
    getCongress(tenantSlug),
    getDashboard(tenantSlug),
    getAlerts(tenantSlug)
  ]);

  const events =
    q.length >= 2 ? data.events.filter((e) => eventMatchesQuery(e, q)) : data.events;

  const timeline =
    q.length >= 2
      ? data.timeline.filter(
          (e) =>
            e.session.toLowerCase().includes(q) ||
            e.takeaway.toLowerCase().includes(q) ||
            e.slot.toLowerCase().includes(q)
        )
      : data.timeline;

  const openCount = alertsData.items.filter((a) => a.status === "Open").length;

  return (
    <TerminalShell
      activePath="/congress"
      tenantSlug={tenantSlug}
      tenantDisplayName={dashboardData.tenant.display_name}
      brandColor={dashboardData.tenant.brand_color}
      title="Congress war room"
      subtitle="Live sessions, KOL themes, and event-mode synthesis"
      openAlertsCount={openCount}
      tenants={tenants}
      userEmail={userEmail}
      sidebarFooter={
        <CongressSidebarPanels
          eventState={data.eventState}
          themes={data.themes}
          outputs={data.outputs}
        />
      }
    >
      <section className="grid gap-3">
          {events.length === 0 ? (
            <div className="rounded-soft border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              {q.length >= 2
                ? "No congress events match your search."
                : "No congress events in this workspace yet."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {events.map((event) => (
                <CongressEventTile key={event.eventId} event={event} />
              ))}
            </div>
          )}

          {timeline.length > 0 ? (
            <div className="overflow-hidden rounded-soft border border-border bg-surface shadow-sm">
              <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">
                Live session feed
              </div>
              {timeline.map((entry) => (
                <div
                  key={`${entry.slot}-${entry.session}`}
                  className="grid grid-cols-1 gap-2 border-b border-border px-3 py-2.5 text-sm last:border-b-0 lg:grid-cols-[72px_220px_minmax(0,1fr)] lg:gap-3"
                >
                  <div className="text-2xs font-medium uppercase text-accent-green">{entry.slot}</div>
                  <div className="font-semibold text-stone-900">{entry.session}</div>
                  <div className="text-stone-700">{entry.takeaway}</div>
                </div>
              ))}
            </div>
          ) : null}
      </section>
    </TerminalShell>
  );
}
