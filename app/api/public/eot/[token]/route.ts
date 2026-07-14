// GET /api/public/eot/[token]
//
// Public endpoint — no authentication required.
// Returns only the single eot_tracker row whose view_token matches
// AND whose token_expires_at has not passed.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(token)) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('eot_tracker')
    .select(
      'client_name, project_name, contractor_name, eot_number, ' +
      'days_approved, revised_completion_date, status, reason_for_eot, ' +
      'token_expires_at',
    )
    .eq('view_token', token)
    .gt('token_expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) {
    console.error('[public/eot] DB error:', error.message)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(
      { error: 'This link is invalid or has expired.' },
      { status: 404 },
    )
  }

  const { token_expires_at, ...safe } = data
  return NextResponse.json({ eot: safe })
}
