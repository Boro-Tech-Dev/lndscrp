import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { hasAdminRole } from "@landscrape/auth";
import { GenerateBriefingForm } from "./GenerateBriefingForm";
import { ShellSearch } from "./ShellSearch";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { AuthUserMenu } from "./AuthUserMenu";
import { withTenant } from "../lib/navigation";
import { getAuthClaims } from "../lib/auth/session";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/signals", label: "Signals" },
  { href: "/competitors", label: "Competitors" },
  { href: "/congress", label: "Congress" },
  { href: "/alerts", label: "Alerts" },
  { href: "/reports", label: "Reports" },
  { href: "/research", label: "Research" },
  { href: "/about", label: "About" }
];

export type TenantOption = {
  tenant_slug: string;
  display_name: string;
  brand_color: string;
};

type TerminalShellProps = {
  activePath: string;
  tenantSlug: string;
  tenantDisplayName: string;
  brandColor?: string;
  title: string;
  subtitle: string;
  /** Inline KPIs or extra chrome on the same row as the title (e.g. dashboard stats) */
  headerExtra?: ReactNode;
  openAlertsCount: number;
  tenants?: TenantOption[];
  userEmail?: string | null;
  /** Page-specific panels below briefing buttons in the left nav */
  sidebarFooter?: ReactNode;
  children: ReactNode;
};

export async function TerminalShell({
  activePath,
  tenantSlug,
  tenantDisplayName,
  brandColor,
  title,
  subtitle,
  headerExtra,
  openAlertsCount,
  tenants = [],
  userEmail,
  sidebarFooter,
  children
}: TerminalShellProps) {
  const accent = brandColor ?? "#5a8a6e";
  const claims = await getAuthClaims();
  const adminConsoleUrl = claims && hasAdminRole(claims) ? "/admin" : null;

  return (
    <main className="min-h-screen bg-canvas text-stone-800">
      <div className="mx-auto grid min-h-screen max-w-[1680px] grid-cols-1 gap-2 p-2 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-2.5 overflow-y-auto rounded-soft border border-border bg-surface pb-2 shadow-sm">
          <div
            className="border-b border-border px-3 py-3"
            style={{
              background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 14%, transparent), transparent)`
            }}
          >
            <div className="text-2xs font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
              LS
            </div>
            <div className="mt-1 text-lg font-bold tracking-tight text-stone-900">LandScrape</div>
            <div className="text-2xs text-muted">Market intelligence workspace</div>
          </div>

          {tenants.length > 1 ? (
            <>
              <div className="px-2.5 text-2xs font-semibold uppercase tracking-[0.16em] text-muted">Workspace</div>
              <div className="px-2">
                <Suspense
                  fallback={
                    <div className="rounded-soft border border-border bg-stone-50/80 px-2.5 py-2 text-xs text-muted">
                      Workspaces…
                    </div>
                  }
                >
                  <WorkspaceSwitcher
                    tenants={tenants}
                    currentSlug={tenantSlug}
                    accentColor={accent}
                  />
                </Suspense>
              </div>
            </>
          ) : null}

          <nav className="grid gap-1.5 px-2">
            {navItems.map((item) => {
              const isActive = activePath === item.href;
              const href = withTenant(item.href, tenantSlug);
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`flex items-center justify-between rounded-soft border px-2.5 py-2 text-xs transition ${
                    isActive
                      ? "border-accent-green/45 bg-accent-green/10 font-medium text-accent-green shadow-sm"
                      : "border-border bg-stone-50/80 text-stone-600 hover:border-accent-brown/30"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-muted">›</span>
                </Link>
              );
            })}
          </nav>

          <GenerateBriefingForm tenantSlug={tenantSlug} />
          {sidebarFooter ? (
            <div className="grid gap-2 px-2">{sidebarFooter}</div>
          ) : null}
        </aside>

        <section className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-1.5 overflow-hidden">
          <div className="flex flex-col gap-1.5 rounded-soft border border-border bg-surface px-2 py-1.5 text-[11px] shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
            <Suspense
              fallback={<div className="min-h-[26px] flex-1 text-muted">Search…</div>}
            >
              <ShellSearch tenantSlug={tenantSlug} embedded />
            </Suspense>
            <div className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-tight">
              <span>
                <span className="text-muted">Alerts</span>{" "}
                <strong style={{ color: accent }}>{openAlertsCount} open</strong>
              </span>
              <span className="text-border sm:hidden">·</span>
              <span className="min-w-0 max-w-[200px] sm:max-w-none">
                <span className="text-muted">Client</span>{" "}
                <strong className="truncate font-semibold text-stone-900">{tenantDisplayName}</strong>
              </span>
              {userEmail ? <AuthUserMenu email={userEmail} /> : null}
              {adminConsoleUrl ? (
                <Link
                  href={adminConsoleUrl}
                  className="rounded-soft border border-border bg-stone-50/80 px-2 py-0.5 text-[11px] text-stone-600 hover:border-accent-brown/30"
                >
                  Admin
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-soft border border-border bg-surface px-2 py-1 text-[11px] shadow-sm">
            <div className="min-w-0 flex-shrink">
              <span className="text-sm font-semibold text-stone-900">{title}</span>
              {subtitle ? (
                <span className="ml-2 text-muted hidden sm:inline">{subtitle}</span>
              ) : null}
            </div>
            {headerExtra ? (
              <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5 text-[11px]">{headerExtra}</div>
            ) : null}
          </div>

          <div className="min-h-0 overflow-auto">{children}</div>
        </section>
      </div>
    </main>
  );
}
