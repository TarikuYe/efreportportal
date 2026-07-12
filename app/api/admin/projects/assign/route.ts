import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────
// Role guard — dgm or admin only
// Checks the employees table role column AND the DGM_EMAIL env var as a
// fallback, so the very first DGM login (before the profile row exists)
// still has access.
// ─────────────────────────────────────────
async function requireAdmin(userId: string, userEmail: string): Promise<boolean> {
  // Fast path: DGM_EMAIL env var match
  if (
    process.env.DGM_EMAIL &&
    userEmail.toLowerCase() === process.env.DGM_EMAIL.toLowerCase()
  ) {
    return true
  }
  // DB role lookup
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return employee?.role === 'dgm' || employee?.role === 'admin'
}

// ─────────────────────────────────────────
// POST /api/admin/projects/assign
// Register a new project.  Inserts the minimal required columns first, then
// attempts an UPDATE to patch in the extended fields.  This way the route
// works even when client/contractor/start_date/estimated_completion columns
// don't yet exist in the schema — the PATCH simply no-ops on unknown columns.
// ─────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    if (!(await requireAdmin(user.id, user.email ?? ''))) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const code = String(body.code ?? '').trim().toUpperCase()
    const name = String(body.name ?? '').trim()
    const client = String(body.client ?? '').trim() || null
    const contractor = String(body.contractor ?? '').trim() || null
    const startDate = body.start_date ? String(body.start_date).trim() : null
    const estimatedCompletion = body.estimated_completion
      ? String(body.estimated_completion).trim()
      : null

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Project code and name are required.' },
        { status: 400 },
      )
    }

    const adminClient = createAdminClient()

    // Step 1 — always insert only the guaranteed core columns
    const { data: created, error: insertErr } = await adminClient
      .from('projects')
      .insert({ code, name, active: true })
      .select()
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json(
          { error: `Project code "${code}" already exists.` },
          { status: 409 },
        )
      }
      console.error('[admin/projects/assign] POST insert error:', insertErr.message)
      return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 })
    }

    // Step 2 — attempt to patch in extended fields if they exist in the schema.
    // Build an update payload with only the fields that have values.
    const extended: Record<string, string> = {}
    if (client) extended.client = client
    if (contractor) extended.contractor = contractor
    if (startDate) extended.start_date = startDate
    if (estimatedCompletion) extended.estimated_completion = estimatedCompletion

    let finalProject = created

    if (Object.keys(extended).length > 0) {
      const { data: updated } = await adminClient
        .from('projects')
        .update(extended)
        .eq('id', created.id)
        .select()
        .single()
      // If update succeeded (columns exist) use the richer row; otherwise
      // fall back to the inserted row — no error thrown either way.
      if (updated) finalProject = updated
    }

    return NextResponse.json({ project: finalProject }, { status: 201 })
  } catch (err) {
    console.error(
      '[admin/projects/assign] POST unexpected:',
      err instanceof Error ? err.message : String(err),
    )
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// PUT /api/admin/projects/assign
// Sync the full set of employee assignments for a project.
//
// Body: { project_id: string, employee_ids: string[] }
//
// Resolves project UUID → project_code, then deletes all existing rows in
// employee_project_assignments for that code and bulk-inserts the new set.
// ─────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    if (!(await requireAdmin(user.id, user.email ?? ''))) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const projectId = String(body.project_id ?? '').trim()
    const employeeIds: string[] = Array.isArray(body.employee_ids) ? body.employee_ids : []

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Resolve code from UUID
    const { data: project, error: projErr } = await adminClient
      .from('projects')
      .select('code')
      .eq('id', projectId)
      .maybeSingle()

    if (projErr || !project) {
      console.error('[admin/projects/assign] PUT project lookup:', projErr?.message)
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
    const projectCode = project.code

    // Wipe existing assignments
    const { error: delErr } = await adminClient
      .from('employee_project_assignments')
      .delete()
      .eq('project_code', projectCode)

    if (delErr) {
      console.error('[admin/projects/assign] PUT delete error:', delErr.message)
      return NextResponse.json({ error: 'Failed to clear existing assignments.' }, { status: 500 })
    }

    // Insert new set
    if (employeeIds.length > 0) {
      const rows = employeeIds.map((eid) => ({
        employee_id: eid,
        project_code: projectCode,
      }))
      const { error: insErr } = await adminClient
        .from('employee_project_assignments')
        .insert(rows)

      if (insErr) {
        console.error('[admin/projects/assign] PUT insert error:', insErr.message)
        return NextResponse.json({ error: 'Failed to save assignments.' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      project_code: projectCode,
      assigned: employeeIds.length,
    })
  } catch (err) {
    console.error(
      '[admin/projects/assign] PUT unexpected:',
      err instanceof Error ? err.message : String(err),
    )
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
