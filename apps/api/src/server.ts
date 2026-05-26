import express from "express";
import cors from "cors";
import { z } from "zod";
import { getConfig } from "@landscrape/config";
import { createQueue, enqueueReportExport, interactiveJobOptions, userJobOptions } from "@landscrape/jobs";
import type { InboundNormalizePayload } from "@landscrape/jobs";
import { hashSecret } from "@landscrape/crypto";
import { one } from "@landscrape/db";
import { findTenantBySlug, listTenants } from "./repositories/tenantRepository";
import { searchTenantContent, type SearchMode } from "./repositories/searchRepository";
import { buildDashboardInterpretation } from "./services/interpretationService";
import { getDashboardSummary } from "./services/dashboardService";
import {
  countSignalsByTenantFiltered,
  getSignalById,
  listSignalsByTenantFiltered,
  type SignalListSort
} from "./repositories/signalRepository";
import { parseSignalListParams } from "./routes/signalListParams";
import { buildExecutiveBrief } from "./services/reportService";
import { getAlertWorkspace, getCompetitorWorkspace, getCongressWorkspace, getReportsWorkspace } from "./services/intelligenceService";
import {
  listSourcesWithAssets,
  getSourceById,
  insertSource,
  updateSource,
  assertConnectorBelongsToTenant
} from "./repositories/sourceRepository";
import { getReportExport } from "./repositories/exportEnqueueRepository";
import { getReportById } from "./repositories/reportLookupRepository";
import { requireInternalApiKey } from "./middleware/internalKey";
import { requireAuth } from "./middleware/requireAuth";
import { requireAdmin } from "./middleware/requireAdmin";
import { requireTenant, filterTenantsForAuth } from "./middleware/requireTenant";
import { bootstrapTenantIngest } from "./services/adminIngestService";
import {
  deleteProduct,
  getProductById,
  insertProduct,
  listProductsWithEnrichment,
  patchProduct,
} from "./repositories/productRepository";
import { mapProductToTile } from "./services/productTileMapper";
import { bootstrapTenantProductEnrich, enqueueProductEnrichment } from "./services/productEnrichService";
import { createProductBodySchema, patchProductBodySchema } from "./validation/productPayloads";
import {
  deleteCongressEvent,
  getCongressEventById,
  insertCongressEvent,
  listCongressEvents,
  patchCongressEvent,
} from "./repositories/congressEventRepository";
import { mapCongressEventToTile } from "./services/congressEventMapper";
import {
  createCongressEventBodySchema,
  patchCongressEventBodySchema,
} from "./validation/congressEventPayloads";
import { getAdminActivity } from "./services/activityService";
import { listConnectors, insertConnector, updateConnector } from "./repositories/connectorRepository";
import { createConnectorBodySchema, patchConnectorBodySchema } from "./validation/connectorPayloads";
import { createSourceBodySchema, patchSourceBodySchema } from "./validation/sourcePayloads";
import {
  agentMessagesPath,
  agentSessionPath,
  agentSessionsPath,
  proxyAgentRequest,
  researchPath,
} from "./services/agentProxy";

const config = getConfig();

function isUniqueViolation(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505";
}

function pathParam(req: express.Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}
const app = express();

if (config.authEnabled) {
  app.use(
    cors({
      origin: config.authCorsOrigins,
      credentials: true
    })
  );
} else {
  app.use(cors());
}
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "landscrape-api",
    timestamp: new Date().toISOString()
  });
});

app.get("/v1/tenants", requireAuth, async (req, res) => {
  const items = await listTenants();
  return res.json({ items: filterTenantsForAuth(items, req.auth) });
});

app.get("/v1/tenants/:tenantSlug/dashboard", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const summary = await getDashboardSummary(tenant.tenant_id);
  return res.json({
    tenant,
    summary
  });
});

app.get("/v1/tenants/:tenantSlug/dashboard/interpretation", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const interpretation = await buildDashboardInterpretation(tenant.tenant_id);
  return res.json(interpretation);
});

