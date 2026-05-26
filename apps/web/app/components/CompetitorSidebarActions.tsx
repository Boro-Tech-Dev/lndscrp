"use client";

import Link from "next/link";
import type { WorkspaceProductTile } from "@landscrape/types";
import { withTenant } from "../lib/navigation";

type Props = {
  tenantSlug: string;
  actions: string[];
  products: WorkspaceProductTile[];
  workspaceSummary: string;
};

function actionHref(action: string, tenantSlug: string): string | null {
  if (action.includes("briefing")) return withTenant("/reports", tenantSlug);
  if (action.includes("Research") || action.includes("regulatory")) {
    return withTenant("/research?q=regulatory+timeline", tenantSlug);
  }
  if (action.includes("HCP")) return withTenant("/competitors#hcp", tenantSlug);
  if (action.includes("DTC")) return withTenant("/competitors#dtc", tenantSlug);
  return null;
}

function rosterMarkdown(products: WorkspaceProductTile[], summary: string): string {
  const lines = [`# Competitor roster`, "", summary, ""];
  for (const p of products) {
    lines.push(`## ${p.brandName} (${p.genericName})`);
    lines.push(`- Role: ${p.role}`);
    lines.push(`- Class: ${p.therapeuticClass ?? "—"}`);
    lines.push(`- Indications: ${p.indications.join(", ") || "—"}`);
    lines.push(`- Lifecycle: ${p.lifecycleStage}`);
    lines.push(`- PDUFA: ${p.pdufaDate ?? "—"}${p.pdufaIsEstimated ? " (est.)" : ""}`);
    lines.push(`- Approval: ${p.approvalDate ?? "—"}`);
    lines.push(`- LOE: ${p.loeDate ?? "—"}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function CompetitorSidebarActions({ tenantSlug, actions, products, workspaceSummary }: Props) {
  const copyRoster = async () => {
    const md = rosterMarkdown(products, workspaceSummary);
    await navigator.clipboard.writeText(md);
  };

  return (
    <div className="grid w-full gap-2">
      <div className="rounded-soft border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Workspace</div>
        <p className="px-3 py-2 text-xs leading-relaxed text-stone-700">{workspaceSummary}</p>
      </div>

      <div className="rounded-soft border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold text-stone-900">Actions</div>
        {actions.map((action) => {
          const href = actionHref(action, tenantSlug);
          const isExport = action.includes("Export");
          if (isExport) {
            return (
              <button
                key={action}
                type="button"
                onClick={() => void copyRoster()}
                className="block w-full border-b border-border px-3 py-2 text-left text-xs text-accent-green hover:bg-accent-brown/5 last:border-b-0"
              >
                {action}
              </button>
            );
          }
          if (href) {
            return (
              <Link
                key={action}
                href={href}
                className="block border-b border-border px-3 py-2 text-xs text-accent-green hover:bg-accent-brown/5 hover:underline last:border-b-0"
              >
                {action}
              </Link>
            );
          }
          return (
            <div key={action} className="border-b border-border px-3 py-2 text-xs text-stone-700 last:border-b-0">
              {action}
            </div>
          );
        })}
      </div>
    </div>
  );
}
