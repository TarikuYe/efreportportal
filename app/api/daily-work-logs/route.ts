import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getOrCreateEmployee(userId: string, email: string, fullName: string) {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('employees')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (existing) return existing

  const dgmEmail = process.env.DGM_EMAIL?.toLowerCase() ?? 'dgm@efae.com'
  const isDGM = email.toLowerCase() === dgmEmail

  const { data: newEmp, error: createError } = await admin
    .from('employees')
    .insert({
      id: userId,
      full_name: fullName || email.split('@')[0],
      email: email,
      role: isDGM ? 'dgm' : 'engineer',
      department: 'Procurement and Contract Administration',
    })
    .select()
    .single()

  if (createError) {
    throw new Error('Failed to auto-provision employee: ' + createError.message)
  }
  return newEmp
}

// ─── GET /api/daily-work-logs ─────────────────────────────────────────────────
// Returns logs joined with their latest review status.
// Query params: start_date, end_date, employee_id (admin/dgm only), pending=true
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const currentEmp = await getOrCreateEmployee(
      user.id,
      user.email,
      user.user_metadata?.full_name ?? '',
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
      // Fetch all logs with their reviews so we can filter to only those whose
      // latest review is NOT 'Approved'.  We do this in-process because Supabase
      // PostgREST does not support LATERAL / DISTINCT ON filtering directly.
      query = admin
        .from('daily_work_logs')
        .select(
          '*, employees(full_name, email, department, role), daily_work_log_reviews(approval_status, head_comments, reviewed_at)',
        )
        .order('log_date', { ascending: false })
    } else {
      let queryEmployeeId = currentEmp.id

      if (targetEmployeeId && targetEmployeeId !== currentEmp.id) {
        if (currentEmp.role !== 'admin' && currentEmp.role !== 'dgm') {
          return NextResponse.json({ error: 'Permission denied.' }, { status: 403 })
        }
        queryEmployeeId = targetEmployeeId
      }

      query = admin
        .from('daily_work_logs')
        .select(
          '*, employees(full_name, email, department, role), daily_work_log_reviews(approval_status, head_comments, reviewed_at, reviewed_by)',
        )
        .eq('employee_id', queryEmployeeId)
        .order('log_date', { ascending: true })

      if (startDate) query = query.gte('log_date', startDate)
      if (endDate) query = query.lte('log_date', endDate)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('[daily-work-logs] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to retrieve logs.' }, { status: 500 })
    }

    // Flatten the latest review onto each log so the client receives a familiar shape
    const enrichedLogs = (logs ?? []).map((log: any) => {
      const reviews: any[] = log.daily_work_log_reviews ?? []
      // Sort descending by reviewed_at and take the most recent
      const latestReview = reviews.sort(
        (a: any, b: any) =>
          new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime(),
      )[0]

      return {
        ...log,
        daily_work_log_reviews: undefined, // remove nested array from response
        approval_status: latestReview?.approval_status ?? 'Pending',
        head_comments: latestReview?.head_comments ?? null,
        reviewed_at: latestReview?.reviewed_at ?? null,
      }
    })

    // For the pending queue, only show logs whose latest review status is
    // 'Pending' (i.e. the DGM has not yet acted on them, OR the employee has
    // resubmitted a corrected version after a Return).
    //
    // 'Returned' rows are excluded — the DGM already processed them. They will
    // disappear from the queue and only reappear if the employee submits a new
    // corrected row (which will have status 'Pending' with no review record).
    // 'Approved' rows are excluded — nothing left to action.
    if (pendingOnly) {
      const queueLogs = enrichedLogs.filter(
        (log: any) => log.approval_status === 'Pending',
      )
      return NextResponse.json({ logs: queueLogs })
    }

    return NextResponse.json({ logs: enrichedLogs })
  } catch (err) {
    console.error('[daily-work-logs] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// ─── POST /api/daily-work-logs ────────────────────────────────────────────────
// IMMUTABILITY POLICY:
//   - INSERT is allowed for any authenticated employee (for their own employee_id).
//   - UPDATE / DELETE are PERMANENTLY BLOCKED for employees. Any attempt to send
//     a log with an existing numeric id is rejected at the API layer — before the
//     request ever reaches Supabase — with a clear 409 Locked response.
//   - Admins/DGM who need to record an approval decision must POST to
//     /api/daily-work-logs/review instead. They cannot mutate submitted rows either.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const currentEmp = await getOrCreateEmployee(
      user.id,
      user.email,
      user.user_metadata?.full_name ?? '',
    )

    const body = await request.json()
    const logs = Array.isArray(body) ? body : [body]

    if (logs.length === 0) {
      return NextResponse.json({ error: 'No logs provided.' }, { status: 400 })
    }

    // ── IMMUTABILITY GATE ────────────────────────────────────────────────────
    // If ANY row in the batch carries a numeric id (i.e. already exists in the
    // DB), the entire request is rejected. Employees may ONLY insert new rows.
    const hasExistingIds = logs.some((log) => log.id && typeof log.id === 'number')
    if (hasExistingIds) {
      return NextResponse.json(
        {
          error:
            'Submission Locked: Once a daily task log is saved it cannot be modified or deleted. ' +
            'Please contact your line manager if a correction is needed.',
          code: 'LOG_IMMUTABLE',
        },
        { status: 409 },
      )
    }

    const admin = createAdminClient()
    const recordsToInsert = []

    for (const log of logs) {
      // Validate required text fields
      const assignedTasks = String(log.assigned_tasks ?? '').trim()
      const actualWorkDone = String(log.actual_work_done ?? '').trim()

      if (!assignedTasks || !actualWorkDone) {
        return NextResponse.json(
          {
            error:
              'Required textual log details (Assigned Tasks and Actual Work Done) are incomplete.',
          },
          { status: 400 },
        )
      }

      const logDate = log.log_date
      if (!logDate) {
        return NextResponse.json({ error: 'log_date is required.' }, { status: 400 })
      }

      // ── DUPLICATE CHECK ──────────────────────────────────────────────────
      // An employee cannot insert a second log for the same date+task combo,
      // UNLESS this is a correction of a previously-returned row.  The client
      // passes `returned_log_id` (the original DB row id) when resubmitting a
      // returned entry — in that case we skip the duplicate guard entirely for
      // this date so the corrected content can be inserted as a new row.
      const returnedLogId: number | null =
        typeof log.returned_log_id === 'number' ? log.returned_log_id : null

      if (!returnedLogId) {
        const { data: existing } = await admin
          .from('daily_work_logs')
          .select('id')
          .eq('employee_id', currentEmp.id)
          .eq('log_date', logDate)
          .limit(1)

        // Only block if this specific log isn't a legitimate "split task" for same day.
        // We allow multiple rows per day (split tasks), but we flag if the content is
        // identical (exact text match) which is almost certainly a double-submit.
        if (existing && existing.length > 0) {
          const { data: duplicate } = await admin
            .from('daily_work_logs')
            .select('id')
            .eq('employee_id', currentEmp.id)
            .eq('log_date', logDate)
            .eq('assigned_tasks', assignedTasks)
            .eq('actual_work_done', actualWorkDone)
            .limit(1)

          if (duplicate && duplicate.length > 0) {
            return NextResponse.json(
              {
                error: `Duplicate log detected for ${logDate}. A log with identical task content already exists and cannot be overwritten.`,
                code: 'LOG_DUPLICATE',
              },
              { status: 409 },
            )
          }
        }
      }

      const completionPct = Number(log.completion_percentage ?? 0)

      recordsToInsert.push({
        // Always force the authenticated user's own employee_id — never allow spoofing
        employee_id: currentEmp.id,
        log_date: logDate,
        assigned_tasks: assignedTasks,
        actual_work_done: actualWorkDone,
        hours_worked: Number(log.hours_worked ?? 0),
        actual_working_hour: Number(log.actual_working_hour ?? 0),
        completion_percentage:
          completionPct > 1 ? completionPct / 100 : completionPct,
        done_at_home: !!log.done_at_home,
        remark: log.remark ? String(log.remark).trim() : null,
        office_entrance_time: log.office_entrance_time || null,
        office_leave_time: log.office_leave_time || null,
        // approval_status intentionally NOT set here — it starts as 'Pending'
        // and is managed exclusively via the /api/daily-work-logs/review route.
        // returned_log_id is a client-side hint only — never persisted.
      })
    }

    const { data: insertedData, error: insertError } = await admin
      .from('daily_work_logs')
      .insert(recordsToInsert)
      .select()

    if (insertError) {
      // Propagate DB-level trigger error messages clearly to the client
      const isLockError =
        insertError.code === '23001' ||
        insertError.message?.toLowerCase().includes('submission locked')
      console.error('[daily-work-logs] POST insert error:', insertError.message)
      return NextResponse.json(
        {
          error: isLockError
            ? 'Submission Locked: Once a daily task log is saved it cannot be modified or deleted.'
            : 'Failed to save logs: ' + insertError.message,
          code: isLockError ? 'LOG_IMMUTABLE' : 'DB_ERROR',
        },
        { status: isLockError ? 409 : 500 },
      )
    }

    return NextResponse.json({
      success: true,
      count: insertedData?.length ?? 0,
      logs: insertedData,
    })
  } catch (err) {
    console.error('[daily-work-logs] POST unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
