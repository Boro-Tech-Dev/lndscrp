-- Workspace product roster and live enrichment cache (idempotent).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_role') THEN
    CREATE TYPE product_role AS ENUM ('owned', 'competitor');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lifecycle_stage') THEN
    CREATE TYPE lifecycle_stage AS ENUM ('pipeline', 'approved', 'generic');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workspace_products (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  company TEXT,
  role product_role NOT NULL DEFAULT 'competitor',
  therapeutic_class TEXT,
  indications TEXT[] NOT NULL DEFAULT '{}',
  lifecycle_stage lifecycle_stage NOT NULL DEFAULT 'approved',
  sort_order INTEGER NOT NULL DEFAULT 0,
  hcp_url TEXT,
  dtc_url TEXT,
  label_url TEXT,
  curated_pdufa_date DATE,
  curated_approval_date DATE,
  curated_loe_date DATE,
  enrich_intervention TEXT,
  enrich_brand_search TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, brand_name)
);

CREATE TABLE IF NOT EXISTS workspace_product_enrichment (
  product_id UUID PRIMARY KEY REFERENCES workspace_products(product_id) ON DELETE CASCADE,
  trial_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  regulatory_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  label_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
  enriched_pdufa_date DATE,
  enriched_approval_date DATE,
  last_enriched_at TIMESTAMPTZ,
  enrichment_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_products_tenant_sort
  ON workspace_products (tenant_id, sort_order);

-- Ayvakit workspace: 7-brand roster
INSERT INTO workspace_products (
  tenant_id, brand_name, generic_name, company, role, therapeutic_class, indications,
  lifecycle_stage, sort_order, hcp_url, dtc_url, label_url,
  enrich_intervention, enrich_brand_search
)
SELECT
  t.tenant_id,
  p.brand_name,
  p.generic_name,
  p.company,
  p.role::product_role,
  p.therapeutic_class,
  p.indications,
  p.lifecycle_stage::lifecycle_stage,
  p.sort_order,
  p.hcp_url,
  p.dtc_url,
  p.label_url,
  p.generic_name,
  p.brand_name
FROM tenants t
CROSS JOIN (
  VALUES
    ('Ayvakit', 'avapritinib', 'Blueprint Medicines', 'owned', 'KIT inhibitor', ARRAY['SM', 'GIST']::text[], 'approved', 0,
     'https://www.ayvakit.com/hcp', 'https://www.ayvakit.com/',
     'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=AYVAKIT'),
    ('Bezuclastinib', 'bezuclastinib', 'Cogent Biosciences', 'competitor', 'KIT inhibitor', ARRAY['SM', 'GIST']::text[], 'pipeline', 1,
     'https://www.cogentbio.com/Bezuclastinib/', 'https://www.cogentbio.com/Bezuclastinib/', NULL),
    ('Rydapt', 'midostaurin', 'Novartis', 'competitor', 'Multikinase inhibitor', ARRAY['AdvSM']::text[], 'approved', 2,
     'https://www.rydapt.com/', 'https://www.rydapt.com/',
     'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=RYDAPT'),
    ('Qinlock', 'ripretinib', 'Deciphera', 'competitor', 'KIT/PDGFRA inhibitor', ARRAY['GIST']::text[], 'approved', 3,
     'https://www.qinlock.com/hcp', 'https://www.qinlock.com/',
     'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=QINLOCK'),
    ('Gleevec', 'imatinib', 'Novartis', 'competitor', 'TKI', ARRAY['GIST']::text[], 'generic', 4,
     'https://www.gleevec.com/professional', 'https://www.gleevec.com/',
     'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=GLEEVEC'),
    ('Sutent', 'sunitinib', 'Pfizer', 'competitor', 'Multikinase inhibitor', ARRAY['GIST']::text[], 'approved', 5,
     'https://www.sutent.com/hcp', 'https://www.sutent.com/',
     'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=SUTENT'),
    ('Stivarga', 'regorafenib', 'Bayer', 'competitor', 'Multikinase inhibitor', ARRAY['GIST']::text[], 'approved', 6,
     'https://www.stivarga-us.com/', 'https://www.stivarga-us.com/',
     'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=STIVARGA')
) AS p(brand_name, generic_name, company, role, therapeutic_class, indications, lifecycle_stage, sort_order, hcp_url, dtc_url, label_url)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, brand_name) DO UPDATE SET
  generic_name = EXCLUDED.generic_name,
  company = EXCLUDED.company,
  role = EXCLUDED.role,
  therapeutic_class = EXCLUDED.therapeutic_class,
  indications = EXCLUDED.indications,
  lifecycle_stage = EXCLUDED.lifecycle_stage,
  sort_order = EXCLUDED.sort_order,
  hcp_url = EXCLUDED.hcp_url,
  dtc_url = EXCLUDED.dtc_url,
  label_url = EXCLUDED.label_url,
  enrich_intervention = EXCLUDED.enrich_intervention,
  enrich_brand_search = EXCLUDED.enrich_brand_search,
  updated_at = NOW();
