"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { withTenant } from "../lib/navigation";

type Props = {
  tenantSlug: string;
  from?: string;
  to?: string;
};

function normalizeDateValue(v: string): string {
  // Expect YYYY-MM-DD from <input type="date">. Keep as-is for server parse.
  return v.trim();
}

export function SignalDateFilter({ tenantSlug, from, to }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const push = useCallback(
    (nextFrom: string | undefined, nextTo: string | undefined) => {
      const params = new URLSearchParams(sp.toString());
      if (nextFrom) params.set("from", nextFrom);
      else params.delete("from");
      if (nextTo) params.set("to", nextTo);
      else params.delete("to");
      params.delete("offset");
      const qs = params.toString();
      router.push(withTenant(qs ? `${pathname}?${qs}` : pathname, tenantSlug));
    },
    [pathname, router, sp, tenantSlug]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted">
        <span>From</span>
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) => push(normalizeDateValue(e.target.value) || undefined, to)}
          className="rounded-soft border border-border bg-white px-2 py-1 text-xs font-medium text-stone-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent-green/40"
        />
      </label>
      <label className="inline-flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted">
        <span>To</span>
        <input
          type="date"
          value={to ?? ""}
          onChange={(e) => push(from, normalizeDateValue(e.target.value) || undefined)}
          className="rounded-soft border border-border bg-white px-2 py-1 text-xs font-medium text-stone-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent-green/40"
        />
      </label>
      {(from || to) && (
        <button
          type="button"
          onClick={() => push(undefined, undefined)}
          className="text-2xs font-medium text-accent-brown hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

