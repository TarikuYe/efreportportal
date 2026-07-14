-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add admin-only function to hard-delete an employee and all their
--            data, bypassing the lock_submitted_tasks trigger.
--
-- The trigger is SECURITY DEFINER and fires even for service-role calls.
-- This function also runs as SECURITY DEFINER (as the table owner / postgres),
-- so it can disable the trigger for the duration of the delete, then re-enable.
--
-- NOTE: The permission check (admin/dgm role) is enforced in the API layer
-- before this RPC is ever called. The function itself is restricted to
-- service_role only, so it cannot be called by anonymous or authenticated
-- clients directly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_delete_employee(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable the immutability trigger for this transaction
  ALTER TABLE daily_work_logs DISABLE TRIGGER lock_submitted_tasks;

  -- Delete child rows in safe dependency order
  DELETE FROM employee_project_assignments WHERE employee_id = target_id;
  DELETE FROM daily_work_log_reviews       WHERE reviewed_by = target_id;
  DELETE FROM performance_evaluations      WHERE employee_id = target_id;
  DELETE FROM daily_work_logs              WHERE employee_id = target_id;

  -- Delete the employee profile row
  DELETE FROM employees WHERE id = target_id;

  -- Re-enable the trigger immediately after
  ALTER TABLE daily_work_logs ENABLE TRIGGER lock_submitted_tasks;

EXCEPTION WHEN OTHERS THEN
  -- Always re-enable the trigger even if something fails mid-way
  ALTER TABLE daily_work_logs ENABLE TRIGGER lock_submitted_tasks;
  RAISE;
END;
$$;

-- Revoke from public so authenticated/anon clients cannot call it directly
REVOKE ALL ON FUNCTION admin_delete_employee(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_employee(UUID) TO service_role;
