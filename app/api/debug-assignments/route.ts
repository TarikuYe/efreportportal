import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────
// GET /api/debug-assignments
// Diagnostic endpoint — checks actual DB state for assignments.
// Remove this file once the issue is resolved.
// ─────────────────────────────────────────
export async function GET() {
  try {
    const admin = createAdminClient()
    const results: Record<string, unknown> = {}

    // 1. Check projects table
    const { data: projects, error: projErr } = await admin
      .from('projects')
      .select('code, name, active')
      .order('created_at', { ascending: true })
    results.projects = projects ?? []
    results.projects_error = projErr?.message ?? null

    // 2. Check employee_project_assignments table
    const { data: assignments, error: assignErr } = await admin
      .from('employee_project_assignments')
      .select('employee_id, project_code')
    results.assignments = assignments ?? []
    results.assignments_error = assignErr?.message ?? null

    // 3. Check employees table (just id + email + role)
    const { data: employees, error: empErr } = await admin
      .from('employees')
      .select('id, email, role, full_name')
      .order('created_at', { ascending: true })
    results.employees = employees ?? []
    results.employees_error = empErr?.message ?? null

    // 5. Check employee_profiles columns
    const { data: profiles, error: profErr } = await admin
      .from('employee_profiles')
      .select('*')
      .limit(3)
    results.employee_profiles_sample = profiles ?? []
    results.employee_profiles_error = profErr?.message ?? null
    const { error: testErr } = await admin
      .from('employee_project_assignments')
      .upsert(
        { employee_id: '00000000-0000-0000-0000-000000000000', project_code: '__TEST__' },
        { onConflict: 'employee_id,project_code', ignoreDuplicates: true },
      )
    results.test_upsert_error = testErr ? `${testErr.message} | code:${testErr.code} | details:${testErr.details} | hint:${testErr.hint}` : 'no error (unexpected — __TEST__ code should fail FK)'

    return NextResponse.json(results, { status: 200 })
  } catch (err) {
    return NextResponse.json({
      fatal: err instanceof Error ? err.message : String(err)
    }, { status: 500 })
  }
}
