// POST /api/public/eot/[token]/progress
//
// Public endpoint — no auth required.
// Called by the department head from the /notice/eot/[token] page.
//
// Accepts:
//   progress_note — site progress update text (required)
//
// On success:
//   • Updates eot_tracker: progress_note + progress_updated_at
//   • Does NOT invalidate the token — multiple updates are allowed
//   • Returns the updated EOT summary

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
    .from('eot_tracker')
    .select('id, project_name, contractor_name, token_expires_at')
    .eq('view_token', token)
    .gt('token_expires_at', new Date().toISOString())
    .maybeSingle()

  if (fetchError) {
    console.error('[public/eot/progress] DB fetch error:', fetchError.message)
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

  const progressNote = body.progress_note ? String(body.progress_note).trim() : ''

  if (!progressNote) {
    return NextResponse.json({ error: 'progress_note is required.' }, { status: 400 })
  }

  if (progressNote.length > 1000) {
    return NextResponse.json(
      { error: 'Progress note must be 1000 characters or fewer.' },
      { status: 400 },
    )
  }

  const { data: updated, error: updateError } = await admin
    .from('eot_tracker')
    .update({
      progress_note:       progressNote,
      progress_updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('project_name, contractor_name, revised_completion_date, status, progress_note, progress_updated_at')
    .single()

  if (updateError) {
    console.error('[public/eot/progress] DB update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to save progress note.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, eot: updated })
}
