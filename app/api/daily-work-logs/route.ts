import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getOrCreateEmployee(userId: string, email: string, fullName: string) {
  const admin = createAdminClient()
  const { data: existing, error } = await admin
    .from('employees')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (existing) return existing

  // Auto-provision if not present
  const dgmEmail = process.env.DGM_EMAIL?.toLowerCase() ?? 'dgm@efae.com'
  const isDGM = email.toLowerCase() === dgmEmail
  
  const { data: newEmp, error: createError } = await admin
    .from('employees')
    .insert({
      id: userId,
      full_name: fullName || email.split('@')[0],
      email: email,
      role: isDGM ? 'dgm' : 'engineer',
      department: 'Procurement and Contract Administration'
    })
    .select()
    .single()

  if (createError) {
    throw new Error('Failed to auto-provision employee: ' + createError.message)
  }
  return newEmp
}

// GET /api/daily-work-logs
// Query params: start_date, end_date, employee_id (optional, for admin/dgm viewing specific logs)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const currentEmp = await getOrCreateEmployee(
      user.id,
      user.email,
      user.user_metadata?.full_name ?? ''
    )

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const targetEmployeeId = searchParams.get('employee_id')
    const pendingOnly = searchParams.get('pending') === 'true'

    const admin = createAdminClient()
    let query

    if (pendingOnly) {
      if (currentEmp.role !== 'admin' && currentEmp.role !== 'dgm') {
        return NextResponse.json({ error: 'Permission denied.' }, { status: 403 })
      }
      query = admin
        .from('daily_work_logs')
        .select('*, employees(full_name, email, department, role)')
        .eq('approval_status', 'Pending')
        .order('log_date', { ascending: false })
    } else {
      let queryEmployeeId = currentEmp.id

      // If targetEmployeeId is specified, check if current user is admin/dgm
      if (targetEmployeeId && targetEmployeeId !== currentEmp.id) {
        if (currentEmp.role !== 'admin' && currentEmp.role !== 'dgm') {
          return NextResponse.json({ error: 'Permission denied.' }, { status: 403 })
        }
        queryEmployeeId = targetEmployeeId
      }

      query = admin
        .from('daily_work_logs')
        .select('*, employees(full_name, email, department, role)')
        .eq('employee_id', queryEmployeeId)
        .order('log_date', { ascending: true })

      if (startDate) {
        query = query.gte('log_date', startDate)
      }
      if (endDate) {
        query = query.lte('log_date', endDate)
      }
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('[daily-work-logs] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to retrieve logs.' }, { status: 500 })
    }

    return NextResponse.json({ logs: logs ?? [] })
  } catch (err) {
    console.error('[daily-work-logs] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// POST /api/daily-work-logs
// Body: Array of log rows to upsert
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const currentEmp = await getOrCreateEmployee(
      user.id,
      user.email,
      user.user_metadata?.full_name ?? ''
    )

    const body = await request.json()
    const logs = Array.isArray(body) ? body : [body]

    if (logs.length === 0) {
      return NextResponse.json({ error: 'No logs provided.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Validate and prepare log records
    const recordsToUpsert = []
    
    for (const log of logs) {
      // If updating an existing log, check if it's already approved (can't edit approved logs)
      if (log.id) {
        const { data: existingLog } = await admin
          .from('daily_work_logs')
          .select('approval_status, employee_id')
          .eq('id', log.id)
          .maybeSingle()

        if (existingLog) {
          if (existingLog.employee_id !== currentEmp.id && currentEmp.role !== 'admin' && currentEmp.role !== 'dgm') {
            return NextResponse.json({ error: 'Permission denied to edit this log.' }, { status: 403 })
          }
          if (existingLog.approval_status === 'Approved' && currentEmp.role === 'engineer') {
            return NextResponse.json({ error: 'Cannot edit logs that have already been approved.' }, { status: 400 })
          }
        }
      }

      // Check required text
      const assignedTasks = String(log.assigned_tasks ?? '').trim()
      const actualWorkDone = String(log.actual_work_done ?? '').trim()

      if (!assignedTasks || !actualWorkDone) {
        return NextResponse.json({ error: 'Required textual log details (Assigned Tasks and Actual Work Done) are incomplete.' }, { status: 400 })
      }

      const logDate = log.log_date
      if (!logDate) {
        return NextResponse.json({ error: 'log_date is required.' }, { status: 400 })
      }

      const hoursWorked = Number(log.hours_worked ?? 0)
      const actualWorkingHour = Number(log.actual_working_hour ?? 0)
      const completionPercentage = Number(log.completion_percentage ?? 0)

      // Construct row
      const record: Record<string, any> = {
        employee_id: log.employee_id || currentEmp.id, // For engineers, force their own id. For admins/dgm editing, preserve selected employee.
        log_date: logDate,
        assigned_tasks: assignedTasks,
        actual_work_done: actualWorkDone,
        hours_worked: hoursWorked,
        actual_working_hour: actualWorkingHour,
        completion_percentage: completionPercentage > 1 ? completionPercentage / 100 : completionPercentage, // handle decimals vs percent representation
        done_at_home: !!log.done_at_home,
        remark: log.remark ? String(log.remark).trim() : null,
        office_entrance_time: log.office_entrance_time || null,
        office_leave_time: log.office_leave_time || null,
      }

      if (log.id) {
        record.id = log.id
      }

      // If head is reviewing, allow setting approval_status and head_comments
      if (currentEmp.role === 'admin' || currentEmp.role === 'dgm') {
        if (log.approval_status) {
          record.approval_status = log.approval_status
        }
        if (log.head_comments !== undefined) {
          record.head_comments = log.head_comments ? String(log.head_comments).trim() : null
        }
      } else {
        // Reset approval status to Pending if edited by engineer (unless it was already Returned)
        record.approval_status = 'Pending'
      }

      recordsToUpsert.push(record)
    }

    const { data: upsertedData, error: upsertError } = await admin
      .from('daily_work_logs')
      .upsert(recordsToUpsert)
      .select()

    if (upsertError) {
      console.error('[daily-work-logs] POST error:', upsertError.message)
      return NextResponse.json({ error: 'Failed to save logs: ' + upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: upsertedData?.length ?? 0, logs: upsertedData })
  } catch (err) {
    console.error('[daily-work-logs] POST unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
