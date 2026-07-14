// POST /api/public/bond/[token]/submit
//
// Public endpoint — no auth required.
// Called by the contractor from the /notice/bond/[token] page.
//
// Accepts:
//   new_issue_date  — new bond issue date (ISO string, required)
//   new_expiry_date — renewed expiry date (ISO string, required)
//   renewal_note    — free-text message from contractor (optional)
//
// On success:
//   • Updates project_bonds: issue_date, expiry_date, status → Active
//   • Stamps renewal_note + renewal_submitted_at
//   • Resets cooldown columns so the next cron cycle can re-alert if needed
//   • Returns the updated bond summary

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!uuidRegex.test(token)) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
  }

  // Verify token is valid and not expired
  const admin = createAdminClient()
  const { data: existing, error: fetchError } = await admin
    .from('project_bonds')
    .select('id, project_name, contractor_name, token_expires_at')
    .eq('view_token', token)
    .gt('token_expires_at', new Date().toISOString())
    .maybeSingle()

  if (fetchError) {
    console.error('[public/bond/submit] DB fetch error:', fetchError.message)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 })
  }

  // Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const newIssueDate  = body.new_issue_date  ? String(body.new_issue_date).trim()  : null
  const newExpiryDate = body.new_expiry_date ? String(body.new_expiry_date).trim() : null
  const renewalNote   = body.renewal_note    ? String(body.renewal_note).trim()    : null

  if (!newExpiryDate) {
    return NextResponse.json({ error: 'new_expiry_date is required.' }, { status: 400 })
  }

  // Validate the new expiry is in the future
  if (new Date(newExpiryDate) <= new Date()) {
    return NextResponse.json(
      { error: 'New expiry date must be in the future.' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()

  const { data: updated, error: updateError } = await admin
    .from('project_bonds')
    .update({
      ...(newIssueDate ? { issue_date: newIssueDate } : {}),
      expiry_date:              newExpiryDate,
      status:                   'Active',
      renewal_note:             renewalNote,
      renewal_submitted_at:     now,
      // Reset cooldown so cron re-evaluates with fresh dates
      notified_warning_threshold: 0,
      last_notified_at:           null,
      // Invalidate the token — one submission per link
      view_token:               null,
      token_expires_at:         null,
    })
    .eq('id', existing.id)
    .select('project_name, contractor_name, bond_type, expiry_date, status')
    .single()

  if (updateError) {
    console.error('[public/bond/submit] DB update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to save renewal.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, bond: updated })
}
