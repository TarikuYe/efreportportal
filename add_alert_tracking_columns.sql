-- ============================================================
-- Migration: Add notification cooldown tracking columns
-- Tables:    project_bonds, eot_tracker
--
-- Purpose: Prevents duplicate daily alert emails for the same
--          warning threshold. The cron job checks these columns
--          before dispatching to ensure each threshold (30/15/7
--          days for bonds, 30/15 days for EOT) is only emailed
--          once per warning window.
--
-- Reset policy:
--   - project_bonds: Reset when expiry_date is updated (bond renewed)
--   - eot_tracker:   Reset when revised_completion_date is updated
-- ============================================================

-- ─── project_bonds ──────────────────────────────────────────
ALTER TABLE project_bonds
  ADD COLUMN IF NOT EXISTS last_notified_at        TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS notified_warning_threshold INTEGER DEFAULT 0;

COMMENT ON COLUMN project_bonds.last_notified_at IS
  'Timestamp of the most recent automated expiry alert email sent for this bond.';
COMMENT ON COLUMN project_bonds.notified_warning_threshold IS
  'The warning threshold (days remaining: 30, 15, or 7) for which the last alert was sent. '
  'Resets to 0 when expiry_date is updated (bond renewed).';

-- ─── eot_tracker ────────────────────────────────────────────
ALTER TABLE eot_tracker
  ADD COLUMN IF NOT EXISTS last_notified_at        TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS notified_warning_threshold INTEGER DEFAULT 0;

COMMENT ON COLUMN eot_tracker.last_notified_at IS
  'Timestamp of the most recent automated EOT deadline alert email sent for this record.';
COMMENT ON COLUMN eot_tracker.notified_warning_threshold IS
  'The warning threshold (days remaining: 30 or 15) for which the last alert was sent. '
  'Resets to 0 when revised_completion_date is updated (EOT re-extended).';
