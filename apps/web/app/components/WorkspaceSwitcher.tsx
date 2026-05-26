"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { TenantOption } from "./TerminalShell";
import { DEFAULT_TENANT } from "../lib/tenantConstants";

type WorkspaceSwitcherProps = {
  tenants: TenantOption[];
  currentSlug: string;
  accentColor?: string;
};

export function WorkspaceSwitcher({ tenants, currentSlug, accentColor }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefForTenant = useCallback(
    (slug: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (slug === DEFAULT_TENANT) {
        p.delete("tenant");
      } else {
        p.set("tenant", slug);
      }
      const q = p.toString();
      return q ? `${pathname}?${q}` : pathname;
    },
    [pathname, searchParams]
  );

  const onChange = useCallback(
    (slug: string) => {
      router.push(hrefForTenant(slug));
    },
    [hrefForTenant, router]
  );

  const active = useMemo(
    () => tenants.find((t) => t.tenant_slug === currentSlug) ?? tenants[0],
    [tenants, currentSlug]
  );

  const value = active?.tenant_slug ?? currentSlug;

  return (
    <label className="block">
      <span className="sr-only">Workspace</span>
      <select
        aria-label="Workspace"
        className="w-full max-w-full cursor-pointer rounded-soft border px-2.5 py-2 text-xs font-medium text-stone-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-stone-400"
        style={
          accentColor
            ? {
                borderColor: accentColor,
                backgroundColor: `${accentColor}1a`
              }
            : undefined
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {tenants.map((t) => (
          <option key={t.tenant_slug} value={t.tenant_slug}>
            {t.display_name}
          </option>
        ))}
      </select>
    </label>
  );
}
