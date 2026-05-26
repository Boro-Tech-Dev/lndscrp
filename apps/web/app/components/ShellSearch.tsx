"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_TENANT } from "../lib/tenantConstants";

type ShellSearchProps = {
  tenantSlug: string;
  /** Omit outer card; use inside a shared toolbar row */
  embedded?: boolean;
};

export function ShellSearch({ tenantSlug, embedded }: ShellSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const apply = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    const q = value.trim();
    if (q) {
      p.set("q", q);
    } else {
      p.delete("q");
    }
    if (tenantSlug !== DEFAULT_TENANT) {
      p.set("tenant", tenantSlug);
    } else {
      p.delete("tenant");
    }
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams, tenantSlug, value]);

  const field = (
    <>
      <label htmlFor="workspace-search" className="sr-only">
        Search workspace
      </label>
      <input
        id="workspace-search"
        className="min-w-0 flex-1 border-0 bg-transparent text-[11px] text-stone-800 outline-none placeholder:text-muted"
        placeholder="Search signals, reports…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
      />
      <button
        type="button"
        onClick={apply}
        className="shrink-0 rounded border border-accent-brown/30 bg-accent-brown/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-brown hover:bg-accent-brown/15"
      >
        Go
      </button>
      <button
        type="button"
        onClick={() => {
          const q = value.trim();
          if (q.length < 2) return;
          const p = new URLSearchParams();
          p.set("q", q);
          if (tenantSlug !== DEFAULT_TENANT) p.set("tenant", tenantSlug);
          router.push(`/research?${p.toString()}`);
        }}
        className="shrink-0 rounded border border-accent-green/30 bg-accent-green/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-green hover:bg-accent-green/15"
        title="Open research assistant with this query"
      >
        Deep research
      </button>
    </>
  );

  if (embedded) {
    return (
      <div className="flex min-h-[26px] min-w-0 flex-1 items-center gap-1.5 sm:max-w-md lg:max-w-xl">{field}</div>
    );
  }

  return (
    <div className="flex min-h-[32px] items-center rounded-soft border border-border bg-surface px-2 py-1.5 text-xs text-stone-800 shadow-sm">
      {field}
    </div>
  );
}
