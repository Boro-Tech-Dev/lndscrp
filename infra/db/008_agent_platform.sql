-- Agent platform: sessions, messages, tool audit; extend ollama usage operations

ALTER TABLE ollama_usage_events DROP CONSTRAINT IF EXISTS ollama_usage_events_operation_check;
ALTER TABLE ollama_usage_events ADD CONSTRAINT ollama_usage_events_operation_check
  CHECK (operation IN ('generate', 'embed', 'agent_turn'));

CREATE TABLE IF NOT EXISTS agent_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Research session',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant_created ON agent_sessions (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session_created ON agent_messages (session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS agent_tool_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(session_id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE SET NULL,
  tool_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  input_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error', 'denied')),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_audit_tenant_created ON agent_tool_audit (tenant_id, created_at DESC);

ALTER TABLE signals ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
