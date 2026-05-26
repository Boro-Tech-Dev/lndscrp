-- Ayvakit workspace: tenant, Core/HCP/DTC source groups, monitoring pack (idempotent).

INSERT INTO tenants (tenant_slug, display_name, industry_pack, brand_color, is_dedicated)
VALUES ('ayvakit', 'Ayvakit', 'pharma', '#B45309', FALSE)
ON CONFLICT (tenant_slug) DO NOTHING;

INSERT INTO users (tenant_id, email, full_name, role_name)
SELECT tenant_id, 'admin@landscrape.local', 'LandScrape Admin', 'admin'
FROM tenants
WHERE tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO source_groups (tenant_id, group_name, description)
SELECT tenant_id, g.group_name, g.description
FROM tenants
CROSS JOIN (
  VALUES
    ('Core Market Monitoring', 'Science, regulatory, clinical, corporate IR'),
    ('HCP Channel Monitoring', 'Professional-facing brand, HCP education, prescriber programs'),
    ('DTC Channel Monitoring', 'Patient-facing brand, support, advocacy, consumer health media')
) AS g(group_name, description)
WHERE tenants.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, group_name) DO NOTHING;

-- Core: publications
INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT t.tenant_id, sg.source_group_id, s.source_name, s.source_type::source_type, s.base_url, s.poll_frequency_minutes, TRUE, s.source_config::jsonb
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'Core Market Monitoring'
CROSS JOIN (
  VALUES
    ('PubMed KIT SM GIST', 'publication', NULL::text, 360,
     '{"provider": "pubmed", "query": "bezuclastinib OR CGT9486 OR avapritinib OR ayvakit OR systemic mastocytosis OR gastrointestinal stromal OR KIT D816V", "retmax": 20}'::text),
    ('Europe PMC KIT SM GIST', 'publication', NULL::text, 360,
     '{"provider": "europepmc", "epmcQuery": "(BEZUCLASTINIB OR AVAPRITINIB OR CGT9486) AND (MASTOCYTOSIS OR GIST OR GASTROINTESTINAL STROMAL)", "pageSize": 15}'::text),
    ('PubMed HCP discourse', 'publication', NULL::text, 360,
     '{"provider": "pubmed", "query": "(bezuclastinib OR avapritinib OR ayvakit OR mastocytosis OR GIST) AND (prescribing OR physician OR medical affairs)", "retmax": 15, "channel": "hcp"}'::text)
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;

-- Core: clinical / congress
INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT t.tenant_id, sg.source_group_id, s.source_name, s.source_type::source_type, s.base_url, s.poll_frequency_minutes, TRUE, s.source_config::jsonb
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'Core Market Monitoring'
CROSS JOIN (
  VALUES
    ('ClinicalTrials bezuclastinib SM', 'congress', NULL::text, 360,
     '{"provider": "clinicaltrials_v2", "query.cond": "Mastocytosis", "query.intr": "bezuclastinib", "pageSize": 15}'::text),
    ('ClinicalTrials bezuclastinib GIST', 'congress', NULL::text, 360,
     '{"provider": "clinicaltrials_v2", "query.cond": "Gastrointestinal Stromal Tumors", "query.intr": "bezuclastinib", "pageSize": 15}'::text),
    ('ClinicalTrials avapritinib', 'congress', NULL::text, 360,
     '{"provider": "clinicaltrials_v2", "query.intr": "avapritinib", "pageSize": 15}'::text),
    ('ClinicalTrials SUMMIT anchor', 'congress', NULL::text, 360,
     '{"provider": "clinicaltrials_v2", "query.term": "NCT05186753", "pageSize": 5}'::text),
    ('ClinicalTrials PEAK anchor', 'congress', NULL::text, 360,
     '{"provider": "clinicaltrials_v2", "query.term": "NCT05208047", "pageSize": 5}'::text)
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;

-- Core: regulatory
INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT t.tenant_id, sg.source_group_id, s.source_name, s.source_type::source_type, s.base_url, s.poll_frequency_minutes, TRUE, s.source_config::jsonb
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'Core Market Monitoring'
CROSS JOIN (
  VALUES
    ('openFDA avapritinib enforcement', 'regulatory', NULL::text, 360,
     '{"provider": "openfda", "openfdaEndpoint": "drug/enforcement.json", "openfdaSearch": "openfda.brand_name:avapritinib", "maxItems": 15}'::text),
    ('openFDA avapritinib events', 'regulatory', NULL::text, 360,
     '{"provider": "openfda", "openfdaEndpoint": "drug/event.json", "openfdaSearch": "patient.drug.medicinalproduct:avapritinib", "maxItems": 15}'::text),
    ('openFDA bezuclastinib watch', 'regulatory', NULL::text, 360,
     '{"provider": "openfda", "openfdaEndpoint": "drug/event.json", "openfdaSearch": "patient.drug.medicinalproduct:bezuclastinib", "maxItems": 15}'::text)
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;

-- Core: corporate competitor sites
INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT t.tenant_id, sg.source_group_id, s.source_name, s.source_type::source_type, s.base_url, s.poll_frequency_minutes, TRUE, s.source_config::jsonb
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'Core Market Monitoring'
CROSS JOIN (
  VALUES
    ('Blueprint Medicines', 'competitor_site', 'https://www.blueprintmedicines.com/', 180, '{}'::text),
    ('Cogent Biosciences', 'competitor_site', 'https://www.cogentbio.com/', 180, '{}'::text),
    ('Bezuclastinib', 'competitor_site', 'https://www.cogentbio.com/Bezuclastinib/', 180,
     '{"competitorBrand": "Bezuclastinib", "channel": "hcp"}'::text)
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;

-- Core: press / news
INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT t.tenant_id, sg.source_group_id, s.source_name, s.source_type::source_type, s.base_url, s.poll_frequency_minutes, TRUE, s.source_config::jsonb
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'Core Market Monitoring'
CROSS JOIN (
  VALUES
    ('Cogent IR', 'press', 'https://investors.cogentbio.com/news-releases', 180,
     '{"rendered": true, "renderMode": "playwright", "waitUntil": "domcontentloaded", "itemSelector": "article, .news-release, .globenewswire", "titleSelector": "h1, h2, h3", "summarySelector": "p", "linkSelector": "a[href]", "maxItems": 12}'::text),
    ('Blueprint press', 'press', 'https://www.blueprintmedicines.com/news/', 180,
     '{"rendered": true, "renderMode": "playwright", "waitUntil": "domcontentloaded", "itemSelector": "article, .news-item, .press-release", "titleSelector": "h1, h2, h3", "summarySelector": "p", "linkSelector": "a[href]", "maxItems": 12}'::text),
    ('FiercePharma RSS', 'news', 'https://www.fiercepharma.com/rss/xml', 180,
     '{"format": "xml", "maxItems": 12, "itemSelector": "item", "titleSelector": "title", "summarySelector": "description", "linkSelector": "link"}'::text),
    ('OncLive oncology RSS', 'news', 'https://www.onclive.com/rss', 360,
     '{"format": "xml", "maxItems": 12, "itemSelector": "item", "titleSelector": "title", "summarySelector": "description", "linkSelector": "link"}'::text)
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;

-- HCP: competitor / professional sites
INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT t.tenant_id, sg.source_group_id, s.source_name, s.source_type::source_type, s.base_url, s.poll_frequency_minutes, TRUE, s.source_config::jsonb
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'HCP Channel Monitoring'
CROSS JOIN (
  VALUES
    ('Ayvakit HCP', 'competitor_site', 'https://www.ayvakit.com/hcp', 180,
     '{"channel": "hcp", "competitorBrand": "Ayvakit"}'::text),
    ('Ayvakit prescribing (DailyMed)', 'competitor_site', 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=AYVAKIT', 180,
     '{"channel": "hcp", "competitorBrand": "Ayvakit"}'::text),
    ('Rydapt HCP', 'competitor_site', 'https://www.rydapt.com/', 180,
     '{"channel": "hcp", "competitorBrand": "Rydapt"}'::text),
    ('Qinlock HCP', 'competitor_site', 'https://www.qinlock.com/hcp', 180,
     '{"channel": "hcp", "competitorBrand": "Qinlock"}'::text),
    ('Gleevec HCP', 'competitor_site', 'https://www.gleevec.com/professional', 180,
     '{"channel": "hcp", "competitorBrand": "Gleevec"}'::text),
    ('Sutent HCP', 'competitor_site', 'https://www.sutent.com/hcp', 180,
     '{"channel": "hcp", "competitorBrand": "Sutent"}'::text),
    ('Stivarga HCP', 'competitor_site', 'https://www.stivarga-us.com/', 180,
     '{"channel": "hcp", "competitorBrand": "Stivarga"}'::text),
    ('Medscape avapritinib', 'press', 'https://www.medscape.com/', 360,
     '{"channel": "hcp", "rendered": true, "renderMode": "playwright", "waitUntil": "domcontentloaded", "itemSelector": "article, .content", "titleSelector": "h1, h2, h3", "summarySelector": "p", "linkSelector": "a[href]", "maxItems": 8}'::text)
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;

-- HCP: press / professional news
INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT t.tenant_id, sg.source_group_id, s.source_name, s.source_type::source_type, s.base_url, s.poll_frequency_minutes, TRUE, s.source_config::jsonb
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'HCP Channel Monitoring'
CROSS JOIN (
  VALUES
    ('Blueprint medical news', 'press', 'https://www.blueprintmedicines.com/news/', 180,
     '{"channel": "hcp", "rendered": true, "renderMode": "playwright", "waitUntil": "domcontentloaded", "itemSelector": "article, .news-item", "titleSelector": "h1, h2, h3", "summarySelector": "p", "linkSelector": "a[href]", "maxItems": 10}'::text),
    ('AAAAI news (sample)', 'news', 'https://www.aaaai.org/about-aaaai/news', 360,
     '{"channel": "hcp", "rendered": true, "renderMode": "playwright", "waitUntil": "domcontentloaded", "itemSelector": "article, .news-item, li", "titleSelector": "h1, h2, h3, a", "summarySelector": "p", "linkSelector": "a[href]", "maxItems": 10}'::text)
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;

-- DTC: patient / advocacy sites
INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT t.tenant_id, sg.source_group_id, s.source_name, s.source_type::source_type, s.base_url, s.poll_frequency_minutes, TRUE, s.source_config::jsonb
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'DTC Channel Monitoring'
CROSS JOIN (
  VALUES
    ('Ayvakit DTC', 'competitor_site', 'https://www.ayvakit.com/', 180,
     '{"channel": "dtc", "competitorBrand": "Ayvakit"}'::text),
    ('Ayvakit Together (support)', 'competitor_site', 'https://www.ayvakittogogether.com/', 180,
     '{"channel": "dtc", "competitorBrand": "Ayvakit"}'::text),
    ('Blueprint For Patients', 'competitor_site', 'https://www.blueprintforyou.com/', 180,
     '{"channel": "dtc"}'::text),
    ('Rydapt patient', 'competitor_site', 'https://www.rydapt.com/', 180,
     '{"channel": "dtc", "competitorBrand": "Rydapt"}'::text),
    ('Qinlock patient', 'competitor_site', 'https://www.qinlock.com/', 180,
     '{"channel": "dtc", "competitorBrand": "Qinlock"}'::text),
    ('Gleevec patient', 'competitor_site', 'https://www.gleevec.com/', 180,
     '{"channel": "dtc", "competitorBrand": "Gleevec"}'::text),
    ('The Mast Cell Disease Society', 'competitor_site', 'https://tmsforacure.org/', 180,
     '{"channel": "dtc"}'::text),
    ('GIST Support International', 'competitor_site', 'https://www.gistsupport.org/', 180,
     '{"channel": "dtc"}'::text),
    ('Sutent DTC', 'competitor_site', 'https://www.sutent.com/', 180,
     '{"channel": "dtc", "competitorBrand": "Sutent"}'::text),
    ('Stivarga DTC', 'competitor_site', 'https://www.stivarga-us.com/', 180,
     '{"channel": "dtc", "competitorBrand": "Stivarga"}'::text),
    ('Bezuclastinib DTC', 'competitor_site', 'https://www.cogentbio.com/Bezuclastinib/', 180,
     '{"channel": "dtc", "competitorBrand": "Bezuclastinib"}'::text)
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;

-- DTC: consumer health press / news
INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT t.tenant_id, sg.source_group_id, s.source_name, s.source_type::source_type, s.base_url, s.poll_frequency_minutes, TRUE, s.source_config::jsonb
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'DTC Channel Monitoring'
CROSS JOIN (
  VALUES
    ('Healthline rare disease', 'news', 'https://www.healthline.com/health/rare-diseases', 360,
     '{"channel": "dtc", "rendered": true, "renderMode": "playwright", "waitUntil": "domcontentloaded", "itemSelector": "article, .css-0", "titleSelector": "h1, h2, h3", "summarySelector": "p", "linkSelector": "a[href]", "maxItems": 10}'::text),
    ('Patient Worthy mast cell', 'news', 'https://patientworthy.com/', 360,
     '{"channel": "dtc", "rendered": true, "renderMode": "playwright", "waitUntil": "domcontentloaded", "itemSelector": "article, .post", "titleSelector": "h1, h2, h3", "summarySelector": "p", "linkSelector": "a[href]", "maxItems": 10}'::text),
    ('PR Newswire patient keywords', 'press', 'https://www.prnewswire.com/search/news/?keyword=avapritinib+mastocytosis', 180,
     '{"channel": "dtc", "rendered": true, "renderMode": "playwright", "waitUntil": "domcontentloaded", "itemSelector": "article, .news-release", "titleSelector": "h1, h2, h3", "summarySelector": "p", "linkSelector": "a[href]", "maxItems": 12}'::text)
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;

-- MCP agent connector
INSERT INTO connectors (tenant_id, connector_name, connector_type, connection_config, is_active)
SELECT t.tenant_id, 'mcp_global_integrator', 'other', '{"integrator": true, "hipaaLevel": "L2"}'::jsonb, TRUE
FROM tenants t
WHERE t.tenant_slug = 'ayvakit'
  AND NOT EXISTS (
    SELECT 1 FROM connectors c
    WHERE c.tenant_id = t.tenant_id AND c.connector_name = 'mcp_global_integrator'
  );
