import { embedText } from "@landscrape/ai";
import { query, recordOllamaUsage } from "@landscrape/db";

export interface SignalSearchHit {
  signalId: string;
  title: string;
  summary: string;
  signalType: string;
}

export interface ReportSearchHit {
  reportId: string;
  title: string;
  reportType: string;
}

export type SearchMode = "keyword" | "semantic" | "hybrid";

function escapeLikePattern(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function searchSignalsKeyword(
  tenantId: string,
  pattern: string,
  limit: number
): Promise<
  {
    signal_id: string;
    title: string;
    summary: string;
    signal_type: string;
  }[]
> {
  return query(
    `
    SELECT signal_id, title, summary, signal_type
    FROM signals
    WHERE tenant_id = $1
      AND (title ILIKE $2 ESCAPE '\\' OR summary ILIKE $2 ESCAPE '\\')
    ORDER BY updated_at DESC
    LIMIT $3
    `,
    [tenantId, pattern, limit]
  );
}

async function searchSignalsSemantic(
  tenantId: string,
  queryEmbeddingLiteral: string,
  limit: number
): Promise<
  {
    signal_id: string;
    title: string;
    summary: string;
    signal_type: string;
  }[]
> {
  return query(
    `
    SELECT signal_id, title, summary, signal_type
    FROM signals
    WHERE tenant_id = $1
      AND search_embedding IS NOT NULL
    ORDER BY search_embedding <=> $2::vector
    LIMIT $3
    `,
    [tenantId, queryEmbeddingLiteral, limit]
  );
}

async function searchReportsKeyword(tenantId: string, pattern: string, limit: number): Promise<ReportSearchHit[]> {
  const reports = await query<{
    report_id: string;
    title: string;
    report_type: string;
  }>(
    `
    SELECT report_id, title, report_type
    FROM reports
    WHERE tenant_id = $1
      AND title ILIKE $2 ESCAPE '\\'
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [tenantId, pattern, limit]
  );
  return reports.map((row) => ({
    reportId: row.report_id,
    title: row.title,
    reportType: row.report_type
  }));
}

function mapSignalRows(
  rows: {
    signal_id: string;
    title: string;
    summary: string;
    signal_type: string;
  }[]
): SignalSearchHit[] {
  return rows.map((row) => ({
    signalId: row.signal_id,
    title: row.title,
    summary: row.summary,
    signalType: row.signal_type
  }));
}

function mergeHybridSignals(keywordHits: SignalSearchHit[], semanticHits: SignalSearchHit[], limit: number): SignalSearchHit[] {
  const seen = new Set<string>();
  const out: SignalSearchHit[] = [];
  for (const s of keywordHits) {
    if (!seen.has(s.signalId)) {
      seen.add(s.signalId);
      out.push(s);
    }
    if (out.length >= limit) return out;
  }
  for (const s of semanticHits) {
    if (!seen.has(s.signalId)) {
      seen.add(s.signalId);
      out.push(s);
    }
    if (out.length >= limit) break;
  }
  return out;
}

export async function searchTenantContent(
  tenantId: string,
  rawQuery: string,
  limit = 15,
  mode: SearchMode = "keyword"
): Promise<{ signals: SignalSearchHit[]; reports: ReportSearchHit[] }> {
  const term = rawQuery.trim();
  if (term.length < 2) {
    return { signals: [], reports: [] };
  }

  const pattern = `%${escapeLikePattern(term)}%`;

  if (mode === "keyword") {
    const [signals, reports] = await Promise.all([
      searchSignalsKeyword(tenantId, pattern, limit).then(mapSignalRows),
      searchReportsKeyword(tenantId, pattern, limit)
    ]);
    return { signals, reports };
  }

  const reports = await searchReportsKeyword(tenantId, pattern, limit);

  if (mode === "semantic") {
    const { embedding: vec, usage } = await embedText(term, { priority: "user" });
    void recordOllamaUsage({
      tenantId,
      operation: "embed",
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalDurationNs: usage.totalDurationNs,
      referenceType: "search_query",
      referenceId: null,
      metadata: { mode: "semantic", queryCharLength: term.length }
    }).catch((err) => console.error("[ollama-usage] record failed (search_query semantic)", err));
    const literal = `[${vec.join(",")}]`;
    const rows = await searchSignalsSemantic(tenantId, literal, limit);
    return { signals: mapSignalRows(rows), reports };
  }

  // hybrid
  const { embedding: vec, usage } = await embedText(term, { priority: "user" });
  void recordOllamaUsage({
    tenantId,
    operation: "embed",
    model: usage.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalDurationNs: usage.totalDurationNs,
    referenceType: "search_query",
    referenceId: null,
    metadata: { mode: "hybrid", queryCharLength: term.length }
  }).catch((err) => console.error("[ollama-usage] record failed (search_query hybrid)", err));
  const literal = `[${vec.join(",")}]`;
  const [kwRows, semRows] = await Promise.all([
    searchSignalsKeyword(tenantId, pattern, limit),
    searchSignalsSemantic(tenantId, literal, limit)
  ]);
  const signals = mergeHybridSignals(mapSignalRows(kwRows), mapSignalRows(semRows), limit);
  return { signals, reports };
}
