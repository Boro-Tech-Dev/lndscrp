export interface AppConfig {
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  apiPort: number;
  webPort: number;
  adminPort: number;
  ollamaBaseUrl: string;
  ollamaModel: string;
  tenantSlug: string;
  seedEnabled: boolean;
  internalApiKey: string;
  storageEndpoint: string;
  storageRegion: string;
  storageAccessKey: string;
  storageSecretKey: string;
  storageBucket: string;
  storageForcePathStyle: boolean;
  storagePublicBaseUrl: string;
  contactEmail: string;
  contactUrl: string;
  /** AES key material for connector/session secrets; omit in dev only if portal auth is unused */
  credentialsKey?: string;
  /** Ollama embedding model (768-dim vectors in DB) */
  embeddingModel: string;
  /** Worker process role when using multi-worker compose */
  workerRole: string;
  queuePrefix: string;
  ingestConcurrency: number;
  pdfConcurrency: number;
  portalConcurrency: number;
  socialConcurrency: number;
  embedConcurrency: number;
  exportConcurrency: number;
  reconcileConcurrency: number;
  inboundConcurrency: number;
  schedulerIntervalMs: number;
  /** Max source jobs enqueued per scheduler tick */
  schedulerBurstLimit: number;
  reconcileIntervalMs: number;
  embedBackfillIntervalMs: number;
  useLegacyWorkerLoop: boolean;
  /** IMAP (optional; inbound email worker) */
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPassword?: string;
  imapTls?: boolean;
  /** NCBI E-utilities API key (optional; higher rate limits per NLM) */
  ncbiApiKey?: string;
  /** Default minimum gap between HTTP requests to the same host (ms) */
  fetchMinGapMs: number;
  /** Minimum gap for eutils.ncbi.nlm.nih.gov when using E-utilities (ms) */
  eutilsMinGapMs: number;
  /** When true, API and web require Keycloak JWT sessions */
  authEnabled: boolean;
  keycloakUrl?: string;
  keycloakRealm?: string;
  keycloakClientId?: string;
  keycloakClientSecret?: string;
  keycloakIssuer?: string;
  authCookieSecret?: string;
  authCorsOrigins: string[];
  /** Ollama model for agent tool orchestration */
  ollamaAgentModel: string;
  /** Agent service port */
  agentPort: number;
  /** Internal URL for API → agent proxy */
  agentInternalUrl: string;
  /** MCP sidecar base URLs (Clinical Reference Kit) */
  mcpFdaUrl?: string;
  mcpPubmedUrl?: string;
  mcpClinicaltrialsUrl?: string;
  /** openFDA API key (optional) */
  openfdaApiKey?: string;
  /** Agent loop limits */
  agentMaxTurns: number;
  agentMaxToolsPerTurn: number;
  agentTimeoutMs: number;
  /** Signal enrichment threshold / feature */
  enrichImportanceThreshold: number;
  enrichConcurrency: number;
  /** Reference tools for agent: mcp | native | auto */
  referenceTools: "mcp" | "native" | "auto";
  /** When true, enrich worker calls agent before native fallback */
  enrichUseAgent: boolean;
  /** Agent inference backend */
  agentInferenceBackend: "ollama" | "openai_compat";
  /** OpenAI-compatible API for agent when backend is openai_compat */
  openaiCompatBaseUrl?: string;
  openaiCompatApiKey?: string;
  openaiCompatModel?: string;
  /** When true, web/API default executive brief uses agent */
  defaultAgentBrief: boolean;
  /** BullMQ job priority tiers (lower number = higher priority) */
  jobPriorityUser: number;
  jobPriorityInteractive: number;
  jobPriorityPipeline: number;
  jobPriorityScheduled: number;
  jobPriorityBackground: number;
  /** Embed backfill throttling */
  embedBackfillBatchSize: number;
  embedBackfillMaxQueueDepth: number;
  embedBackfillEnabled: boolean;
  /** Cluster-wide Ollama concurrency cap via Redis (0 = in-process only) */
  ollamaGlobalMaxConcurrent: number;
  /** competitor_site render: playwright (default) or fetch (HTTP only, lower CPU) */
  competitorRenderMode: "playwright" | "fetch";
  productEnrichEnabled: boolean;
  /** Dedicated agent service for automated enrich */
  agentEnrichInternalUrl: string;
  agentServiceRole: "user" | "enrich" | "full";
  /** Ollama priority gateway */
  ollamaMaxConcurrent: number;
  ollamaUserTimeoutMs: number;
  ollamaInteractiveTimeoutMs: number;
  ollamaPipelineTimeoutMs: number;
  ollamaBackgroundTimeoutMs: number;
  /** When true, agent chat uses BullMQ queue instead of sync SSE */
  agentTurnQueue: boolean;
  agentTurnConcurrency: number;
  agentBriefConcurrency: number;
  /** Optional queue depth logging in schedulers */
  logQueueDepth: boolean;
  /** X/Twitter ingest: api (XActions browser stack) or http (in-process GraphQL) */
  xBackend: "api" | "http";
  /** Base URL for self-hosted XActions API */
  xactionsApiUrl: string;
  /** Timeout for XActions scrape HTTP calls (ms) */
  xactionsApiTimeoutMs: number;
  /** Optional shared secret sent as X-Landscrape-Internal-Key to XActions */
  xactionsInternalKey?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === null || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireEnvInt(name: string): number {
  const raw = requireEnv(name);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

function optionalEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

export function getConfig(): AppConfig {
  const cred = process.env.LANDSCRAPE_CREDENTIALS_KEY?.trim();
  const authEnabled = (process.env.AUTH_ENABLED ?? "true") === "true";
  const authCorsRaw = process.env.AUTH_CORS_ORIGINS?.trim();
  const authCorsOrigins =
    authCorsRaw && authCorsRaw.length > 0
      ? authCorsRaw.split(",").map((o) => o.trim()).filter(Boolean)
      : ["http://localhost:3000"];

  const keycloakUrl = process.env.KEYCLOAK_URL?.trim() || undefined;
  const keycloakRealm = process.env.KEYCLOAK_REALM?.trim() || undefined;
  const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID?.trim() || undefined;
  const keycloakClientSecret = process.env.KEYCLOAK_CLIENT_SECRET?.trim() || undefined;
  const keycloakIssuer =
    process.env.KEYCLOAK_ISSUER?.trim() ||
    (keycloakUrl && keycloakRealm ? `${keycloakUrl.replace(/\/$/, "")}/realms/${keycloakRealm}` : undefined);
  const authCookieSecret = process.env.AUTH_COOKIE_SECRET?.trim() || undefined;

  if (authEnabled) {
    if (!keycloakUrl) throw new Error("Missing required environment variable: KEYCLOAK_URL (AUTH_ENABLED=true)");
    if (!keycloakRealm) throw new Error("Missing required environment variable: KEYCLOAK_REALM (AUTH_ENABLED=true)");
    if (!keycloakClientId) throw new Error("Missing required environment variable: KEYCLOAK_CLIENT_ID (AUTH_ENABLED=true)");
    if (!keycloakClientSecret) {
      throw new Error("Missing required environment variable: KEYCLOAK_CLIENT_SECRET (AUTH_ENABLED=true)");
    }
    if (!keycloakIssuer) throw new Error("Missing KEYCLOAK_ISSUER or KEYCLOAK_URL/KEYCLOAK_REALM (AUTH_ENABLED=true)");
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    databaseUrl: requireEnv("DATABASE_URL"),
    redisUrl: requireEnv("REDIS_URL"),
    apiPort: requireEnvInt("API_PORT"),
    webPort: requireEnvInt("WEB_PORT"),
    adminPort: requireEnvInt("ADMIN_PORT"),
    ollamaBaseUrl: requireEnv("OLLAMA_BASE_URL"),
    ollamaModel: requireEnv("OLLAMA_MODEL"),
    tenantSlug: requireEnv("LANDSCRAPE_TENANT_SLUG"),
    seedEnabled: (process.env.LANDSCRAPE_SEED ?? "true") === "true",
    internalApiKey: requireEnv("LANDSCRAPE_INTERNAL_API_KEY"),
    storageEndpoint: requireEnv("STORAGE_ENDPOINT"),
    storageRegion: requireEnv("STORAGE_REGION"),
    storageAccessKey: requireEnv("STORAGE_ACCESS_KEY"),
    storageSecretKey: requireEnv("STORAGE_SECRET_KEY"),
    storageBucket: requireEnv("STORAGE_BUCKET"),
    storageForcePathStyle: requireEnv("STORAGE_FORCE_PATH_STYLE") === "true",
    storagePublicBaseUrl: requireEnv("STORAGE_PUBLIC_BASE_URL"),
    contactEmail: requireEnv("LANDSCRAPE_CONTACT_EMAIL"),
    contactUrl: requireEnv("LANDSCRAPE_CONTACT_URL"),
    credentialsKey: cred && cred.length > 0 ? cred : undefined,
    embeddingModel: process.env.LANDSCRAPE_EMBEDDING_MODEL ?? "nomic-embed-text",
    workerRole: process.env.LANDSCRAPE_WORKER_ROLE ?? "full",
    queuePrefix: process.env.LANDSCRAPE_QUEUE_PREFIX ?? "landscrape",
    ingestConcurrency: optionalEnvInt("LANDSCRAPE_INGEST_CONCURRENCY", 2),
    pdfConcurrency: optionalEnvInt("LANDSCRAPE_PDF_CONCURRENCY", 1),
    portalConcurrency: optionalEnvInt("LANDSCRAPE_PORTAL_CONCURRENCY", 1),
    socialConcurrency: optionalEnvInt("LANDSCRAPE_SOCIAL_CONCURRENCY", 1),
    embedConcurrency: optionalEnvInt("LANDSCRAPE_EMBED_CONCURRENCY", 1),
    exportConcurrency: optionalEnvInt("LANDSCRAPE_EXPORT_CONCURRENCY", 1),
    reconcileConcurrency: optionalEnvInt("LANDSCRAPE_RECONCILE_CONCURRENCY", 1),
    inboundConcurrency: optionalEnvInt("LANDSCRAPE_INBOUND_CONCURRENCY", 2),
    schedulerIntervalMs: optionalEnvInt("LANDSCRAPE_SCHEDULER_INTERVAL_MS", 60_000),
    schedulerBurstLimit: optionalEnvInt("LANDSCRAPE_SCHEDULER_BURST_LIMIT", 8),
    reconcileIntervalMs: optionalEnvInt("LANDSCRAPE_RECONCILE_INTERVAL_MS", 15 * 60_000),
    embedBackfillIntervalMs: optionalEnvInt("LANDSCRAPE_EMBED_BACKFILL_INTERVAL_MS", 5 * 60_000),
    useLegacyWorkerLoop: (process.env.LANDSCRAPE_USE_LEGACY_WORKER_LOOP ?? "false") === "true",
    imapHost: process.env.LANDSCRAPE_IMAP_HOST?.trim() || undefined,
    imapPort: process.env.LANDSCRAPE_IMAP_HOST?.trim()
      ? optionalEnvInt("LANDSCRAPE_IMAP_PORT", 993)
      : undefined,
    imapUser: process.env.LANDSCRAPE_IMAP_USER?.trim() || undefined,
    imapPassword: process.env.LANDSCRAPE_IMAP_PASSWORD?.trim() || undefined,
    imapTls: process.env.LANDSCRAPE_IMAP_TLS !== "false",
    ncbiApiKey: process.env.NCBI_API_KEY?.trim() || undefined,
    fetchMinGapMs: optionalEnvInt("LANDSCRAPE_FETCH_MIN_GAP_MS", 5_000),
    eutilsMinGapMs: (() => {
      const raw = process.env.LANDSCRAPE_EUTILS_MIN_GAP_MS?.trim();
      if (raw) {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
          throw new Error("LANDSCRAPE_EUTILS_MIN_GAP_MS must be a non-negative integer");
        }
        return n;
      }
      return process.env.NCBI_API_KEY?.trim() ? 150 : 340;
    })(),
    authEnabled,
    keycloakUrl,
    keycloakRealm,
    keycloakClientId,
    keycloakClientSecret,
    keycloakIssuer,
    authCookieSecret,
    authCorsOrigins,
    ollamaAgentModel: process.env.OLLAMA_AGENT_MODEL?.trim() || process.env.OLLAMA_MODEL?.trim() || "llama3.2:3b",
    agentPort: optionalEnvInt("AGENT_PORT", 4010),
    agentInternalUrl: process.env.AGENT_INTERNAL_URL?.trim() || "http://agent:4010",
    mcpFdaUrl: process.env.MCP_FDA_URL?.trim() || undefined,
    mcpPubmedUrl: process.env.MCP_PUBMED_URL?.trim() || undefined,
    mcpClinicaltrialsUrl: process.env.MCP_CLINICALTRIALS_URL?.trim() || undefined,
    openfdaApiKey: process.env.OPENFDA_API_KEY?.trim() || undefined,
    agentMaxTurns: optionalEnvInt("LANDSCRAPE_AGENT_MAX_TURNS", 8),
    agentMaxToolsPerTurn: optionalEnvInt("LANDSCRAPE_AGENT_MAX_TOOLS_PER_TURN", 3),
    agentTimeoutMs: optionalEnvInt("LANDSCRAPE_AGENT_TIMEOUT_MS", 60_000),
    enrichImportanceThreshold: optionalEnvInt("LANDSCRAPE_ENRICH_IMPORTANCE_THRESHOLD", 75),
    enrichConcurrency: optionalEnvInt("LANDSCRAPE_ENRICH_CONCURRENCY", 1),
    referenceTools: (() => {
      const raw = (process.env.LANDSCRAPE_REFERENCE_TOOLS ?? "auto").trim().toLowerCase();
      if (raw === "mcp" || raw === "native" || raw === "auto") return raw;
      throw new Error("LANDSCRAPE_REFERENCE_TOOLS must be mcp, native, or auto");
    })(),
    enrichUseAgent: (process.env.LANDSCRAPE_ENRICH_USE_AGENT ?? "false") === "true",
    agentInferenceBackend: (() => {
      const raw = (process.env.AGENT_INFERENCE_BACKEND ?? "ollama").trim().toLowerCase();
      if (raw === "ollama" || raw === "openai_compat") return raw;
      throw new Error("AGENT_INFERENCE_BACKEND must be ollama or openai_compat");
    })(),
    openaiCompatBaseUrl: process.env.OPENAI_COMPAT_BASE_URL?.trim() || undefined,
    openaiCompatApiKey: process.env.OPENAI_COMPAT_API_KEY?.trim() || undefined,
    openaiCompatModel: process.env.OPENAI_COMPAT_MODEL?.trim() || undefined,
    defaultAgentBrief: (process.env.LANDSCRAPE_DEFAULT_AGENT_BRIEF ?? "false") === "true",
    jobPriorityUser: optionalEnvInt("LANDSCRAPE_JOB_PRIORITY_USER", 1),
    jobPriorityInteractive: optionalEnvInt("LANDSCRAPE_JOB_PRIORITY_INTERACTIVE", 2),
    jobPriorityPipeline: optionalEnvInt("LANDSCRAPE_JOB_PRIORITY_PIPELINE", 3),
    jobPriorityScheduled: optionalEnvInt("LANDSCRAPE_JOB_PRIORITY_SCHEDULED", 5),
    jobPriorityBackground: optionalEnvInt("LANDSCRAPE_JOB_PRIORITY_BACKGROUND", 10),
    embedBackfillBatchSize: optionalEnvInt("LANDSCRAPE_EMBED_BACKFILL_BATCH_SIZE", 10),
    embedBackfillMaxQueueDepth: optionalEnvInt("LANDSCRAPE_EMBED_BACKFILL_MAX_QUEUE_DEPTH", 50),
    embedBackfillEnabled: (process.env.LANDSCRAPE_EMBED_BACKFILL_ENABLED ?? "true") === "true",
    ollamaGlobalMaxConcurrent: optionalEnvInt("LANDSCRAPE_OLLAMA_GLOBAL_MAX_CONCURRENT", 0),
    competitorRenderMode: (() => {
      const raw = (process.env.LANDSCRAPE_COMPETITOR_RENDER_MODE ?? "playwright").trim().toLowerCase();
      if (raw === "playwright" || raw === "fetch") return raw;
      throw new Error("LANDSCRAPE_COMPETITOR_RENDER_MODE must be playwright or fetch");
    })(),
    productEnrichEnabled: (process.env.LANDSCRAPE_PRODUCT_ENRICH_ENABLED ?? "true") === "true",
    agentEnrichInternalUrl: process.env.AGENT_ENRICH_INTERNAL_URL?.trim() || "http://agent-enrich:4011",
    agentServiceRole: (() => {
      const raw = (process.env.AGENT_SERVICE_ROLE ?? "full").trim().toLowerCase();
      if (raw === "user" || raw === "enrich" || raw === "full") return raw;
      throw new Error("AGENT_SERVICE_ROLE must be user, enrich, or full");
    })(),
    ollamaMaxConcurrent: optionalEnvInt("LANDSCRAPE_OLLAMA_MAX_CONCURRENT", 2),
    ollamaUserTimeoutMs: optionalEnvInt("LANDSCRAPE_OLLAMA_USER_TIMEOUT_MS", 120_000),
    ollamaInteractiveTimeoutMs: optionalEnvInt("LANDSCRAPE_OLLAMA_INTERACTIVE_TIMEOUT_MS", 90_000),
    ollamaPipelineTimeoutMs: optionalEnvInt("LANDSCRAPE_OLLAMA_PIPELINE_TIMEOUT_MS", 60_000),
    ollamaBackgroundTimeoutMs: optionalEnvInt("LANDSCRAPE_OLLAMA_BACKGROUND_TIMEOUT_MS", 120_000),
    agentTurnQueue: (process.env.LANDSCRAPE_AGENT_TURN_QUEUE ?? "true") === "true",
    agentTurnConcurrency: optionalEnvInt("LANDSCRAPE_AGENT_TURN_CONCURRENCY", 2),
    agentBriefConcurrency: optionalEnvInt("LANDSCRAPE_AGENT_BRIEF_CONCURRENCY", 1),
    logQueueDepth: (process.env.LANDSCRAPE_LOG_QUEUE_DEPTH ?? "false") === "true",
    xBackend: (() => {
      const raw = (process.env.LANDSCRAPE_X_BACKEND ?? "api").trim().toLowerCase();
      if (raw === "api" || raw === "http") return raw;
      throw new Error("LANDSCRAPE_X_BACKEND must be api or http");
    })(),
    xactionsApiUrl: process.env.XACTIONS_API_URL?.trim() || "http://xactions-api:3001",
    xactionsApiTimeoutMs: optionalEnvInt("XACTIONS_API_TIMEOUT_MS", 120_000),
    xactionsInternalKey: process.env.XACTIONS_INTERNAL_KEY?.trim() || undefined,
  };
}
