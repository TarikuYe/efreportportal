-- ============================================================
-- Migration: Add single-use view tokens to project_bonds and eot_tracker
--
-- Purpose: Each automated alert email embeds a unique UUID token
--          that expires after 7 days. The public notice page
--          (/notice/bond/:token  /notice/eot/:token) looks up
--          ONLY the matching row and renders it — no auth, no
--          other records exposed.
--
-- Reset policy: A fresh token is written every time the cron
--               dispatches a new alert for that record.
-- ============================================================

ALTER TABLE project_bonds
  ADD COLUMN IF NOT EXISTS view_token        UUID,
  ADD COLUMN IF NOT EXISTS token_expires_at  TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_project_bonds_view_token
  ON project_bonds (view_token)
  WHERE view_token IS NOT NULL;

ALTER TABLE eot_tracker
  ADD COLUMN IF NOT EXISTS view_token        UUID,
  ADD COLUMN IF NOT EXISTS token_expires_at  TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_eot_tracker_view_token
  ON eot_tracker (view_token)
  WHERE view_token IS NOT NULL;