app.get("/v1/tenants/:tenantSlug/search", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const raw = typeof req.query.q === "string" ? req.query.q : "";
  const q = raw.trim().slice(0, 200);
  if (q.length < 2) {
    return res.json({ tenant, query: q, mode: "keyword", signals: [], reports: [] });
  }

  const limit = Math.min(Math.max(Number(req.query.limit ?? 15), 1), 50);
  const modeParam = typeof req.query.mode === "string" ? req.query.mode : "keyword";
  const mode: SearchMode =
    modeParam === "semantic" || modeParam === "hybrid" || modeParam === "keyword" ? modeParam : "keyword";
  const results = await searchTenantContent(tenant.tenant_id, q, Number.isFinite(limit) ? limit : 15, mode);
  return res.json({ tenant, query: q, mode, ...results });
});

app.get("/v1/tenants/:tenantSlug/signals", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const { limit, offset, sort, from, to, excludeTypes } = parseSignalListParams(req.query);

  const [items, total] = await Promise.all([
    listSignalsByTenantFiltered(tenant.tenant_id, {
      limit,
      offset,
      sort,
      excludeTypes,
      from,
      to
    }),
    countSignalsByTenantFiltered(tenant.tenant_id, { excludeTypes, from, to })
  ]);

  return res.json({ items, total, limit, offset });
});

app.get("/v1/tenants/:tenantSlug/signals/:signalId", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const signal = await getSignalById(tenant.tenant_id, pathParam(req, "signalId"));

  if (!signal) {
    return res.status(404).json({ error: "Signal not found" });
  }

  return res.json(signal);
});


app.get("/v1/tenants/:tenantSlug/competitors", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const workspace = await getCompetitorWorkspace(tenant.tenant_id);
  return res.json({ tenant, ...workspace });
});

app.get("/v1/tenants/:tenantSlug/congress", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const workspace = await getCongressWorkspace(tenant.tenant_id);
  return res.json({ tenant, ...workspace });
});

app.get("/v1/tenants/:tenantSlug/alerts", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const workspace = await getAlertWorkspace(tenant.tenant_id);
  return res.json({ tenant, ...workspace });
});


app.get("/v1/tenants/:tenantSlug/sources", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const items = await listSourcesWithAssets(tenant.tenant_id);
  return res.json({ tenant, items });
});

app.get("/v1/tenants/:tenantSlug/sources/:sourceId", requireInternalApiKey, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const row = await getSourceById(tenant.tenant_id, pathParam(req, "sourceId"));
  if (!row) {
    return res.status(404).json({ error: "Source not found" });
  }
  return res.json(row);
});

app.post("/v1/tenants/:tenantSlug/sources", requireInternalApiKey, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const parsed = createSourceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const body = parsed.data;
  const cfg = body.source_config as Record<string, unknown>;
  if (cfg.authMode === "portal") {
    const ok = await assertConnectorBelongsToTenant(tenant.tenant_id, String(cfg.connectorId));
    if (!ok) {
      return res.status(400).json({ error: "connector not found or inactive for this tenant" });
    }
  }
  if (body.source_type === "social" && cfg.provider === "x" && cfg.connectorId) {
    const ok = await assertConnectorBelongsToTenant(tenant.tenant_id, String(cfg.connectorId));
    if (!ok) {
      return res.status(400).json({ error: "connector not found or inactive for this tenant" });
    }
  }
  try {
    const row = await insertSource(tenant.tenant_id, {
      source_name: body.source_name,
      source_type: body.source_type,
      base_url: body.base_url ?? null,
      external_id: body.external_id ?? null,
      source_group_id: body.source_group_id ?? null,
      access_notes: body.access_notes ?? null,
      poll_frequency_minutes: body.poll_frequency_minutes,
      is_active: body.is_active,
      source_config: body.source_config as Record<string, unknown>
    });
    return res.status(201).json(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "Source name already exists for this tenant" });
    }
    throw err;
  }
});

