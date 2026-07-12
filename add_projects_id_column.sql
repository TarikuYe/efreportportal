-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add id UUID column to projects + extended metadata columns
-- Run this in the Supabase SQL Editor (once only).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add a UUID id column (if it doesn't already exist).
--    We keep 'code' as the existing primary key so foreign keys are unaffected.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() NOT NULL;

-- 2. Make id unique so it can be used as a reliable lookup key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'projects'::regclass AND conname = 'projects_id_unique'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_id_unique UNIQUE (id);
  END IF;
END $$;

-- 3. Add extended metadata columns (safe to run multiple times).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client             TEXT,
  ADD COLUMN IF NOT EXISTS contractor         TEXT,
  ADD COLUMN IF NOT EXISTS start_date         DATE,
  ADD COLUMN IF NOT EXISTS estimated_completion DATE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT id, code, name, client, contractor, start_date, estimated_completion, active
-- FROM projects
-- ORDER BY created_at;
