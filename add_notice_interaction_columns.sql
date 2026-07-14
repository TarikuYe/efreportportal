-- ============================================================
-- Migration: Add contractor interaction columns
--
-- project_bonds:
--   renewal_note       — free-text message submitted by contractor
--   renewal_submitted_at — when the contractor hit "Submit"
--
-- eot_tracker:
--   progress_note      — site progress update logged via notice page
--   progress_updated_at — when that note was last written
-- ============================================================

ALTER TABLE project_bonds
  ADD COLUMN IF NOT EXISTS renewal_note         TEXT,
  ADD COLUMN IF NOT EXISTS renewal_submitted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE eot_tracker
  ADD COLUMN IF NOT EXISTS progress_note        TEXT,
  ADD COLUMN IF NOT EXISTS progress_updated_at  TIMESTAMP WITH TIME ZONE;