app.patch("/v1/tenants/:tenantSlug/sources/:sourceId", requireInternalApiKey, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const parsed = patchSourceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const patch = parsed.data;
  const existing = await getSourceById(tenant.tenant_id, pathParam(req, "sourceId"));
  if (!existing) {
    return res.status(404).json({ error: "Source not found" });
  }
  const mergedCfg = { ...existing.source_config, ...(patch.source_config ?? {}) };
  if (mergedCfg.authMode === "portal" && mergedCfg.connectorId) {
    const ok = await assertConnectorBelongsToTenant(tenant.tenant_id, String(mergedCfg.connectorId));
    if (!ok) {
      return res.status(400).json({ error: "connector not found or inactive for this tenant" });
    }
  }
  if (existing.source_type === "social") {
    const provider =
      typeof mergedCfg.provider === "string" ? mergedCfg.provider.trim().toLowerCase() : "";
    if (provider === "x" && mergedCfg.connectorId) {
      const ok = await assertConnectorBelongsToTenant(tenant.tenant_id, String(mergedCfg.connectorId));
      if (!ok) {
        return res.status(400).json({ error: "connector not found or inactive for this tenant" });
      }
    }
  }
  const row = await updateSource(tenant.tenant_id, pathParam(req, "sourceId"), {
    base_url: patch.base_url,
    external_id: patch.external_id,
    access_notes: patch.access_notes,
    poll_frequency_minutes: patch.poll_frequency_minutes,
    is_active: patch.is_active,
    source_config: patch.source_config
  });
  if (!row) {
    return res.status(404).json({ error: "Source not found" });
  }
  return res.json(row);
});

app.get("/v1/tenants/:tenantSlug/connectors", requireInternalApiKey, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const items = await listConnectors(tenant.tenant_id);
  return res.json({ tenant, items });
});

app.post("/v1/tenants/:tenantSlug/connectors", requireInternalApiKey, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const parsed = createConnectorBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const body = parsed.data;
  try {
    const row = await insertConnector(
      tenant.tenant_id,
      body.connector_name,
      body.connector_type,
      body.connection_config as Record<string, unknown>,
      body.secrets as Record<string, unknown> | undefined,
      config
    );
    return res.status(201).json(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("LANDSCRAPE_CREDENTIALS_KEY")) {
      return res.status(400).json({ error: message });
    }
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "Connector name already exists for this tenant" });
    }
    throw err;
  }
});

app.patch("/v1/tenants/:tenantSlug/connectors/:connectorId", requireInternalApiKey, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const parsed = patchConnectorBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  try {
    const row = await updateConnector(tenant.tenant_id, pathParam(req, "connectorId"), parsed.data, config);
    if (!row) {
      return res.status(404).json({ error: "Connector not found" });
    }
    return res.json(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("LANDSCRAPE_CREDENTIALS_KEY")) {
      return res.status(400).json({ error: message });
    }
    if (message.includes("defaultInboundSourceId")) {
      return res.status(400).json({ error: message });
    }
    throw err;
  }
});

app.get("/v1/tenants/:tenantSlug/reports", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const workspace = await getReportsWorkspace(tenant.tenant_id);
  return res.json({ tenant, ...workspace });
});

app.post("/v1/tenants/:tenantSlug/reports/executive-brief", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));

  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const schema = z.object({
    title: z.string().min(5).max(200).default("Executive Brief"),
    useAgent: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      issues: parsed.error.issues
    });
  }

  const result = await buildExecutiveBrief(tenant.tenant_id, parsed.data.title, {
    useAgent: parsed.data.useAgent,
  });

  if (result.status === "queued" && result.briefJobId) {
    return res.status(202).json({ briefJobId: result.briefJobId, status: "queued" });
  }

  return res.status(201).json(result);
});

app.get("/v1/tenants/:tenantSlug/brief-jobs/:briefJobId", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const { getBriefJob } = await import("./repositories/briefJobRepository");
  const row = await getBriefJob(tenant.tenant_id, pathParam(req, "briefJobId"));
  if (!row) {
    return res.status(404).json({ error: "Brief job not found" });
  }
  return res.json(row);
});

