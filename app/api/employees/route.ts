import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdminOrDgm(userId: string, userEmail: string, allowRegistrar = false) {
  // Fast-path: DGM_EMAIL env var match (covers first login before DB row exists)
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
  if (allowRegistrar) {
    return employee?.role === 'admin' || employee?.role === 'dgm' || employee?.role === 'registrar'
  }
  return employee?.role === 'admin' || employee?.role === 'dgm'
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─────────────────────────────────────────
// GET /api/employees
// ─────────────────────────────────────────
export async function GET(_request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id, user.email, true)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: profiles, error } = await admin
      .from('employees')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.log('[employees] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to load employees.' }, { status: 500 })
    }

    // Enrich with active status from Auth ban state
    let bannedIds = new Set<string>()
    try {
      const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const now = new Date()
      bannedIds = new Set(
        (authList?.users ?? [])
          .filter(u => u.banned_until && new Date(u.banned_until) > now)
          .map(u => u.id)
      )
    } catch (authErr) {
      console.log('[employees] Auth list warning:', authErr instanceof Error ? authErr.message : String(authErr))
    }

    const enriched = (profiles ?? []).map(p => ({
      ...p,
      active: !bannedIds.has(p.id),
    }))

    return NextResponse.json({ employees: enriched })
  } catch (err) {
    console.log('[employees] GET unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// POST /api/employees  — create new employee account (admin only)
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
    const fullName = String(body.full_name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const department = String(body.department ?? '').trim()
    const role = String(body.role ?? '').trim() || 'engineer'

    if (!fullName || !email) {
      return NextResponse.json({ error: 'Full name and email are required.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const tempPassword = generateTempPassword()
    const admin = createAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already')) {
        return NextResponse.json(
          { error: `An account with email "${email}" already exists.` },
          { status: 409 },
        )
      }
      console.log('[employees] createUser error:', authError.message)
      return NextResponse.json({ error: 'Failed to create user account.' }, { status: 500 })
    }

    const newUserId = authData.user.id

    const { data: profile, error: profileError } = await admin
      .from('employees')
      .insert({
        id: newUserId,
        full_name: fullName,
        email,
        department: department || 'Procurement and Contract Administration',
        role: role,
      })
      .select()
      .single()

    if (profileError) {
      await admin.auth.admin.deleteUser(newUserId)
      console.log('[employees] profile insert error:', profileError.message)
      return NextResponse.json({ error: 'Failed to create employee profile.' }, { status: 500 })
    }

    return NextResponse.json(
      { employee: { ...profile, employee_project_assignments: [] }, temp_password: tempPassword },
      { status: 201 },
    )
  } catch (err) {
    console.log('[employees] POST unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// PATCH /api/employees  — update profile or active status (admin only)
// ─────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const hasAccess = await checkAdminOrDgm(user.id, user.email, true)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body.id ?? '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Employee id is required.' }, { status: 400 })
    }

    const admin = createAdminClient()

    if (typeof body.active === 'boolean') {
      if (body.active === false) {
        await admin.auth.admin.updateUserById(id, { ban_duration: '876600h' })
      } else {
        await admin.auth.admin.updateUserById(id, { ban_duration: 'none' })
      }
      if (body.full_name === undefined && body.department === undefined && body.role === undefined) {
        return NextResponse.json({ employee: { id, active: body.active } })
      }
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.full_name === 'string' && body.full_name.trim()) {
      updates.full_name = body.full_name.trim()
    }
    if (typeof body.department === 'string') {
      updates.department = body.department.trim() || null
    }
    if (typeof body.role === 'string') {
      updates.role = body.role.trim() || 'engineer'
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('employees')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.log('[employees] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update employee.' }, { status: 500 })
    }

    return NextResponse.json({ employee: data })
  } catch (err) {
    console.log('[employees] PATCH unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// DELETE /api/employees  — permanently remove employee (admin/dgm only)
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
    const id = String(body.id ?? '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Employee id is required.' }, { status: 400 })
    }

    // Prevent self-deletion
    if (id === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── 1. Remove project assignments (FK may not have ON DELETE CASCADE) ──
    const { error: assignErr } = await admin
      .from('employee_project_assignments')
      .delete()
      .eq('employee_id', id)
    if (assignErr) console.log('[employees] DELETE step1 assignments:', assignErr.message)

    // ── 2. Remove review records that reference this employee ──
    const { error: reviewErr } = await admin
      .from('daily_work_log_reviews')
      .delete()
      .eq('reviewed_by', id)
    if (reviewErr) console.log('[employees] DELETE step2 reviews:', reviewErr.message)

    // ── 3. Remove performance evaluations ──
    const { error: evalErr } = await admin
      .from('performance_evaluations')
      .delete()
      .eq('employee_id', id)
    if (evalErr) console.log('[employees] DELETE step3 evaluations:', evalErr.message)

    // ── 4. Remove daily work logs ──
    // Note: lock_submitted_tasks trigger uses SECURITY DEFINER and fires even for
    // service-role. We must drop the trigger temporarily or use a bypass function.
    // Workaround: use a raw RPC call that runs as postgres superuser, or
    // accept that logs may remain and skip this step — the employees row delete
    // is what matters for access removal.
    const { error: logsErr } = await admin
      .from('daily_work_logs')
      .delete()
      .eq('employee_id', id)
    if (logsErr) {
      // Trigger blocks deletion — this is expected if lock_submitted_tasks is active.
      // Log it but continue; the auth user will be removed so access is revoked.
      console.log('[employees] DELETE step4 logs (trigger may block):', logsErr.message)
    }

    // ── 5. Delete the employees profile row ──
    const { error: profileError } = await admin
      .from('employees')
      .delete()
      .eq('id', id)

    if (profileError) {
      console.log('[employees] DELETE step5 profile error:', profileError.message, profileError.code, profileError.details)
      return NextResponse.json({ error: `Failed to delete employee profile: ${profileError.message}` }, { status: 500 })
    }

    // ── 6. Delete the Supabase Auth user ──
    const { error: authError } = await admin.auth.admin.deleteUser(id)
    if (authError) {
      console.log('[employees] DELETE step6 auth user error:', authError.message)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log('[employees] DELETE unexpected:', msg)
    return NextResponse.json({ error: `Unexpected server error: ${msg}` }, { status: 500 })
  }
}
