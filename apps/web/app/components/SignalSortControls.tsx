"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { SignalSort } from "../lib/signals";
import { SIGNAL_SORT_OPTIONS } from "../lib/signals";
import { withTenant } from "../lib/navigation";

type Props = {
  tenantSlug: string;
  value: SignalSort;
};

export function SignalSortControls({ tenantSlug, value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const options = useMemo(() => SIGNAL_SORT_OPTIONS, []);

  const onChange = useCallback(
    (next: string) => {
      const nextSort: SignalSort =
        next === "importance_desc" || next === "first_seen_desc" || next === "updated_desc"
          ? next
          : "updated_desc";

      const params = new URLSearchParams(sp.toString());
      params.set("sort", nextSort);
      params.delete("offset");
      const qs = params.toString();
      router.push(withTenant(qs ? `${pathname}?${qs}` : pathname, tenantSlug));
    },
    [pathname, router, sp, tenantSlug]
  );

  return (
    <label className="inline-flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted">
      <span>Sort</span>
      <select
        className="cursor-pointer rounded-soft border border-border bg-white px-2 py-1 text-xs font-medium text-stone-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent-green/40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

