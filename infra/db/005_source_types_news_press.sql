-- Idempotent: extend source_type for first-class press/news ingestion.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'source_type' AND e.enumlabel = 'news'
  ) THEN
    ALTER TYPE source_type ADD VALUE 'news';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'source_type' AND e.enumlabel = 'press'
  ) THEN
    ALTER TYPE source_type ADD VALUE 'press';
  END IF;
END $$;
