import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import nodemailer from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import { Resend } from 'resend'
import { getReportingPeriods } from '@/lib/reports'
import { reminderEmailHtml } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDGM(email: string) {
  return email.toLowerCase() === process.env.DGM_EMAIL?.toLowerCase()
}

async function handle(request: Request) {
  try {
    // 1. Authorization: Allow if Bearer <cronSecret> OR if authenticated as DGM admin
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    
    let isAuthorized = false
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true
    } else {
      // Check Supabase session
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email && isDGM(user.email)) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [current] = getReportingPeriods(1)
    const origin = new URL(request.url).origin
    const portalUrl = origin

    // Due date: 5th of next month.
    const now = new Date()
    const due = new Date(now.getFullYear(), now.getMonth() + 1, 5)
    const dueDateLabel = due.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    const admin = createAdminClient()

    // 2. Fetch all active employees
    const { data: profiles, error: profileError } = await admin
      .from('employee_profiles')
      .select('email, full_name')
      .eq('active', true)

    if (profileError) {
      console.log('[send-reminders] failed to load profiles:', profileError.message)
    }

    // 3. Fetch submissions for the current period
    const { data: submissions, error: subError } = await admin
      .from('report_submissions')
      .select('employee_email')
      .eq('reporting_period', current.value)

    if (subError) {
      console.log('[send-reminders] failed to load submissions:', subError.message)
    }

    // 4. Calculate who hasn't submitted yet
    const submittedEmails = new Set(
      (submissions ?? []).map((s: { employee_email: string }) => s.employee_email.toLowerCase())
    )

    let pendingEmployees = (profiles ?? [])
      .filter((p: { email: string; full_name: string }) => !submittedEmails.has(p.email.toLowerCase()))
      .map((p: { email: string; full_name: string }) => ({
        email: p.email,
        name: p.full_name,
      }))

    // If no active employees found in DB, fallback to REMINDER_RECIPIENTS from env for safety/testing
    if (pendingEmployees.length === 0) {
      const fallbackRecipients = (process.env.REMINDER_RECIPIENTS ?? '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)

      pendingEmployees = fallbackRecipients.map((email) => ({
        email,
        name: email.split('@')[0], // simple fallback name
      }))
    }

    if (pendingEmployees.length === 0) {
      return NextResponse.json({
        sent: false,
        reason: 'All active employees have already submitted their reports.',
        period: current.label,
      })
    }

    // 5. Choose Sender (Prefer SMTP/Nodemailer if configured, fallback to Resend)
    const useSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
    const successEmails: string[] = []
    const failedEmails: { email: string; error: string }[] = []

    if (useSmtp) {
      console.log('[send-reminders] Using SMTP (Nodemailer) for delivery')
      
      const smtpOptions: SMTPTransport.Options = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        // @ts-ignore: family is valid nodemailer option, missing from type defs
        family: 4, // Force IPv4 to avoid ENETUNREACH on IPv6-only resolutions
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      }
      const transporter = nodemailer.createTransport(smtpOptions)

      const fromAddress = `"${process.env.SMTP_FROM_NAME || 'EF Architect and Engineering'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`

      for (const emp of pendingEmployees) {
        const html = reminderEmailHtml({
          periodLabel: current.label,
          portalUrl,
          dueDateLabel,
          employeeName: emp.name,
        })

        try {
          await transporter.sendMail({
            from: fromAddress,
            to: emp.email,
            subject: `[EF A&E] Report Submission Reminder - ${current.label}`,
            html,
          })
          successEmails.push(emp.email)
        } catch (sendError: any) {
          console.error(`[send-reminders] SMTP error for ${emp.email}:`, sendError.message || sendError)
          failedEmails.push({ email: emp.email, error: sendError.message || String(sendError) })
        }
      }
    } else {
      // Fallback to Resend
      const apiKey = process.env.RESEND_API_KEY
      const from = process.env.REMINDER_FROM ?? 'EF Report Portal <onboarding@resend.dev>'

      if (!apiKey) {
        console.log(
          `[send-reminders] Neither SMTP nor Resend is configured - would send reminder to:`,
          pendingEmployees.map(p => `${p.name} <${p.email}>`)
        )
        return NextResponse.json({
          sent: false,
          reason: 'No email service (SMTP or Resend) is configured',
          period: current.label,
          recipients: pendingEmployees,
        })
      }

      console.log('[send-reminders] Using Resend for delivery')
      const resend = new Resend(apiKey)

      for (const emp of pendingEmployees) {
        const html = reminderEmailHtml({
          periodLabel: current.label,
          portalUrl,
          dueDateLabel,
          employeeName: emp.name,
        })

        const { data: sendData, error: sendError } = await resend.emails.send({
          from,
          to: [emp.email],
          subject: `[EF A&E] Report Submission Reminder - ${current.label}`,
          html,
        })

        if (sendError) {
          console.error(`[send-reminders] Resend error for ${emp.email}:`, sendError.message)
          failedEmails.push({ email: emp.email, error: sendError.message })
        } else {
          successEmails.push(emp.email)
        }
      }
    }

    return NextResponse.json({
      sent: successEmails.length > 0,
      method: useSmtp ? 'SMTP' : 'Resend',
      period: current.label,
      sentCount: successEmails.length,
      successRecipients: successEmails,
      failedRecipients: failedEmails,
    })
  } catch (err) {
    console.error('[send-reminders] unexpected error:', err)
    return NextResponse.json(
      { error: 'Unexpected server error.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
