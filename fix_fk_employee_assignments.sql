-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: employee_project_assignments FK points to wrong table
--
-- employee_profiles columns: id, full_name, email, department, active, created_at
-- employees columns:         id, full_name, email, department, role, created_at
--
-- Steps:
--   1. Copy missing rows from employee_profiles → employees (no role col, default 'engineer')
--   2. Drop wrong FK (references employee_profiles)
--   3. Re-add FK referencing employees(id)
--   4. Add id + extended columns to projects (safe no-op if already done)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Copy rows from employee_profiles that are missing in employees
INSERT INTO employees (id, full_name, email, department)
SELECT
  ep.id,
  ep.full_name,
  ep.email,
  COALESCE(ep.department, 'Procurement and Contract Administration')
FROM employee_profiles ep
WHERE NOT EXISTS (
  SELECT 1 FROM employees e WHERE e.id = ep.id
)
ON CONFLICT (id) DO NOTHING;

-- ── Step 2: Drop the wrong FK constraint
ALTER TABLE employee_project_assignments
  DROP CONSTRAINT IF EXISTS employee_project_assignments_employee_id_fkey;

-- ── Step 3: Re-add FK pointing to employees (the correct table)
ALTER TABLE employee_project_assignments
  ADD CONSTRAINT employee_project_assignments_employee_id_fkey
  FOREIGN KEY (employee_id)
  REFERENCES employees(id)
  ON DELETE CASCADE;

-- ── Step 4: Add UUID id + extended metadata columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS id                   UUID DEFAULT gen_random_uuid() NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'projects'::regclass
      AND conname = 'projects_id_unique'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_id_unique UNIQUE (id);
  END IF;
END $$;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client               TEXT,
  ADD COLUMN IF NOT EXISTS contractor           TEXT,
  ADD COLUMN IF NOT EXISTS start_date           DATE,
  ADD COLUMN IF NOT EXISTS estimated_completion DATE;

-- ── Verify after running ──────────────────────────────────────────────────────
-- SELECT id, email, role FROM employees;
-- SELECT conname, confrelid::regclass
--   FROM pg_constraint
--  WHERE conrelid = 'employee_project_assignments'::regclass;
-- → should show: employee_project_assignments_employee_id_fkey | employees
