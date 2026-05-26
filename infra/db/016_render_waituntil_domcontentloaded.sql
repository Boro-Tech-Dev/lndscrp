-- Playwright waitUntil: networkidle is CPU-heavy and often times out on news/IR pages.
-- Idempotent patch for existing DBs; fresh installs also get domcontentloaded in seed SQL.

UPDATE sources
SET source_config = source_config || '{"waitUntil":"domcontentloaded"}'::jsonb
WHERE source_config->>'waitUntil' = 'networkidle';
