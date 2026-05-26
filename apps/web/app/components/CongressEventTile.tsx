import type { WorkspaceCongressEvent } from "@landscrape/types";
import { CongressCountdown } from "./CongressCountdown";

function priorityLabel(priority: WorkspaceCongressEvent["priority"]): string {
  if (priority === "imminent") return "Imminent";
  if (priority === "pivotal") return "Pivotal readout";
  if (priority === "watch") return "Watch list";
  return "Expected presence";
}

function priorityClass(priority: WorkspaceCongressEvent["priority"]): string {
  if (priority === "imminent") return "bg-red-100 text-red-900";
  if (priority === "pivotal") return "bg-amber-100 text-amber-900";
  if (priority === "watch") return "bg-stone-200 text-stone-700";
  return "bg-accent-green/15 text-accent-green";
}

function formatEventRange(startsAt: string, endsAt: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  };
  const start = new Date(startsAt).toLocaleDateString("en-US", opts);
  const end = new Date(endsAt).toLocaleDateString("en-US", opts);
  return `${start} – ${end}`;
}

function formatSessionTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  });
}

type Props = {
  event: WorkspaceCongressEvent;
};

export function CongressEventTile({ event }: Props) {
  return (
    <article className="rounded-soft border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-stone-900">{event.acronym}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${priorityClass(event.priority)}`}
            >
              {priorityLabel(event.priority)}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-stone-800">{event.name}</p>
          <p className="text-xs text-muted">{event.location}</p>
        </div>
      </div>

      <div className="mt-3">
        <CongressCountdown startsAt={event.startsAt} endsAt={event.endsAt} />
      </div>

      <p className="mt-2 text-2xs tabular-nums text-muted">
        {formatEventRange(event.startsAt, event.endsAt, event.timezone)}
      </p>

      {event.focusTags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {event.focusTags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-border bg-accent-brown/5 px-1.5 py-0.5 text-2xs text-stone-700"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {event.brands.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {event.brands.map((b) => (
            <span
              key={b.brandName}
              className={
                b.role === "owned"
                  ? "rounded-full border-2 border-accent-green bg-accent-green/5 px-2 py-0.5 text-2xs font-medium text-stone-800"
                  : b.presence === "confirmed"
                    ? "rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-2xs font-medium text-amber-900"
                    : "rounded-full border border-border bg-stone-50 px-2 py-0.5 text-2xs text-stone-600"
              }
            >
              {b.brandName}
              {b.presence === "confirmed" ? " · confirmed" : ""}
            </span>
          ))}
        </div>
      ) : null}

      {event.summary ? <p className="mt-3 text-xs leading-relaxed text-stone-700">{event.summary}</p> : null}

      {event.headlineSessions.length > 0 ? (
        <div className="mt-3 border-t border-border pt-2">
          <div className="text-2xs font-semibold uppercase tracking-wide text-muted">Headline sessions</div>
          <ul className="mt-1 space-y-2">
            {event.headlineSessions.map((s) => (
              <li key={`${s.title}-${s.startsAt}`} className="text-xs">
                <div className="font-medium text-stone-900">{s.title}</div>
                <div className="mt-0.5 text-muted">
                  {s.brandName}
                  {s.abstractId ? ` · #${s.abstractId}` : ""}
                  {" · "}
                  {formatSessionTime(s.startsAt, event.timezone)}
                </div>
                {s.sessionLabel ? <div className="text-2xs text-muted">{s.sessionLabel}</div> : null}
                {s.url ? (
                  <a
                    href={s.url}
                    className="mt-0.5 inline-block font-medium text-accent-green hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Details
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {event.programUrl ? (
        <div className="mt-3">
          <a
            href={event.programUrl}
            className="text-xs font-medium text-accent-green hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Official program
          </a>
        </div>
      ) : null}
    </article>
  );
}
