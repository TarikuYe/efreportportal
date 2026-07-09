import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/email-service'
import { bondAlertEmailHtml, eotAlertEmailHtml } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkAdminAccess(userId: string) {
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return employee?.role === 'dgm' || employee?.role === 'admin'
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const hasAccess = await checkAdminAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })
    }

    const body = await request.json()
    const { type, recipient, subject, message, item } = body

    if (!type || !recipient || !subject || !message || !item) {
      return NextResponse.json({ error: 'Missing required fields (type, recipient, subject, message, item).' }, { status: 400 })
    }

    let html = ''
    if (type === 'bond') {
      html = bondAlertEmailHtml({
        projectName: item.project_name,
        contractorName: item.contractor_name,
        employerName: item.employer_name,
        bondType: item.bond_type,
        expiryDate: item.expiry_date,
        amount: item.amount ? Number(item.amount).toLocaleString() + ' ETB' : undefined,
        daysOverdue: Number(item.days_overdue || 0),
        message: message
      })
    } else if (type === 'eot') {
      html = eotAlertEmailHtml({
        projectName: item.project_name,
        contractorName: item.contractor_name,
        revisedDate: item.revised_completion_date,
        daysApproved: String(item.days_approved || 0),
        claimNumber: String(item.eot_number || 1),
        daysRemaining: Number(item.days_remaining || 0),
        message: message
      })
    } else {
      return NextResponse.json({ error: 'Invalid alert type. Must be "bond" or "eot".' }, { status: 400 })
    }

    const emailSent = await sendNotificationEmail({
      to: [recipient],
      subject: subject,
      html: html
    })

    if (!emailSent) {
      return NextResponse.json({ error: 'Failed to dispatch email. Check SMTP/Resend configurations.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[send-alert-email] POST error:', err)
    return NextResponse.json({ error: err.message || 'Unexpected server error.' }, { status: 500 })
  }
}
