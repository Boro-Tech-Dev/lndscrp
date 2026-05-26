import { createWorkerForQueue } from "@landscrape/jobs";
import type { PdfExtractPayload } from "@landscrape/jobs";
import { getConfig } from "@landscrape/config";
import { query, one } from "@landscrape/db";
import fetch from "node-fetch";
import { insertJobRun, completeJobRun, failJobRun } from "../jobRuns";
import { uploadArtifact } from "../storage";
import { registerWorker } from "../workerRegistry";

async function parsePdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2 CJS export — use require for stable callable
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text?: string }>;
  const out = await pdfParse(buffer);
  return out.text ?? "";
}

async function handle(data: unknown, jobId?: string | undefined): Promise<void> {
  const p = data as PdfExtractPayload;
  let runId: string | null = null;
  try {
    runId = await insertJobRun(p.tenantId, "pdf:extract", jobId, { sourceItemId: p.sourceItemId });
    if (!p.pdfUrl) throw new Error("pdf:extract missing pdfUrl");

    const res = await fetch(p.pdfUrl);
    if (!res.ok) throw new Error(`PDF fetch ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const text = (await parsePdf(buf)).trim();

    const config = getConfig();
    const storageKey = `${p.tenantId}/pdf/${p.sourceItemId}/document.pdf`;
    const uploaded = await uploadArtifact(storageKey, buf, "application/pdf");

    await one(
      `INSERT INTO source_assets (tenant_id, source_id, source_check_id, source_item_id, asset_type, storage_provider, storage_bucket, storage_key, storage_url, content_type, byte_size, metadata)
       VALUES ($1,$2,NULL,$3,'pdf',$4,$5,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT (tenant_id, source_item_id, asset_type, storage_key) DO UPDATE SET storage_url = EXCLUDED.storage_url, byte_size = EXCLUDED.byte_size, updated_at = NOW()`,
      [
        p.tenantId,
        p.sourceId,
        p.sourceItemId,
        "s3",
        config.storageBucket,
        uploaded.storageKey,
        uploaded.storageUrl,
        uploaded.contentType,
        uploaded.byteSize,
        JSON.stringify({ source: "pdf_extract" }),
      ]
    );

    const textKey = `${p.tenantId}/pdf/${p.sourceItemId}/extracted.txt`;
    const textUploaded = await uploadArtifact(textKey, Buffer.from(text, "utf8"), "text/plain; charset=utf-8");

    await one(
      `INSERT INTO source_assets (tenant_id, source_id, source_check_id, source_item_id, asset_type, storage_provider, storage_bucket, storage_key, storage_url, content_type, byte_size, metadata)
       VALUES ($1,$2,NULL,$3,'extracted_text',$4,$5,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT (tenant_id, source_item_id, asset_type, storage_key) DO UPDATE SET storage_url = EXCLUDED.storage_url, byte_size = EXCLUDED.byte_size, updated_at = NOW()`,
      [
        p.tenantId,
        p.sourceId,
        p.sourceItemId,
        "s3",
        config.storageBucket,
        textUploaded.storageKey,
        textUploaded.storageUrl,
        textUploaded.contentType,
        textUploaded.byteSize,
        JSON.stringify({ source: "pdf_extract" }),
      ]
    );

    await query(`UPDATE source_items SET raw_content = raw_content || $2, metadata = metadata || $3::jsonb, updated_at = NOW() WHERE source_item_id = $1`, [
      p.sourceItemId,
      "\n\n--- PDF extract ---\n" + text.slice(0, 50_000),
      JSON.stringify({ pdfExtracted: true }),
    ]);

    await completeJobRun(runId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) await failJobRun(runId, msg);
    throw e;
  }
}

export function startPdfWorker(): void {
  const { pdfConcurrency } = getConfig();
  registerWorker(createWorkerForQueue("pdf:extract", (data, id) => handle(data, id), pdfConcurrency));
  console.log("[worker] pdf:extract listening");
}
