-- ============================================================
-- Migration: Create system_cron_logs diagnostics table
--
-- Purpose: Every cron run appends a single row containing the
--          run outcome and per-category send counts. Used for
--          monitoring, debugging, and audit trails without
--          needing to tail Vercel logs.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_cron_logs (
  id               BIGSERIAL PRIMARY KEY,

  -- Human-readable job identifier, e.g. 'email-alerts'
  job_name         VARCHAR(100)   NOT NULL DEFAULT 'email-alerts',

  -- 'success' | 'partial' | 'error'
  status           VARCHAR(20)    NOT NULL DEFAULT 'success',

  -- How many bond alert emails were dispatched this run
  bonds_sent       INTEGER        NOT NULL DEFAULT 0,

  -- How many EOT advisory emails were dispatched this run
  eots_sent        INTEGER        NOT NULL DEFAULT 0,

  -- Total emails attempted (bonds_sent + eots_sent)
  total_sent       INTEGER        NOT NULL DEFAULT 0,

  -- Number of send failures (transport errors, invalid addresses, etc.)
  errors_count     INTEGER        NOT NULL DEFAULT 0,

  -- Free-form detail message (e.g. error stack, summary note)
  detail           TEXT,

  -- UTC wall-clock time the cron execution started
  executed_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by job name and recency
CREATE INDEX IF NOT EXISTS idx_system_cron_logs_job_executed
  ON system_cron_logs (job_name, executed_at DESC);

-- Optionally keep only the last 180 days of logs automatically.
-- Uncomment if you want Postgres to auto-purge old rows via a trigger or pg_cron.
-- ALTER TABLE system_cron_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE system_cron_logs IS
  'Append-only diagnostics log for automated cron job executions. '
  'Each row represents one cron run cycle and its email dispatch summary.';
