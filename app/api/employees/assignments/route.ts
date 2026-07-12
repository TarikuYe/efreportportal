import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdminOrDgm(userId: string, userEmail: string) {
  // Fast-path: DGM_EMAIL env var match (covers first-login before DB row exists)
  if (
    process.env.DGM_EMAIL &&
    userEmail.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()
  ) {
    return true
  }
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return employee?.role === 'admin' || employee?.role === 'dgm' || employee?.role === 'registrar'
}

// ─────────────────────────────────────────
// GET /api/employees/assignments
// Returns all project assignments (admin/dgm/registrar only)
// ─────────────────────────────────────────
export async function GET(_request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id, user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('employee_project_assignments')
      .select('employee_id, project_code')

    if (error) {
      // Table may not exist yet — return empty rather than crashing
      console.log('[assignments] GET error:', error.message)
      return NextResponse.json({ assignments: [] })
    }

    return NextResponse.json({ assignments: data ?? [] })
  } catch (err) {
    console.log('[assignments] GET unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ assignments: [] })
  }
}

// ─────────────────────────────────────────
// POST /api/employees/assignments
// Assign a project to an employee (admin only)
// Body: { employee_id: string, project_code: string }
// ─────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id, user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const employeeId = String(body.employee_id ?? '').trim()
    const projectCode = String(body.project_code ?? '').trim()

    console.log('[assignments] POST called — employeeId:', employeeId, '| projectCode:', projectCode, '| callerEmail:', user.email)

    if (!employeeId || !projectCode) {
      return NextResponse.json(
        { error: 'employee_id and project_code are required.' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Verify the project code exists before inserting
    const { data: project, error: projLookupErr } = await admin
      .from('projects')
      .select('code')
      .eq('code', projectCode)
      .maybeSingle()

    if (projLookupErr) {
      console.log('[assignments] POST project lookup error:', projLookupErr.message, projLookupErr.code, projLookupErr.details)
      return NextResponse.json(
        { error: `DB error looking up project: ${projLookupErr.message}` },
        { status: 500 },
      )
    }

    if (!project) {
      // projects table might not exist yet — skip the FK check and attempt insert anyway
      // (will get a clear FK error back if table exists but code is wrong)
      console.log(`[assignments] POST warning: project "${projectCode}" not found in projects table — attempting insert anyway`)
    }

    // Use upsert to avoid duplicate-key errors on retry
    const { error } = await admin
      .from('employee_project_assignments')
      .upsert(
        { employee_id: employeeId, project_code: projectCode },
        { onConflict: 'employee_id,project_code', ignoreDuplicates: true },
      )

    if (error) {
      console.log('[assignments] POST upsert error:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint)
      return NextResponse.json({ error: `Failed to assign project: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ assignment: { employee_id: employeeId, project_code: projectCode } }, { status: 201 })
  } catch (err) {
    console.log('[assignments] POST unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// DELETE /api/employees/assignments
// Remove a project assignment (admin only)
// Body: { employee_id: string, project_code: string }
// ─────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id, user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const employeeId = String(body.employee_id ?? '').trim()
    const projectCode = String(body.project_code ?? '').trim()

    if (!employeeId || !projectCode) {
      return NextResponse.json(
        { error: 'employee_id and project_code are required.' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('employee_project_assignments')
      .delete()
      .eq('employee_id', employeeId)
      .eq('project_code', projectCode)

    if (error) {
      console.log('[assignments] DELETE error:', error.message)
      return NextResponse.json({ error: 'Failed to remove assignment.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.log('[assignments] DELETE unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
