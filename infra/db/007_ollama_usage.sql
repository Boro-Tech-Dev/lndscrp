-- Ollama token / timing metrics for capacity planning (one row per API call)

CREATE TABLE IF NOT EXISTS ollama_usage_events (
  usage_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE SET NULL,
  operation TEXT NOT NULL CHECK (operation IN ('generate', 'embed')),
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_duration_ns BIGINT,
  reference_type TEXT,
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ollama_usage_tenant_created ON ollama_usage_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ollama_usage_operation_created ON ollama_usage_events (operation, created_at DESC);
