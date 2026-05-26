"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { enqueueReportExport, getExportStatus, type ExportFormat } from "../actions/export";
import type { ReportExportState } from "../lib/api";

type Props = {
  tenantSlug: string;
  reportId: string;
  initialExports: {
    pdf?: ReportExportState;
    markdown_bundle?: ReportExportState;
  };
};

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "pdf", label: "PDF" },
  { id: "markdown_bundle", label: "MD" },
];

function formatKey(format: ExportFormat): "pdf" | "markdown_bundle" {
  return format;
}

export function ReportExportButton({ tenantSlug, reportId, initialExports }: Props) {
  const [exports, setExports] = useState(initialExports);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedPolls = useRef(new Set<string>());

  const pollExport = useCallback(
    async (format: ExportFormat, exportId: string) => {
      const pollKey = `${format}:${exportId}`;
      if (startedPolls.current.has(pollKey)) return;
      startedPolls.current.add(pollKey);

      setActiveFormat(format);
      setBusy(true);
      setError(null);

      let attempts = 0;
      const maxAttempts = 40;

      const poll = async () => {
        const row = await getExportStatus(tenantSlug, exportId);
        setExports((prev) => ({
          ...prev,
          [formatKey(format)]: {
            exportId,
            status: row.status,
            storageUrl: row.storage_url,
            errorMessage: row.error_message,
          },
        }));

        if (row.status === "completed" || row.status === "failed" || row.error_message) {
          setBusy(false);
          setActiveFormat(null);
          if (row.error_message) {
            setError(row.error_message);
          }
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          setBusy(false);
          setActiveFormat(null);
          setError("Export still processing; check again later.");
          return;
        }
        window.setTimeout(poll, 1500);
      };

      window.setTimeout(poll, 500);
    },
    [tenantSlug]
  );

  useEffect(() => {
    for (const format of FORMATS) {
      const state = initialExports[formatKey(format.id)];
      if (state && (state.status === "queued" || state.status === "processing")) {
        void pollExport(format.id, state.exportId);
      }
    }
  }, [initialExports, pollExport]);

  const run = useCallback(
    async (format: ExportFormat) => {
      const existing = exports[formatKey(format)];
      if (existing?.status === "completed" && existing.storageUrl) {
        window.open(existing.storageUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (existing && (existing.status === "queued" || existing.status === "processing")) {
        void pollExport(format, existing.exportId);
        return;
      }

      setError(null);
      setBusy(true);
      setActiveFormat(format);
      try {
        const { exportId } = await enqueueReportExport(tenantSlug, reportId, format);
        setExports((prev) => ({
          ...prev,
          [formatKey(format)]: {
            exportId,
            status: "queued",
            storageUrl: null,
            errorMessage: null,
          },
        }));
        await pollExport(format, exportId);
      } catch (e) {
        setBusy(false);
        setActiveFormat(null);
        setError(e instanceof Error ? e.message : "Export failed");
      }
    },
    [exports, pollExport, reportId, tenantSlug]
  );

  return (
    <div className="flex flex-wrap items-center gap-1">
      {FORMATS.map((f) => (
        <button
          key={f.id}
          type="button"
          disabled={busy && activeFormat !== f.id}
          onClick={() => run(f.id)}
          className="rounded border border-accent-green/35 bg-accent-green/10 px-2 py-0.5 text-2xs font-medium text-accent-green hover:bg-accent-green/20 disabled:opacity-50"
        >
          {f.label}
        </button>
      ))}
      {activeFormat && exports[formatKey(activeFormat)] ? (
        <span className="text-2xs text-muted">{exports[formatKey(activeFormat)]!.status}</span>
      ) : null}
      {error ? <span className="text-2xs text-red-600">{error}</span> : null}
    </div>
  );
}
