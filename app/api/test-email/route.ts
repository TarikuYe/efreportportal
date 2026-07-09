import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBondNotification, sendEOTNotification } from '@/lib/email-service'

export const runtime = 'nodejs'

function isDGM(email: string) {
  return email.toLowerCase() === process.env.DGM_EMAIL?.toLowerCase()
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    // Only allow DGM to test email functionality
    if (!isDGM(user.email || '')) {
      return NextResponse.json({ error: 'DGM access required.' }, { status: 403 })
    }

    const { type, customEmail } = await request.json()

    if (type === 'bond') {
      // Test both with and without custom email
      const recipients = customEmail ? [customEmail] : [user.email || '']
      
      const success = await sendBondNotification({
        submitterName: 'Test User',
        submitterEmail: user.email || '',
        projectName: 'Test Project - Sample Building',
        contractorName: 'Test Contractor Ltd.',
        bondType: 'Performance Bond',
        expiryDate: '2024-12-31',
        status: 'Active',
        amount: '1,000,000',
        recipients: recipients
      })

      return NextResponse.json({ 
        success, 
        message: success ? `Bond test email sent successfully to: ${recipients.join(', ')}` : 'Email sending failed (check logs)',
        recipients: recipients
      })
    }

    if (type === 'eot') {
      // Test both with and without custom email
      const recipients = customEmail ? [customEmail] : [user.email || '']
      
      const success = await sendEOTNotification({
        submitterName: 'Test User',
        submitterEmail: user.email || '',
        projectName: 'Test Project - Sample Building',
        contractorName: 'Test Contractor Ltd.',
        claimNumber: 'EOT-001',
        daysApproved: '30',
        revisedDate: '2024-12-31',
        status: 'Approved',
        reason: 'Additional work required due to design changes and unforeseen site conditions.',
        recipients: recipients
      })

      return NextResponse.json({ 
        success, 
        message: success ? `EOT test email sent successfully to: ${recipients.join(', ')}` : 'Email sending failed (check logs)',
        recipients: recipients
      })
    }

    return NextResponse.json({ error: 'Invalid test type. Use "bond" or "eot". Optionally include "customEmail" field.' }, { status: 400 })
  } catch (error) {
    console.error('[test-email] Error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}