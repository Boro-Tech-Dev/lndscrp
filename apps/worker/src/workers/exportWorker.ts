import { getConfig } from "@landscrape/config";
import { one, query } from "@landscrape/db";
import { createWorkerForQueue } from "@landscrape/jobs";
import type { ExportReportPayload } from "@landscrape/jobs";
import { insertJobRun, completeJobRun, failJobRun } from "../jobRuns";
import { uploadArtifact } from "../storage";
import { registerWorker } from "../workerRegistry";

async function getPlaywright() {
  const m = await import("playwright");
  return m;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handle(data: unknown, jobId?: string): Promise<void> {
  const p = data as ExportReportPayload;
  let runId: string | null = null;
  try {
    runId = await insertJobRun(p.tenantId, "export:report", jobId, { reportId: p.reportId, exportId: p.exportId });
    await query(`UPDATE report_exports SET status = 'processing' WHERE export_id = $1`, [p.exportId]);

    const report = await one<{ body_markdown: string; title: string }>(
      `SELECT body_markdown, title FROM reports WHERE tenant_id = $1 AND report_id = $2`,
      [p.tenantId, p.reportId]
    );
    if (!report) throw new Error("report not found");

    const config = getConfig();
    const safeMd = escapeHtml(report.body_markdown);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;line-height:1.5;white-space:pre-wrap;}</style></head><body><h1>${escapeHtml(report.title)}</h1><div>${safeMd.replace(/\n/g, "<br/>")}</div></body></html>`;

    if (p.format === "pptx") {
      throw new Error("PPTX export not implemented; use pdf or markdown_bundle");
    }

    if (p.format === "markdown_bundle") {
      const key = `${p.tenantId}/exports/${p.exportId}/report.md`;
      const up = await uploadArtifact(key, Buffer.from(report.body_markdown, "utf8"), "text/markdown; charset=utf-8");
      await query(
        `UPDATE report_exports SET status = 'completed', storage_key = $2, storage_url = $3, finished_at = NOW() WHERE export_id = $1`,
        [p.exportId, up.storageKey, up.storageUrl]
      );
      await completeJobRun(runId);
      return;
    }

    const pw = await getPlaywright();
    const browser = await pw.chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdfBuf = await page.pdf({ format: "A4", printBackground: true });
      const key = `${p.tenantId}/exports/${p.exportId}/report.pdf`;
      const up = await uploadArtifact(key, Buffer.from(pdfBuf), "application/pdf");
      await query(
        `UPDATE report_exports SET status = 'completed', storage_key = $2, storage_url = $3, finished_at = NOW() WHERE export_id = $1`,
        [p.exportId, up.storageKey, up.storageUrl]
      );
    } finally {
      await browser.close();
    }

    await completeJobRun(runId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await query(`UPDATE report_exports SET status = 'failed', error_message = $2, finished_at = NOW() WHERE export_id = $1`, [p.exportId, msg]).catch(() => {});
    if (runId) await failJobRun(runId, msg);
    throw e;
  }
}

export function startExportWorker(): void {
  const { exportConcurrency } = getConfig();
  registerWorker(createWorkerForQueue("export:report", (d, id) => handle(d, id), exportConcurrency));
  console.log("[worker] export:report listening");
}
