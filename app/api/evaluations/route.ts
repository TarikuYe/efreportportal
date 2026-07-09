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

// GET /api/evaluations
// Engineers can only see their own evaluations; admins/dgms can retrieve all.
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: currentEmp } = await admin
      .from('employees')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (!currentEmp) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const targetEmployeeId = searchParams.get('employee_id')

    let query = admin
      .from('performance_evaluations')
      .select('*, employees(full_name, email, department)')
      .order('evaluation_period_end', { ascending: false })

    if (currentEmp.role !== 'admin' && currentEmp.role !== 'dgm' && currentEmp.role !== 'registrar') {
      // Engineer role: restrict query to their own ID
      query = query.eq('employee_id', currentEmp.id)
    } else if (targetEmployeeId) {
      // Admin/DGM/Registrar filtering by employee
      query = query.eq('employee_id', targetEmployeeId)
    }

    const { data: evaluations, error } = await query

    if (error) {
      console.error('[evaluations] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to retrieve evaluations.' }, { status: 500 })
    }

    return NextResponse.json({ evaluations: evaluations ?? [] })
  } catch (err) {
    console.error('[evaluations] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// POST /api/evaluations
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const hasAccess = await checkAdminOrDgm(user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })
    }

    const body = await request.json()
    const employeeId = body.employee_id
    const periodStart = body.evaluation_period_start
    const periodEnd = body.evaluation_period_end

    const tech = Number(body.tech_competence_score ?? 0)
    const prod = Number(body.productivity_score ?? 0)
    const punc = Number(body.punctuality_score ?? 0)
    const comm = Number(body.communication_score ?? 0)
    const rep = Number(body.reporting_score ?? 0)
    const adapt = Number(body.adaptability_score ?? 0)

    if (!employeeId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Missing employee, period start, or period end.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('performance_evaluations')
      .insert({
        employee_id: employeeId,
        evaluation_period_start: periodStart,
        evaluation_period_end: periodEnd,
        tech_competence_score: tech,
        productivity_score: prod,
        punctuality_score: punc,
        communication_score: comm,
        reporting_score: rep,
        adaptability_score: adapt
      })
      .select()
      .single()

    if (error) {
      console.error('[evaluations] POST error:', error.message)
      return NextResponse.json({ error: 'Failed to create evaluation: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, evaluation: data })
  } catch (err) {
    console.error('[evaluations] POST unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// PATCH /api/evaluations
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const hasAccess = await checkAdminOrDgm(user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Evaluation id is required.' }, { status: 400 })
    }

    const cleanUpdates: Record<string, any> = {}
    if (updates.evaluation_period_start !== undefined) cleanUpdates.evaluation_period_start = updates.evaluation_period_start
    if (updates.evaluation_period_end !== undefined) cleanUpdates.evaluation_period_end = updates.evaluation_period_end
    if (updates.tech_competence_score !== undefined) cleanUpdates.tech_competence_score = Number(updates.tech_competence_score)
    if (updates.productivity_score !== undefined) cleanUpdates.productivity_score = Number(updates.productivity_score)
    if (updates.punctuality_score !== undefined) cleanUpdates.punctuality_score = Number(updates.punctuality_score)
    if (updates.communication_score !== undefined) cleanUpdates.communication_score = Number(updates.communication_score)
    if (updates.reporting_score !== undefined) cleanUpdates.reporting_score = Number(updates.reporting_score)
    if (updates.adaptability_score !== undefined) cleanUpdates.adaptability_score = Number(updates.adaptability_score)

    if (Object.keys(cleanUpdates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('performance_evaluations')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[evaluations] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update evaluation: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, evaluation: data })
  } catch (err) {
    console.error('[evaluations] PATCH unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
