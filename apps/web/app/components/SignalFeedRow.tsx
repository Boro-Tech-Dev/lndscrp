import Link from "next/link";
import type { SignalItem } from "../lib/api";
import { withTenant } from "../lib/navigation";

type Props = {
  tenantSlug: string;
  signal: SignalItem;
  variant?: "dashboard" | "signals";
};

function formatType(t: string): string {
  return t.replace(/_/g, " ");
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "2-digit" });
}

export function SignalFeedRow({ tenantSlug, signal, variant = "dashboard" }: Props) {
  const href = withTenant(`/signals/${signal.signalId}`, tenantSlug);
  const typeLabel = formatType(signal.signalType);

  if (variant === "signals") {
    return (
      <div className="grid grid-cols-1 gap-2 border-b border-border px-3 py-2.5 text-sm last:border-b-0 sm:grid-cols-[minmax(0,96px)_minmax(0,1fr)_minmax(0,84px)_minmax(0,98px)_minmax(0,44px)] sm:items-start sm:gap-3">
        <div className="text-2xs font-medium uppercase leading-snug text-accent-green">{typeLabel}</div>
        <div>
          <Link href={href} className="font-semibold text-stone-900 hover:text-accent-green hover:underline">
            {signal.title}
          </Link>
          <div className="mt-0.5 text-xs leading-relaxed text-muted">{signal.summary}</div>
        </div>
        <div className="text-xs text-muted sm:pt-0">{formatDateShort(signal.firstSeenAt)}</div>
        <div className="text-xs text-muted sm:pt-0">{signal.approvalStatus.replace(/_/g, " ")}</div>
        <div className="text-right text-sm font-semibold text-red-700/90 tabular-nums sm:pt-0">{signal.importanceScore}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 border-b border-border px-3 py-2.5 text-sm last:border-b-0 sm:grid-cols-[minmax(0,88px)_minmax(0,1fr)_minmax(0,44px)] sm:items-start sm:gap-3">
      <div className="text-2xs font-medium uppercase leading-snug text-accent-green">{typeLabel}</div>
      <div>
        <Link href={href} className="font-semibold text-stone-900 hover:text-accent-green hover:underline">
          {signal.title}
        </Link>
        <div className="mt-0.5 text-xs leading-relaxed text-muted">{signal.summary}</div>
      </div>
      <div className="text-right text-sm font-semibold text-red-700/90 tabular-nums sm:pt-0">{signal.importanceScore}</div>
    </div>
  );
}

