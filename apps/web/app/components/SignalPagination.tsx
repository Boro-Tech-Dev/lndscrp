import Link from "next/link";
import { withTenant } from "../lib/navigation";

type Props = {
  tenantSlug: string;
  total: number;
  limit: number;
  offset: number;
  queryString: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function buildHref(basePath: string, qs: string): string {
  return qs ? `${basePath}?${qs}` : basePath;
}

export function SignalPagination({ tenantSlug, total, limit, offset, queryString }: Props) {
  if (total <= limit) return null;

  const currentStart = clamp(offset + 1, 1, Math.max(total, 1));
  const currentEnd = clamp(offset + limit, 1, Math.max(total, 1));

  const params = new URLSearchParams(queryString);
  const basePath = "/signals";

  const prevOffset = Math.max(offset - limit, 0);
  const nextOffset = offset + limit;

  const prevHref = (() => {
    params.set("offset", String(prevOffset));
    if (prevOffset === 0) params.delete("offset");
    return withTenant(buildHref(basePath, params.toString()), tenantSlug);
  })();

  const nextHref = (() => {
    params.set("offset", String(nextOffset));
    return withTenant(buildHref(basePath, params.toString()), tenantSlug);
  })();

  const hasPrev = offset > 0;
  const hasNext = nextOffset < total;

  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
      <div className="text-muted">
        Showing <strong className="text-stone-900 tabular-nums">{currentStart}</strong>–
        <strong className="text-stone-900 tabular-nums">{currentEnd}</strong> of{" "}
        <strong className="text-stone-900 tabular-nums">{total}</strong>
      </div>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link href={prevHref} className="rounded-soft border border-border bg-white px-2 py-1 font-medium text-stone-800 hover:border-accent-green/40">
            ← Prev
          </Link>
        ) : (
          <span className="rounded-soft border border-border bg-stone-50 px-2 py-1 text-muted">← Prev</span>
        )}
        {hasNext ? (
          <Link href={nextHref} className="rounded-soft border border-border bg-white px-2 py-1 font-medium text-stone-800 hover:border-accent-green/40">
            Next →
          </Link>
        ) : (
          <span className="rounded-soft border border-border bg-stone-50 px-2 py-1 text-muted">Next →</span>
        )}
      </div>
    </div>
  );
}

