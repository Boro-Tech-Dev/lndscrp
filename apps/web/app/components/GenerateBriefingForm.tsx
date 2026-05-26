"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { generateExecutiveBrief, generateExecutiveBriefDeep } from "../actions/briefing";
import { DEFAULT_TENANT } from "../lib/tenantConstants";

function DeepBriefButton({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setError(null);
    setBusy(true);
    setStatus("Queued…");
    try {
      const result = await generateExecutiveBriefDeep(tenantSlug);
      if (result.status === "queued" && result.briefJobId) {
        let attempts = 0;
        const poll = async () => {
          const row = await fetch(`/api/brief-jobs/${tenantSlug}/${result.briefJobId}`).then((r) => r.json()) as {
            status: string;
            error_message?: string;
          };
          setStatus(row.status);
          if (row.status === "completed") {
            setBusy(false);
            router.refresh();
            return;
          }
          if (row.status === "failed") {
            setBusy(false);
            setError(row.error_message ?? "Brief failed");
            return;
          }
          attempts += 1;
          if (attempts >= 60) {
            setBusy(false);
            setError("Brief still processing; check Reports later.");
            return;
          }
          window.setTimeout(poll, 2000);
        };
        window.setTimeout(poll, 1000);
        return;
      }
      setBusy(false);
      router.refresh();
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Brief failed");
    }
  }, [router, tenantSlug]);

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="w-full rounded-soft border border-accent-brown/40 bg-accent-brown/10 px-2.5 py-2 text-xs font-semibold text-accent-brown shadow-sm transition hover:bg-accent-brown/15 disabled:opacity-50"
      >
        Deep brief (agent)
      </button>
      {status ? <p className="text-2xs text-muted">{status}</p> : null}
      {error ? <p className="text-2xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function GenerateBriefingForm({ tenantSlug }: { tenantSlug: string }) {
  return (
    <div className="space-y-2 px-2">
      <form action={generateExecutiveBrief.bind(null, tenantSlug)}>
        <button
          type="submit"
          className="w-full rounded-soft border border-accent-green/40 bg-accent-green/10 px-2.5 py-2.5 text-xs font-semibold text-accent-green shadow-sm transition hover:bg-accent-green/15"
        >
          Generate Briefing
        </button>
      </form>
      <DeepBriefButton tenantSlug={tenantSlug} />
      {tenantSlug !== DEFAULT_TENANT ? (
        <p className="text-2xs text-muted">Uses tenant {tenantSlug}</p>
      ) : null}
    </div>
  );
}
