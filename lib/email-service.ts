import nodemailer from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import { Resend } from 'resend'
import { bondSubmissionEmailHtml, eotSubmissionEmailHtml } from '@/lib/email'

interface EmailConfig {
  to: string[]
  subject: string
  html: string
  from?: string
}

export async function sendNotificationEmail(config: EmailConfig): Promise<boolean> {
  try {
    // Try SMTP first (preferred)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      const smtpPort = parseInt(process.env.SMTP_PORT || '587')
      const smtpOptions: SMTPTransport.Options = {
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: smtpPort === 465, // true for port 465 (SSL), false for 587 (TLS)
        // @ts-ignore: family is valid nodemailer option, missing from type defs
        family: 4, // Force IPv4 to avoid ENETUNREACH on IPv6-only resolutions
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      }
      const transporter = nodemailer.createTransport(smtpOptions)

      await transporter.sendMail({
        from: config.from || `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: config.to.join(', '),
        subject: config.subject,
        html: config.html,
      })

      console.log(`[email-service] SMTP email sent successfully to: ${config.to.join(', ')}`)
      return true
    }

    // Fallback to Resend
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      await resend.emails.send({
        from: config.from || process.env.REMINDER_FROM || 'EF Report Portal <noreply@efae.com>',
        to: config.to,
        subject: config.subject,
        html: config.html,
      })

      console.log(`[email-service] Resend email sent successfully to: ${config.to.join(', ')}`)
      return true
    }

    console.log('[email-service] No email service configured, skipping notification')
    return false
  } catch (error) {
    console.error('[email-service] Failed to send email:', error)
    return false
  }
}

export async function sendBondNotification(params: {
  submitterName: string
  submitterEmail: string
  projectName: string
  contractorName: string
  bondType: string
  expiryDate: string
  status: string
  amount?: string
  recipients?: string[]
}) {
  const { recipients = [], ...emailParams } = params
  
  // Default recipients - can be overridden
  const defaultRecipients = [
    process.env.DGM_EMAIL,
    ...process.env.REMINDER_RECIPIENTS?.split(',').map(email => email.trim()) || []
  ].filter(Boolean) as string[]

  const emailConfig: EmailConfig = {
    to: recipients.length > 0 ? recipients : defaultRecipients,
    subject: `New Project Bond Logged - ${params.projectName}`,
    html: bondSubmissionEmailHtml(emailParams),
  }

  return await sendNotificationEmail(emailConfig)
}

export async function sendEOTNotification(params: {
  submitterName: string
  submitterEmail: string
  projectName: string
  contractorName: string
  claimNumber: string
  daysApproved: string
  revisedDate: string
  status: string
  reason: string
  recipients?: string[]
}) {
  const { recipients = [], ...emailParams } = params
  
  // Default recipients - can be overridden
  const defaultRecipients = [
    process.env.DGM_EMAIL,
    ...process.env.REMINDER_RECIPIENTS?.split(',').map(email => email.trim()) || []
  ].filter(Boolean) as string[]

  const emailConfig: EmailConfig = {
    to: recipients.length > 0 ? recipients : defaultRecipients,
    subject: `New EOT Extension Logged - ${params.projectName}`,
    html: eotSubmissionEmailHtml(emailParams),
  }

  return await sendNotificationEmail(emailConfig)
}