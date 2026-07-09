import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, REPORTS_BUCKET } from '@/lib/supabase/admin'
import type { SubmissionStatus } from '@/lib/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Authenticate the user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    const project = searchParams.get('project')
    const emailFilter = searchParams.get('email') // For employee filtering their own submissions

    const isDGM =
      user.email.toLowerCase() === process.env.DGM_EMAIL?.toLowerCase()

    const admin = createAdminClient()
    let query = admin
      .from('report_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })

    // Employees can only see their own submissions
    if (!isDGM) {
      query = query.eq('employee_email', user.email)
    } else if (emailFilter) {
      // DGM can filter by specific employee email
      query = query.eq('employee_email', emailFilter)
    }

    if (period) query = query.eq('reporting_period', period)
    if (project) query = query.eq('project_code', project)

    const { data, error } = await query
    if (error) {
      console.log('[v0] list error:', error.message)
      return NextResponse.json({ error: 'Failed to load submissions.' }, { status: 500 })
    }

    // Attach short-lived signed download URLs.
    const withUrls = await Promise.all(
      (data ?? []).map(async (row) => {
        const { data: signed } = await admin.storage
          .from(REPORTS_BUCKET)
          .createSignedUrl(row.file_path, 60 * 10)
        return { ...row, download_url: signed?.signedUrl ?? null }
      }),
    )

    return NextResponse.json({ submissions: withUrls })
  } catch (err) {
    console.log('[v0] submissions GET error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    // Authenticate the user — only DGM can update statuses
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const isDGM =
      user.email.toLowerCase() === process.env.DGM_EMAIL?.toLowerCase()
    if (!isDGM) {
      return NextResponse.json({ error: 'Only the DGM can update submission statuses.' }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body.id ?? '')
    const status = String(body.status ?? '') as SubmissionStatus
    const valid: SubmissionStatus[] = ['submitted', 'under_review', 'approved', 'revisions']

    if (!id || !valid.includes(status)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('report_submissions')
      .update({ status })
      .eq('id', id)

    if (error) {
      console.log('[v0] status update error:', error.message)
      return NextResponse.json({ error: 'Failed to update status.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.log('[v0] submissions PATCH error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
