-- Ayvakit X/Twitter social monitoring (idempotent). Secrets via API — see scripts/configure-x-social-connector.sh

INSERT INTO connectors (tenant_id, connector_name, connector_type, connection_config, is_active)
SELECT t.tenant_id, 'Ayvakit X Monitor', 'social', '{"provider": "x"}'::jsonb, TRUE
FROM tenants t
WHERE t.tenant_slug = 'ayvakit'
  AND NOT EXISTS (
    SELECT 1 FROM connectors c
    WHERE c.tenant_id = t.tenant_id AND c.connector_name = 'Ayvakit X Monitor'
  );

INSERT INTO sources (tenant_id, source_group_id, source_name, source_type, base_url, poll_frequency_minutes, is_active, source_config)
SELECT
  t.tenant_id,
  sg.source_group_id,
  s.source_name,
  s.source_type::source_type,
  s.base_url,
  s.poll_frequency_minutes,
  TRUE,
  s.source_config
FROM tenants t
JOIN source_groups sg ON sg.tenant_id = t.tenant_id AND sg.group_name = 'Core Market Monitoring'
JOIN connectors c ON c.tenant_id = t.tenant_id AND c.connector_name = 'Ayvakit X Monitor'
CROSS JOIN LATERAL (
  VALUES
    (
      'X Search — SM competitive',
      'social',
      'https://x.com',
      120,
      jsonb_build_object(
        'provider', 'x',
        'connectorId', c.connector_id,
        'mode', 'search',
        'query', 'bezuclastinib OR avapritinib OR mastocytosis OR GIST',
        'limit', 50,
        'filter', 'latest'
      )
    ),
    (
      'X Search — regulatory/onc',
      'social',
      'https://x.com',
      120,
      jsonb_build_object(
        'provider', 'x',
        'connectorId', c.connector_id,
        'mode', 'search',
        'query', 'FDA approval OR breakthrough therapy OR PDUFA',
        'limit', 50,
        'filter', 'latest'
      )
    ),
    (
      'X Account — FDA Drug Info',
      'social',
      'https://x.com',
      120,
      jsonb_build_object(
        'provider', 'x',
        'connectorId', c.connector_id,
        'mode', 'account',
        'username', 'FDA_Drug_Info',
        'limit', 30
      )
    )
) AS s(source_name, source_type, base_url, poll_frequency_minutes, source_config)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, source_name) DO NOTHING;
