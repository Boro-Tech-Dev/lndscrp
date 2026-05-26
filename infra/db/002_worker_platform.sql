-- Worker platform: job history, exports, inbound, portal sessions, asset types, embedding dimension for Ollama nomic-embed-text

-- Widen source_assets types for PDF pipeline
ALTER TABLE source_assets DROP CONSTRAINT IF EXISTS source_assets_asset_type_check;
ALTER TABLE source_assets ADD CONSTRAINT source_assets_asset_type_check
  CHECK (asset_type IN ('screenshot', 'dom_snapshot', 'pdf', 'extracted_text'));

-- Ollama nomic-embed-text uses 768 dimensions (replace legacy 1536 placeholder)
ALTER TABLE signals RENAME COLUMN search_embedding TO search_embedding_legacy;
ALTER TABLE signals ADD COLUMN search_embedding vector(768);
ALTER TABLE signals DROP COLUMN search_embedding_legacy;

CREATE INDEX IF NOT EXISTS idx_signals_embedding_null ON signals (tenant_id) WHERE search_embedding IS NULL;

CREATE TABLE IF NOT EXISTS job_runs (
  job_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bullmq_job_id TEXT,
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'active', 'completed', 'failed')),
  payload_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_runs_tenant_created ON job_runs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS report_exports (
  export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'pptx', 'markdown_bundle')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')) DEFAULT 'queued',
  storage_key TEXT,
  storage_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_exports_report ON report_exports (report_id);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  endpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'default',
  secret_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS inbound_events (
  inbound_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('webhook', 'email')),
  dedupe_key TEXT NOT NULL,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_inbound_events_status ON inbound_events (tenant_id, processing_status, created_at DESC);

CREATE TABLE IF NOT EXISTS portal_sessions (
  portal_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES connectors(connector_id) ON DELETE CASCADE,
  encrypted_state BYTEA NOT NULL,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connector_id)
);

CREATE TABLE IF NOT EXISTS email_mailbox_state (
  mailbox_state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES connectors(connector_id) ON DELETE CASCADE,
  last_uid INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connector_id)
);
