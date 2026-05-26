import type { WorkspaceProductTile } from "@landscrape/types";

function formatDate(d: string | null, estimated?: boolean): string {
  if (!d) return "—";
  const label = d.slice(0, 10);
  return estimated ? `${label} (est.)` : label;
}

function lifecycleLabel(stage: WorkspaceProductTile["lifecycleStage"]): string {
  if (stage === "pipeline") return "Pipeline";
  if (stage === "generic") return "Generic";
  return "Approved";
}

function lifecycleClass(stage: WorkspaceProductTile["lifecycleStage"]): string {
  if (stage === "pipeline") return "bg-amber-100 text-amber-900";
  if (stage === "generic") return "bg-stone-200 text-stone-700";
  return "bg-accent-green/15 text-accent-green";
}

type Props = {
  product: WorkspaceProductTile;
};

export function CompetitorProductTile({ product }: Props) {
  const isOwned = product.role === "owned";

  return (
    <article
      className={
        isOwned
          ? "rounded-soft border-2 border-accent-green bg-accent-green/5 p-4 shadow-sm"
          : "rounded-soft border border-border bg-surface p-4 shadow-sm"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-stone-900">{product.brandName}</h3>
            {isOwned ? (
              <span className="rounded-full bg-accent-green px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-white">
                Your brand
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${lifecycleClass(product.lifecycleStage)}`}
            >
              {lifecycleLabel(product.lifecycleStage)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {product.genericName}
            {product.company ? ` · ${product.company}` : ""}
          </p>
        </div>
      </div>

      {product.therapeuticClass ? (
        <p className="mt-2 text-xs text-stone-700">
          <span className="font-medium text-stone-800">Class:</span> {product.therapeuticClass}
        </p>
      ) : null}

      {product.indications.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {product.indications.map((ind) => (
            <span
              key={ind}
              className="rounded border border-border bg-accent-brown/5 px-1.5 py-0.5 text-2xs text-stone-700"
            >
              {ind}
            </span>
          ))}
        </div>
      ) : null}

      <dl className="mt-3 grid grid-cols-3 gap-2 text-2xs">
        <div>
          <dt className="font-semibold uppercase tracking-wide text-muted">
            {product.lifecycleStage === "pipeline" ? "PDUFA / timeline" : "PDUFA"}
          </dt>
          <dd className="mt-0.5 tabular-nums text-stone-800">
            {formatDate(product.pdufaDate, product.pdufaIsEstimated)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-muted">Approval</dt>
          <dd className="mt-0.5 tabular-nums text-stone-800">{formatDate(product.approvalDate)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-muted">LOE</dt>
          <dd className="mt-0.5 tabular-nums text-stone-800">{formatDate(product.loeDate)}</dd>
        </div>
      </dl>

      {product.trialNctId ? (
        <p className="mt-2 text-2xs text-muted">
          Trial{" "}
          <a
            href={`https://clinicaltrials.gov/study/${product.trialNctId}`}
            className="text-accent-green hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {product.trialNctId}
          </a>
          {product.trialPhases.length > 0 ? ` · ${product.trialPhases.join(", ")}` : ""}
          {product.trialStatus ? ` · ${product.trialStatus}` : ""}
        </p>
      ) : null}

      {product.labelUpdates.length > 0 ? (
        <div className="mt-3 border-t border-border pt-2">
          <div className="text-2xs font-semibold uppercase tracking-wide text-muted">Label updates</div>
          <ul className="mt-1 space-y-1">
            {product.labelUpdates.slice(0, 3).map((lu) => (
              <li key={`${lu.date}-${lu.url}`} className="text-xs">
                <span className="tabular-nums text-muted">{lu.date}</span>{" "}
                <a href={lu.url} className="text-accent-green hover:underline" target="_blank" rel="noopener noreferrer">
                  {lu.title}
                </a>
                <span className="text-muted"> ({lu.source})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {product.hcpUrl ? (
          <a href={product.hcpUrl} className="font-medium text-accent-green hover:underline" target="_blank" rel="noopener noreferrer">
            HCP site
          </a>
        ) : null}
        {product.dtcUrl ? (
          <a href={product.dtcUrl} className="font-medium text-accent-green hover:underline" target="_blank" rel="noopener noreferrer">
            DTC site
          </a>
        ) : null}
        {product.labelUrl ? (
          <a href={product.labelUrl} className="font-medium text-accent-green hover:underline" target="_blank" rel="noopener noreferrer">
            Label
          </a>
        ) : null}
      </div>

      <footer className="mt-2 text-2xs text-muted">
        {product.hcpSourceCount + product.dtcSourceCount > 0
          ? `${product.hcpSourceCount} HCP · ${product.dtcSourceCount} DTC sources monitored`
          : "No channel sources linked yet"}
        {product.lastEnrichedAt ? ` · enriched ${new Date(product.lastEnrichedAt).toLocaleDateString()}` : " · enrichment pending"}
        {product.enrichmentErrors.length > 0 ? ` · ${product.enrichmentErrors.length} partial fetch warning(s)` : ""}
      </footer>
    </article>
  );
}
