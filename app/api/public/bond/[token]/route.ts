// GET /api/public/bond/[token]
//
// Public endpoint — no authentication required.
// Returns only the single project_bonds row whose view_token matches
// AND whose token_expires_at has not passed.
//
// Security properties:
//   • UUID token space (2^122) — not guessable by enumeration
//   • Token expires after 7 days — old links go dead automatically
//   • Only safe display fields are returned — no internal IDs, emails, etc.
//   • Rate-limited by Vercel edge (no extra middleware needed for MVP)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  // Basic UUID format guard — reject obviously malformed tokens immediately
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(token)) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('project_bonds')
    .select(
      'employer_name, project_name, contractor_name, bond_type, ' +
      'issue_date, expiry_date, amount, status, ' +
      'token_expires_at',
    )
    .eq('view_token', token)
    .gt('token_expires_at', new Date().toISOString()) // not yet expired
    .maybeSingle()

  if (error) {
    console.error('[public/bond] DB error:', error.message)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }

  if (!data) {
    // Intentionally vague — don't reveal whether token was valid but expired
    return NextResponse.json(
      { error: 'This link is invalid or has expired.' },
      { status: 404 },
    )
  }

  // Strip internal-only field before returning
  const { token_expires_at, ...safe } = data
  return NextResponse.json({ bond: safe })
}
