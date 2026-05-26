import { Queue, type ConnectionOptions } from "bullmq";
import { getConfig } from "@landscrape/config";
import { one } from "@landscrape/db";
import { getRedisConnection } from "./connection";
import { queueIdForJob } from "./queues";
import type { ExportReportPayload } from "./types";

export type ReportExportFormat = "pdf" | "pptx" | "markdown_bundle";

const DEFAULT_EXPORT_FORMATS: ReportExportFormat[] = ["pdf", "markdown_bundle"];

async function addExportReportJob(payload: ExportReportPayload): Promise<void> {
  const config = getConfig();
  const connection = getRedisConnection() as unknown as ConnectionOptions;
  const q = new Queue(queueIdForJob("export:report"), { connection, prefix: config.queuePrefix });
  await q.add("export:report", payload, {
    attempts: Number(process.env.LANDSCRAPE_JOB_ATTEMPTS ?? 3),
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
    priority: config.jobPriorityUser,
  });
}

export async function enqueueReportExport(
  tenantId: string,
  reportId: string,
  format: ReportExportFormat
): Promise<{ exportId: string; status: string }> {
  const row = await one<{ export_id: string }>(
    `INSERT INTO report_exports (tenant_id, report_id, format, status) VALUES ($1, $2, $3, 'queued') RETURNING export_id`,
    [tenantId, reportId, format]
  );
  if (!row) throw new Error("Failed to create report export");

  const payload: ExportReportPayload = {
    tenantId,
    reportId,
    exportId: row.export_id,
    format,
  };
  await addExportReportJob(payload);

  return { exportId: row.export_id, status: "queued" };
}

export async function enqueueDefaultReportExports(
  tenantId: string,
  reportId: string
): Promise<Array<{ exportId: string; format: ReportExportFormat; status: string }>> {
  const results: Array<{ exportId: string; format: ReportExportFormat; status: string }> = [];
  for (const format of DEFAULT_EXPORT_FORMATS) {
    const result = await enqueueReportExport(tenantId, reportId, format);
    results.push({ ...result, format });
  }
  return results;
}
