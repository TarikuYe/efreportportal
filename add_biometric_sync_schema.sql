-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Biometric Fingerprint Sync — Schema Extensions
-- EF Architects & Engineers Consulting
-- Run once against your Supabase project via the SQL Editor or psql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Map physical biometric machine device IDs to employee records.
--    biometric_device_id  →  the UserBiometricID stored on the ZKTeco device
--    (VARCHAR 100, globally unique — one machine slot per employee)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS biometric_device_id VARCHAR(100) UNIQUE;

COMMENT ON COLUMN employees.biometric_device_id IS
  'Physical fingerprint machine user ID (e.g. ZKTeco UID). '
  'Set by the registrar when enrolling a new employee on the device. '
  'Used by the biometric sync daemon to map punches to employee rows.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Composite unique constraint on daily_work_logs to enable safe upserts.
--    Prevents duplicate rows when the sync daemon reruns over the same day.
--    The ON CONFLICT target for `.upsert()` will be (employee_id, log_date).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE daily_work_logs
  ADD CONSTRAINT IF NOT EXISTS unique_employee_date_log
    UNIQUE (employee_id, log_date);

COMMENT ON CONSTRAINT unique_employee_date_log ON daily_work_logs IS
  'Guarantees at most one work-log row per employee per calendar day. '
  'Allows the biometric sync gateway to call upsert() safely on repeated runs.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Dedicated audit table for fingerprint punches that could not be mapped
--    to any employee row (biometric_device_id not found in employees).
--    The registrar uses this table to manually bind orphan punches later.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unmapped_device_logs (
  id               BIGSERIAL    PRIMARY KEY,
  device_id        VARCHAR(100) NOT NULL,   -- raw UserBiometricID from machine
  punch_timestamp  TIMESTAMPTZ  NOT NULL,   -- original punch time (UTC)
  punch_type       SMALLINT     NOT NULL,   -- 0 = entrance, 1 = leave
  received_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  resolved         BOOLEAN      NOT NULL DEFAULT FALSE,
  resolved_by      UUID         REFERENCES employees(id),
  resolved_at      TIMESTAMPTZ,
  notes            TEXT
);

COMMENT ON TABLE unmapped_device_logs IS
  'Orphan biometric punches whose device_id does not match any employee. '
  'Registrar staff resolve these rows by assigning the correct employee '
  'and setting resolved = TRUE.';

CREATE INDEX IF NOT EXISTS idx_unmapped_device_logs_device_id
  ON unmapped_device_logs (device_id);

CREATE INDEX IF NOT EXISTS idx_unmapped_device_logs_resolved
  ON unmapped_device_logs (resolved)
  WHERE resolved = FALSE;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. (Optional) Enable Row-Level Security on unmapped_device_logs so only
--    admin / registrar roles can read or write it from the client SDK.
--    Service-role (used by the sync daemon) bypasses RLS automatically.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE unmapped_device_logs ENABLE ROW LEVEL SECURITY;

-- Admins and registrars may read all rows
CREATE POLICY IF NOT EXISTS "admins_read_unmapped_logs"
  ON unmapped_device_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
        AND employees.role IN ('admin', 'dgm', 'registrar')
    )
  );

-- Admins and registrars may mark rows as resolved
CREATE POLICY IF NOT EXISTS "admins_update_unmapped_logs"
  ON unmapped_device_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
        AND employees.role IN ('admin', 'dgm', 'registrar')
    )
  );
