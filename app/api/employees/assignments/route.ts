import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdminOrDgm(userId: string) {
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
    const hasAccess = await checkAdminOrDgm(user.id)
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
    const hasAccess = await checkAdminOrDgm(user.id)
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
    const { data, error } = await admin
      .from('employee_project_assignments')
      .insert({ employee_id: employeeId, project_code: projectCode })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This project is already assigned to this employee.' },
          { status: 409 },
        )
      }
      console.log('[assignments] POST error:', error.message)
      return NextResponse.json({ error: 'Failed to assign project.' }, { status: 500 })
    }

    return NextResponse.json({ assignment: data }, { status: 201 })
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
    const hasAccess = await checkAdminOrDgm(user.id)
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
