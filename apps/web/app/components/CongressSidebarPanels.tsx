type CongressSidebarPanelsProps = {
  eventState: {
    sessionDensity: number;
    competitorPresence: number;
    kolEngagement: number;
  };
  themes: string[];
  outputs: string[];
};

export function CongressSidebarPanels({ eventState, themes, outputs }: CongressSidebarPanelsProps) {
  return (
    <div className="grid gap-2">
      <div className="rounded-soft border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Event state</div>
        <div className="divide-y divide-border text-xs">
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted">Session density</span>
            <strong>{eventState.sessionDensity}</strong>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted">Competitor presence</span>
            <strong>{eventState.competitorPresence}</strong>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted">KOL engagement</span>
            <strong>{eventState.kolEngagement}</strong>
          </div>
        </div>
      </div>
      <div className="rounded-soft border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Most discussed themes</div>
        {themes.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted">No themes from ingest yet.</div>
        ) : (
          themes.map((item) => (
            <div key={item} className="border-b border-border px-3 py-2 text-xs text-stone-700 last:border-b-0">
              {item}
            </div>
          ))
        )}
      </div>
      <div className="rounded-soft border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Ready outputs</div>
        {outputs.map((item) => (
          <div key={item} className="border-b border-border px-3 py-2 text-xs text-stone-700 last:border-b-0">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