app.post("/v1/tenants/:tenantSlug/reports/:reportId/export", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const schema = z.object({
    format: z.enum(["pdf", "pptx", "markdown_bundle"]).default("pdf")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
  }

  const report = await getReportById(tenant.tenant_id, pathParam(req, "reportId"));
  if (!report) {
    return res.status(404).json({ error: "Report not found" });
  }

  const result = await enqueueReportExport(tenant.tenant_id, report.report_id, parsed.data.format);
  return res.status(202).json(result);
});

app.get("/v1/tenants/:tenantSlug/exports/:exportId", requireAuth, requireTenant, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const row = await getReportExport(tenant.tenant_id, pathParam(req, "exportId"));
  if (!row) {
    return res.status(404).json({ error: "Export not found" });
  }
  return res.json(row);
});

app.post("/v1/inbound/webhook/:tenantSlug", async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  const headerSecret = req.headers["x-landscrape-webhook-secret"];
  const secret = typeof headerSecret === "string" ? headerSecret : "";
  const hashed = hashSecret(secret);

  const endpoint = await one<{ endpoint_id: string }>(
    `SELECT endpoint_id FROM webhook_endpoints WHERE tenant_id = $1 AND secret_hash = $2 AND is_active = TRUE`,
    [tenant.tenant_id, hashed]
  );

  const allowed = endpoint !== null || (secret.length > 0 && secret === config.internalApiKey);

  if (!allowed) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const bodySchema = z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    targetSourceId: z.string().uuid(),
    url: z.string().url().optional(),
    messageId: z.string().optional(),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }

  const dedupeKey = parsed.data.messageId ?? hashSecret(`${parsed.data.title}:${parsed.data.body.slice(0, 500)}`);

  const ins = await one<{ inbound_event_id: string }>(
    `INSERT INTO inbound_events (tenant_id, channel, dedupe_key, processing_status, payload_summary)
     VALUES ($1, 'webhook', $2, 'pending', $3::jsonb)
     ON CONFLICT (tenant_id, dedupe_key) DO NOTHING
     RETURNING inbound_event_id`,
    [tenant.tenant_id, dedupeKey, JSON.stringify(parsed.data)]
  );

  if (!ins) {
    return res.status(200).json({ status: "deduplicated" });
  }

  const q = createQueue("inbound:normalize");
  const payload: InboundNormalizePayload = {
    tenantId: tenant.tenant_id,
    inboundEventId: ins.inbound_event_id,
    channel: "webhook",
  };
  await q.add("inbound:normalize", payload, interactiveJobOptions());
  return res.status(202).json({ inboundEventId: ins.inbound_event_id, status: "queued" });
});

app.post("/v1/tenants/:tenantSlug/agent/sessions", requireAuth, requireTenant, async (req, res) => {
  await proxyAgentRequest(req, res, agentSessionsPath(req));
});

app.get("/v1/tenants/:tenantSlug/agent/sessions/:sessionId", requireAuth, requireTenant, async (req, res) => {
  await proxyAgentRequest(req, res, agentSessionPath(req));
});

app.post("/v1/tenants/:tenantSlug/agent/sessions/:sessionId/messages", requireAuth, requireTenant, async (req, res) => {
  await proxyAgentRequest(req, res, agentMessagesPath(req));
});

app.post("/v1/tenants/:tenantSlug/research", requireAuth, requireTenant, async (req, res) => {
  await proxyAgentRequest(req, res, researchPath(req));
});

app.get("/v1/admin/activity", requireAuth, requireAdmin, async (req, res) => {
  const activity = await getAdminActivity({
    since: typeof req.query.since === "string" ? req.query.since : undefined,
    limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
  });
  return res.json(activity);
});

app.post("/v1/admin/tenants/:tenantSlug/ingest/bootstrap", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const enqueued = await bootstrapTenantIngest(tenant.tenant_id, tenant.tenant_slug);
  const productsEnqueued = await bootstrapTenantProductEnrich(tenant.tenant_id);
  return res.json({ enqueued, productsEnqueued, tenantSlug: tenant.tenant_slug });
});

