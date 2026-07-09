import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEOTNotification } from '@/lib/email-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdminOrDgm(userId: string) {
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return employee?.role === 'admin' || employee?.role === 'dgm'
}

// GET /api/eot
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: eots, error } = await admin
      .from('eot_tracker')
      .select('*')
      .order('revised_completion_date', { ascending: true })

    if (error) {
      console.error('[eot] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to retrieve EOT tracker.' }, { status: 500 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const processedEots = (eots ?? []).map(eot => {
      const compDate = new Date(eot.revised_completion_date)
      compDate.setHours(0, 0, 0, 0)
      
      const diffTime = compDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      let alert = 'OK'
      if (daysRemaining <= 0) {
        alert = 'Expired'
      } else if (daysRemaining <= 30) {
        alert = 'Nearly Expired'
      }
      
      return {
        ...eot,
        eot_status_alert: alert,
        days_remaining: daysRemaining
      }
    })

    return NextResponse.json({ eots: processedEots })
  } catch (err) {
    console.error('[eot] GET unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// POST /api/eot
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
    const clientName = String(body.client_name ?? '').trim()
    const projectName = String(body.project_name ?? '').trim()
    const contractorName = String(body.contractor_name ?? '').trim()
    const eotNumber = Number(body.eot_number ?? 1)
    const daysApproved = Number(body.days_approved ?? 0)
    const revisedCompletionDate = body.revised_completion_date
    const status = body.status || 'Pending'
    const reasonForEot = String(body.reason_for_eot ?? '').trim()
    const assignedManagerEmail = body.assigned_manager_email ? String(body.assigned_manager_email).trim() : ''

    if (!clientName || !projectName || !contractorName || !revisedCompletionDate || !reasonForEot) {
      return NextResponse.json({ error: 'Missing required EOT fields.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('eot_tracker')
      .insert({
        client_name: clientName,
        project_name: projectName,
        contractor_name: contractorName,
        eot_number: eotNumber,
        days_approved: daysApproved,
        revised_completion_date: revisedCompletionDate,
        status,
        reason_for_eot: reasonForEot,
        assigned_manager_email: assignedManagerEmail || 'team@efae.com',
        eot_status_alert: 'OK' // calculated dynamically on fetch
      })
      .select()
      .single()

    if (error) {
      console.error('[eot] POST error:', error.message)
      return NextResponse.json({ error: 'Failed to create EOT record: ' + error.message }, { status: 500 })
    }

    // Send email notification
    try {
      const recipients: string[] = []
      
      // Use the stored assigned manager email - always send to this email
      const storedEmail = data.assigned_manager_email
      if (storedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storedEmail)) {
        recipients.push(storedEmail)
      }
      
      if (recipients.length > 0) {
        await sendEOTNotification({
          submitterName: user.email || 'System User',
          submitterEmail: user.email || '',
          projectName: projectName,
          contractorName: contractorName,
          claimNumber: eotNumber.toString(),
          daysApproved: daysApproved.toString(),
          revisedDate: revisedCompletionDate,
          status: status,
          reason: reasonForEot,
          recipients: recipients
        })
      }
    } catch (emailError) {
      console.error('[eot] Email notification failed:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ success: true, eot: data })
  } catch (err) {
    console.error('[eot] POST unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

// PATCH /api/eot
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
      return NextResponse.json({ error: 'EOT record id is required.' }, { status: 400 })
    }

    const cleanUpdates: Record<string, any> = {}
    if (updates.client_name !== undefined) cleanUpdates.client_name = String(updates.client_name).trim()
    if (updates.project_name !== undefined) cleanUpdates.project_name = String(updates.project_name).trim()
    if (updates.contractor_name !== undefined) cleanUpdates.contractor_name = String(updates.contractor_name).trim()
    if (updates.eot_number !== undefined) cleanUpdates.eot_number = Number(updates.eot_number)
    if (updates.days_approved !== undefined) cleanUpdates.days_approved = Number(updates.days_approved)
    if (updates.revised_completion_date !== undefined) cleanUpdates.revised_completion_date = updates.revised_completion_date
    if (updates.status !== undefined) cleanUpdates.status = updates.status
    if (updates.reason_for_eot !== undefined) cleanUpdates.reason_for_eot = String(updates.reason_for_eot).trim()
    if (updates.assigned_manager_email !== undefined) cleanUpdates.assigned_manager_email = updates.assigned_manager_email ? String(updates.assigned_manager_email).trim() : 'team@efae.com'

    if (Object.keys(cleanUpdates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('eot_tracker')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[eot] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update EOT: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, eot: data })
  } catch (err) {
    console.error('[eot] PATCH unexpected:', err)
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
