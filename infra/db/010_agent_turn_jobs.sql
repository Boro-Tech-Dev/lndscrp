-- Agent turn queue and async executive brief jobs

CREATE TABLE IF NOT EXISTS agent_turns (
  turn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'active', 'completed', 'failed')) DEFAULT 'queued',
  assistant_message TEXT,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  bullmq_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_turns_session ON agent_turns (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_turns_tenant_status ON agent_turns (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_brief_jobs (
  brief_job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  signal_limit INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL CHECK (status IN ('queued', 'active', 'completed', 'failed')) DEFAULT 'queued',
  report_id UUID REFERENCES reports(report_id) ON DELETE SET NULL,
  body_markdown TEXT,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  signal_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  bullmq_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_brief_jobs_tenant ON agent_brief_jobs (tenant_id, created_at DESC);