app.get("/v1/admin/tenants/:tenantSlug/products", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const rows = await listProductsWithEnrichment(tenant.tenant_id);
  return res.json({ tenant, items: rows.map(mapProductToTile) });
});

app.post("/v1/admin/tenants/:tenantSlug/products", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const parsed = createProductBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  try {
    const row = await insertProduct(tenant.tenant_id, parsed.data);
    await enqueueProductEnrichment(tenant.tenant_id, row.product_id);
    const tile = (await listProductsWithEnrichment(tenant.tenant_id)).find((p) => p.product_id === row.product_id);
    if (!tile) {
      return res.status(201).json({ productId: row.product_id });
    }
    return res.status(201).json(mapProductToTile(tile));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "Brand name already exists for this tenant" });
    }
    throw err;
  }
});

app.patch("/v1/admin/tenants/:tenantSlug/products/:productId", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const parsed = patchProductBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const productId = pathParam(req, "productId");
  const row = await patchProduct(tenant.tenant_id, productId, parsed.data);
  if (!row) {
    return res.status(404).json({ error: "Product not found" });
  }
  await enqueueProductEnrichment(tenant.tenant_id, productId);
  const tile = (await listProductsWithEnrichment(tenant.tenant_id)).find((p) => p.product_id === productId);
  return res.json(tile ? mapProductToTile(tile) : mapProductToTile({ ...row, trial_summary: {}, regulatory_summary: {}, label_updates: [], enriched_pdufa_date: null, enriched_approval_date: null, last_enriched_at: null, enrichment_errors: [], hcp_source_count: 0, dtc_source_count: 0 }));
});

app.delete("/v1/admin/tenants/:tenantSlug/products/:productId", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const ok = await deleteProduct(tenant.tenant_id, pathParam(req, "productId"));
  if (!ok) {
    return res.status(404).json({ error: "Product not found" });
  }
  return res.status(204).send();
});

app.post("/v1/admin/tenants/:tenantSlug/products/:productId/refresh", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const productId = pathParam(req, "productId");
  const row = await getProductById(tenant.tenant_id, productId);
  if (!row) {
    return res.status(404).json({ error: "Product not found" });
  }
  await enqueueProductEnrichment(tenant.tenant_id, productId);
  return res.json({ queued: true, productId });
});

app.post("/v1/admin/tenants/:tenantSlug/products/bootstrap-enrich", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const productsEnqueued = await bootstrapTenantProductEnrich(tenant.tenant_id);
  return res.json({ productsEnqueued, tenantSlug: tenant.tenant_slug });
});

app.get("/v1/admin/tenants/:tenantSlug/congress-events", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const rows = await listCongressEvents(tenant.tenant_id);
  return res.json({ tenant, items: rows.map(mapCongressEventToTile) });
});

app.post("/v1/admin/tenants/:tenantSlug/congress-events", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const parsed = createCongressEventBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  try {
    const row = await insertCongressEvent(tenant.tenant_id, parsed.data);
    return res.status(201).json(mapCongressEventToTile(row));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "Event slug already exists for this tenant" });
    }
    throw err;
  }
});

app.patch("/v1/admin/tenants/:tenantSlug/congress-events/:eventId", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const parsed = patchCongressEventBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const eventId = pathParam(req, "eventId");
  const row = await patchCongressEvent(tenant.tenant_id, eventId, parsed.data);
  if (!row) {
    return res.status(404).json({ error: "Congress event not found" });
  }
  return res.json(mapCongressEventToTile(row));
});

app.delete("/v1/admin/tenants/:tenantSlug/congress-events/:eventId", requireAuth, requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(pathParam(req, "tenantSlug"));
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const ok = await deleteCongressEvent(tenant.tenant_id, pathParam(req, "eventId"));
  if (!ok) {
    return res.status(404).json({ error: "Congress event not found" });
  }
  return res.status(204).send();
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected server error";
  console.error(err);
  res.status(500).json({ error: message });
});

app.listen(config.apiPort, () => {
  console.log(`LandScrape API listening on port ${config.apiPort}`);
});
