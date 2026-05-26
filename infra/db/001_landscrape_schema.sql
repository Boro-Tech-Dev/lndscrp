CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signal_type') THEN
    CREATE TYPE signal_type AS ENUM (
      'competitive_activity',
      'clinical_landscape',
      'congress_intelligence',
      'market_access',
      'regulatory',
      'professional_discourse',
      'internal_performance'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE approval_status AS ENUM (
      'draft',
      'pending_review',
      'approved',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
    CREATE TYPE source_type AS ENUM (
      'competitor_site',
      'publication',
      'congress',
      'regulatory',
      'payer',
      'crm',
      'email',
      'web_analytics',
      'social',
      'upload',
      'field_feedback',
      'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  industry_pack TEXT NOT NULL DEFAULT 'pharma',
  brand_color TEXT NOT NULL DEFAULT '#F59E0B',
  is_dedicated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_name TEXT NOT NULL CHECK (role_name IN ('viewer', 'analyst', 'manager', 'admin', 'super_admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS source_groups (
  source_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, group_name)
);

CREATE TABLE IF NOT EXISTS sources (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  source_group_id UUID REFERENCES source_groups(source_group_id) ON DELETE SET NULL,
  external_id TEXT,
  source_name TEXT NOT NULL,
  source_type source_type NOT NULL,
  base_url TEXT,
  access_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  poll_frequency_minutes INTEGER NOT NULL DEFAULT 60,
  last_checked_at TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, source_name)
);

CREATE TABLE IF NOT EXISTS source_checks (
  source_check_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(source_id) ON DELETE SET NULL,
  check_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  result_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signals (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(source_id) ON DELETE SET NULL,
  source_check_id UUID REFERENCES source_checks(source_check_id) ON DELETE SET NULL,
  signal_type signal_type NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT,
  competitor_brand TEXT,
  disease_state TEXT,
  market_region TEXT,
  importance_score NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (importance_score >= 0 AND importance_score <= 100),
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  sentiment_score NUMERIC(5,2),
  approval_status approval_status NOT NULL DEFAULT 'draft',
  analyst_notes TEXT,
  evidence_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_embedding VECTOR(1536)
);

CREATE TABLE IF NOT EXISTS signal_entities (
  signal_entity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES signals(signal_id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  signal_id UUID REFERENCES signals(signal_id) ON DELETE CASCADE,
  alert_title TEXT NOT NULL,
  alert_message TEXT NOT NULL,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('info', 'medium', 'high', 'critical')),
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly_summary', 'competitor_brief', 'executive_brief', 'congress_recap', 'custom')),
  body_markdown TEXT NOT NULL,
  approval_status approval_status NOT NULL DEFAULT 'draft',
  distributed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_signals (
  report_id UUID NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES signals(signal_id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, signal_id)
);

CREATE TABLE IF NOT EXISTS approvals (
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('signal', 'report')),
  target_id UUID NOT NULL,
  requested_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approval_status approval_status NOT NULL DEFAULT 'pending_review',
  review_notes TEXT
);

CREATE TABLE IF NOT EXISTS connectors (
  connector_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  connector_name TEXT NOT NULL,
  connector_type TEXT NOT NULL CHECK (connector_type IN ('crm', 'email', 'analytics', 'social', 'upload', 'other')),
  connection_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, connector_name)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_tenant_active ON sources (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_signals_tenant_type_created ON signals (tenant_id, signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_tenant_approval ON signals (tenant_id, approval_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_open ON alerts (tenant_id, is_open, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_tenant_created ON reports (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at DESC);

-- Source-specific adapter support
ALTER TABLE sources ADD COLUMN IF NOT EXISTS source_config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS source_items (
  source_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  external_item_id TEXT NOT NULL,
  item_title TEXT NOT NULL,
  item_summary TEXT,
  item_url TEXT,
  published_at TIMESTAMPTZ,
  raw_content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, source_id, external_item_id)
);

ALTER TABLE signals ADD COLUMN IF NOT EXISTS source_item_id UUID REFERENCES source_items(source_item_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_source_items_tenant_source_published ON source_items (tenant_id, source_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_source_item ON signals (source_item_id);

CREATE TABLE IF NOT EXISTS source_assets (
  source_asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(source_id) ON DELETE CASCADE,
  source_check_id UUID REFERENCES source_checks(source_check_id) ON DELETE SET NULL,
  source_item_id UUID NOT NULL REFERENCES source_items(source_item_id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('screenshot','dom_snapshot')),
  storage_provider TEXT NOT NULL DEFAULT 's3',
  storage_bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, source_item_id, asset_type, storage_key)
);

ALTER TABLE signals ADD COLUMN IF NOT EXISTS source_item_id UUID REFERENCES source_items(source_item_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_source_items_tenant_source_published ON source_items (tenant_id, source_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_assets_tenant_source_item ON source_assets (tenant_id, source_item_id, created_at DESC);
