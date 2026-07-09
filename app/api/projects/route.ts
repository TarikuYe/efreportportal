import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROJECTS } from '@/lib/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDGM(email: string) {
  return email.toLowerCase() === process.env.DGM_EMAIL?.toLowerCase()
}

// ─────────────────────────────────────────
// GET /api/projects
// ?all=1   → include archived (admin use only)
// ?mine=1  → only projects assigned to the current user
// ─────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const showAll = searchParams.get('all') === '1'
    const mineOnly = searchParams.get('mine') === '1'

    const admin = createAdminClient()

    if (mineOnly) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.id) {
        const { data: assignments } = await admin
          .from('employee_project_assignments')
          .select('project_code')
          .eq('employee_id', user.id)

        if (assignments && assignments.length > 0) {
          const codes = assignments.map((a: { project_code: string }) => a.project_code)
          const { data: projects, error } = await admin
            .from('projects')
            .select('*')
            .in('code', codes)
            .eq('active', true)
            .order('created_at', { ascending: true })

          if (error) {
            console.log('[projects] mine GET error:', error.message)
            return NextResponse.json({ error: 'Failed to load projects.' }, { status: 500 })
          }
          return NextResponse.json({ projects: projects ?? [] })
        }
      }
      // No assignments found — fall through to return all active projects
    }

    let query = admin.from('projects').select('*').order('created_at', { ascending: true })
    if (!showAll) query = query.eq('active', true)

    const { data, error } = await query

    if (error) {
      // Table may not exist yet — fall back to static list
      console.log('[projects] GET error (fallback):', error.message)
      return NextResponse.json({ projects: PROJECTS })
    }

    // If the table is empty and we have the static list, seed the response
    if (!data || data.length === 0) {
      return NextResponse.json({ projects: PROJECTS })
    }

    return NextResponse.json({ projects: data })
  } catch (err) {
    console.log('[projects] GET unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ projects: PROJECTS })
  }
}

// ─────────────────────────────────────────
// POST /api/projects  — create a new project (admin only)
// ─────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    if (!isDGM(user.email)) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const code = String(body.code ?? '').trim().toUpperCase()
    const name = String(body.name ?? '').trim()

    if (!code || !name) {
      return NextResponse.json({ error: 'code and name are required.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projects')
      .insert({ code, name, active: true })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Project code "${code}" already exists.` }, { status: 409 })
      }
      console.log('[projects] POST error:', error.message)
      return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 })
    }

    return NextResponse.json({ project: data }, { status: 201 })
  } catch (err) {
    console.log('[projects] POST unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// PATCH /api/projects  — update a project (admin only)
// ─────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    if (!isDGM(user.email)) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Project id is required.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.log('[projects] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 })
    }

    return NextResponse.json({ project: data })
  } catch (err) {
    console.log('[projects] PATCH unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─────────────────────────────────────────
// DELETE /api/projects  — delete a project (admin only)
// ─────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    if (!isDGM(user.email)) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body.id ?? '').trim()

    if (!id) {
      return NextResponse.json({ error: 'Project id is required.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('projects').delete().eq('id', id)

    if (error) {
      console.log('[projects] DELETE error:', error.message)
      return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.log('[projects] DELETE unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
