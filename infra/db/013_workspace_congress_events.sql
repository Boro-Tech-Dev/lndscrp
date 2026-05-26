-- Workspace congress event roster (idempotent).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'congress_priority') THEN
    CREATE TYPE congress_priority AS ENUM ('imminent', 'pivotal', 'expected', 'watch');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workspace_congress_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_slug TEXT NOT NULL,
  acronym TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  focus_tags TEXT[] NOT NULL DEFAULT '{}',
  priority congress_priority NOT NULL DEFAULT 'expected',
  summary TEXT NOT NULL DEFAULT '',
  brands JSONB NOT NULL DEFAULT '[]'::jsonb,
  headline_sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
  program_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, event_slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_congress_events_tenant_starts
  ON workspace_congress_events (tenant_id, starts_at);

-- Ayvakit workspace: 5 congress events (chronological 2026)
INSERT INTO workspace_congress_events (
  tenant_id, event_slug, acronym, name, location, timezone,
  starts_at, ends_at, sort_order, focus_tags, priority, summary,
  brands, headline_sessions, program_url
)
SELECT
  t.tenant_id,
  e.event_slug,
  e.acronym,
  e.name,
  e.location,
  e.timezone,
  e.starts_at::timestamptz,
  e.ends_at::timestamptz,
  e.sort_order,
  e.focus_tags,
  e.priority::congress_priority,
  e.summary,
  e.brands::jsonb,
  e.headline_sessions::jsonb,
  e.program_url
FROM tenants t
CROSS JOIN (
  VALUES
    (
      'asco-2026',
      'ASCO',
      'ASCO Annual Meeting 2026',
      'McCormick Place, Chicago, IL',
      'America/Chicago',
      '2026-05-29T08:00:00-05:00',
      '2026-06-02T18:00:00-05:00',
      0,
      ARRAY['GIST', 'SM']::text[],
      'imminent',
      'GIST competitive readout week. Cogent PEAK Phase 3 oral (bezuclastinib + sunitinib vs sunitinib) with NDA under RTOR review.',
      '[{"brandName":"Bezuclastinib","role":"competitor","presence":"confirmed"},{"brandName":"Sutent","role":"competitor","presence":"expected"},{"brandName":"Qinlock","role":"competitor","presence":"expected"},{"brandName":"Ayvakit","role":"owned","presence":"expected"}]'::text,
      '[{"title":"Primary Results of the Phase 3 PEAK Study of bezuclastinib + sunitinib vs sunitinib Monotherapy in Advanced GIST","brandName":"Bezuclastinib","startsAt":"2026-05-30T15:00:00-05:00","endsAt":"2026-05-30T18:00:00-05:00","sessionLabel":"Oral Abstract Session - Sarcoma","abstractId":"11500","url":"https://www.globenewswire.com/news-release/2026/04/21/3277881/0/en/cogent-biosciences-announces-oral-presentation-of-positive-phase-3-peak-trial-in-gastrointestinal-stromal-tumors-gist-at-the-2026-american-society-of-clinical-oncology-asco-annual-.html"}]'::text,
      'https://www.asco.org/annual-meeting/'
    ),
    (
      'eha-2026',
      'EHA',
      'EHA2026 Congress',
      'Stockholmsmässan, Stockholm, Sweden',
      'Europe/Stockholm',
      '2026-06-11T08:00:00+02:00',
      '2026-06-14T18:00:00+02:00',
      1,
      ARRAY['AdvSM', 'SM']::text[],
      'pivotal',
      'AdvSM battleground. Cogent APEX pivotal oral for bezuclastinib; Blueprint historically presents PATHFINDER/PIONEER and MARS-R data at EHA.',
      '[{"brandName":"Bezuclastinib","role":"competitor","presence":"confirmed"},{"brandName":"Ayvakit","role":"owned","presence":"expected"},{"brandName":"Rydapt","role":"competitor","presence":"expected"}]'::text,
      '[{"title":"Efficacy and Safety of Bezuclastinib in Patients With Advanced Systemic Mastocytosis: Primary Results From the Apex Study","brandName":"Bezuclastinib","startsAt":"2026-06-13T17:15:00+02:00","endsAt":"2026-06-13T18:30:00+02:00","sessionLabel":"Oral Session S438 - Myeloproliferative Neoplasms – Clinical","abstractId":"S438","url":"https://investors.cogentbio.com/news-releases/news-release-details/cogent-biosciences-announces-multiple-presentations-european"}]'::text,
      'https://ehaweb.org/connect-network/eha2026-congress'
    ),
    (
      'eaaci-2026',
      'EAACI',
      'EAACI Congress 2026',
      'Istanbul Congress Center, Istanbul, Türkiye',
      'Europe/Istanbul',
      '2026-06-12T08:00:00+03:00',
      '2026-06-15T18:00:00+03:00',
      2,
      ARRAY['ISM', 'SM']::text[],
      'expected',
      'ISM-focused allergy congress overlapping EHA week. Blueprint has presented PIONEER long-term and PRISM burden data at EAACI; watch for bezuclastinib SUMMIT follow-through.',
      '[{"brandName":"Ayvakit","role":"owned","presence":"expected"},{"brandName":"Bezuclastinib","role":"competitor","presence":"expected"}]'::text,
      '[]'::text,
      'https://eaaci.org/events_congress/eaaci-congress-2026/'
    ),
    (
      'eadv-2026',
      'EADV',
      'EADV Congress 2026',
      'Vienna, Austria',
      'Europe/Vienna',
      '2026-09-30T08:00:00+02:00',
      '2026-10-03T18:00:00+02:00',
      3,
      ARRAY['SM']::text[],
      'watch',
      'Dermatology congress for cutaneous/skin manifestations of mastocytosis. Blueprint presented avapritinib SM data at EADV 2025.',
      '[{"brandName":"Ayvakit","role":"owned","presence":"expected"}]'::text,
      '[]'::text,
      'https://eadv.org/congress/'
    ),
    (
      'ash-2026',
      'ASH',
      '68th ASH Annual Meeting and Exposition',
      'New Orleans, LA',
      'America/Chicago',
      '2026-12-12T08:00:00-06:00',
      '2026-12-15T18:00:00-06:00',
      4,
      ARRAY['AdvSM', 'ISM', 'SM']::text[],
      'expected',
      'Flagship hematology congress for SM. ASH 2025 had 1 Blueprint oral and 7 posters (PATHFINDER, PIONEER, bone health); expect similar depth and bezuclastinib follow-up post-EHA.',
      '[{"brandName":"Ayvakit","role":"owned","presence":"expected"},{"brandName":"Bezuclastinib","role":"competitor","presence":"expected"},{"brandName":"Rydapt","role":"competitor","presence":"expected"}]'::text,
      '[]'::text,
      'https://www.hematology.org/meetings/annual-meeting'
    )
) AS e(
  event_slug, acronym, name, location, timezone,
  starts_at, ends_at, sort_order, focus_tags, priority, summary,
  brands, headline_sessions, program_url
)
WHERE t.tenant_slug = 'ayvakit'
ON CONFLICT (tenant_id, event_slug) DO UPDATE SET
  acronym = EXCLUDED.acronym,
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  timezone = EXCLUDED.timezone,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  sort_order = EXCLUDED.sort_order,
  focus_tags = EXCLUDED.focus_tags,
  priority = EXCLUDED.priority,
  summary = EXCLUDED.summary,
  brands = EXCLUDED.brands,
  headline_sessions = EXCLUDED.headline_sessions,
  program_url = EXCLUDED.program_url,
  updated_at = NOW();
