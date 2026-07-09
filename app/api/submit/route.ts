import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, REPORTS_BUCKET } from '@/lib/supabase/admin'
import { MAX_FILE_BYTES } from '@/lib/reports'

export const runtime = 'nodejs'

function sanitize(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const formData = await request.formData()

    const employeeName = String(formData.get('employee_name') ?? '').trim()
    const employeeEmail = String(formData.get('employee_email') ?? '').trim()
    const projectCode = String(formData.get('project_code') ?? '').trim()
    const reportingPeriod = String(formData.get('reporting_period') ?? '').trim()
    const file = formData.get('file')

    // Validation
    if (!employeeName || !employeeEmail || !projectCode || !reportingPeriod) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail)
    if (!emailOk) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    // Ensure the submission email matches the authenticated user's email
    if (employeeEmail.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Submission email must match your verified account email.' },
        { status: 403 },
      )
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Please attach a report file.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 25 MB limit.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
    const filePath = `${reportingPeriod}/${projectCode}/${Date.now()}-${sanitize(
      employeeName,
    )}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from(REPORTS_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.log('[v0] storage upload error:', uploadError.message)
      return NextResponse.json({ error: 'Failed to upload file. Please try again.' }, { status: 500 })
    }

    const { data, error: insertError } = await supabase
      .from('report_submissions')
      .insert({
        employee_name: employeeName,
        employee_email: employeeEmail,
        project_code: projectCode,
        reporting_period: reportingPeriod,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type || null,
        status: 'submitted',
      })
      .select()
      .single()

    if (insertError) {
      console.log('[v0] insert error:', insertError.message)
      return NextResponse.json({ error: 'Failed to record submission.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, submission: data }, { status: 201 })
  } catch (err) {
    console.log('[v0] submit route error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
