"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useState } from "react";
import type { SignalType } from "@landscrape/types";
import { ALL_SIGNAL_TYPES, labelForSignalType } from "../lib/signalTopics";
import { withTenant } from "../lib/navigation";

type Props = {
  tenantSlug: string;
  hiddenTypes: SignalType[];
  currentQuery: string;
  basePath?: string;
};

function TopicsChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${
        expanded ? "rotate-0" : "-rotate-90"
      }`}
      aria-hidden
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SignalTopicFilter({ tenantSlug, hiddenTypes, currentQuery, basePath = "/" }: Props) {
  const router = useRouter();
  const panelId = useId();
  const [topicsOpen, setTopicsOpen] = useState(true);

  const pushFilters = useCallback(
    (hide: SignalType[], q: string) => {
      const params = new URLSearchParams();
      if (q.length >= 2) params.set("q", q);
      if (hide.length > 0) params.set("hide", hide.join(","));
      const qs = params.toString();
      const path = qs ? `${basePath}?${qs}` : basePath;
      router.push(withTenant(path, tenantSlug));
    },
    [router, tenantSlug, basePath]
  );

  const toggle = (t: SignalType) => {
    const next = new Set(hiddenTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    pushFilters([...next], currentQuery);
  };

  const showAll = () => pushFilters([], currentQuery);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-stone-50/40 px-3 py-2">
      <button
        type="button"
        aria-expanded={topicsOpen}
        aria-controls={panelId}
        onClick={() => setTopicsOpen((o) => !o)}
        className="inline-flex shrink-0 items-center gap-1 rounded-sm text-left text-2xs font-semibold uppercase tracking-wide text-muted hover:text-stone-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green/50"
      >
        <TopicsChevron expanded={topicsOpen} />
        <span>Topics</span>
      </button>
      {topicsOpen ? (
        <>
          <div id={panelId} className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {ALL_SIGNAL_TYPES.map((t) => {
              const hidden = hiddenTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  aria-pressed={!hidden}
                  title={hidden ? `Show ${labelForSignalType(t)}` : `Hide ${labelForSignalType(t)}`}
                  className={`rounded-full border px-2.5 py-0.5 text-2xs font-medium transition ${
                    hidden
                      ? "border-border bg-white/80 text-muted line-through opacity-70 hover:opacity-100"
                      : "border-accent-green/40 bg-accent-green/10 text-stone-800 shadow-sm hover:border-accent-green/60"
                  }`}
                >
                  {labelForSignalType(t)}
                </button>
              );
            })}
          </div>
          {hiddenTypes.length > 0 ? (
            <button
              type="button"
              onClick={showAll}
              className="shrink-0 text-2xs font-medium text-accent-brown hover:underline"
            >
              Show all
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
