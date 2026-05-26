-- Add dedicated signal_type for social posts and reclassify existing social signals.
-- Safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'signal_type'
      AND e.enumlabel = 'social_intelligence'
  ) THEN
    ALTER TYPE signal_type ADD VALUE 'social_intelligence';
  END IF;
END $$;

UPDATE signals s
SET signal_type = 'social_intelligence'
WHERE s.source_id IN (
  SELECT source_id FROM sources WHERE source_type = 'social'
)
AND s.signal_type <> 'social_intelligence';

