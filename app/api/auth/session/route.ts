import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/auth/session
 * Returns the currently authenticated user's session info.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 200 })
  } catch (err) {
    console.error('[session] error:', err)
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
