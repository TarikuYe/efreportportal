/**
 * POST /api/text-correction
 * Corrects employee report text (grammar, spelling, clarity) using Gemini.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ai/rate-limiter'
import {
  correctReportText,
  GeminiApiError,
  GeminiConfigError,
  type ReportTextField,
} from '@/lib/ai/gemini-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_FIELDS: ReportTextField[] = ['assigned_tasks', 'actual_work_done', 'remark']

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResult = checkRateLimit(`text-correction:${user.id}`)
    if (!rateLimitResult.allowed) {
      const resetSec = Math.ceil(rateLimitResult.resetInMs / 1000)
      return NextResponse.json(
        { error: `Too many requests. Wait ${resetSec}s.`, code: 'rate_limited' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const text = String(body.text ?? '')
    const field = body.field as ReportTextField

    if (!VALID_FIELDS.includes(field)) {
      return NextResponse.json(
        { error: `Invalid field. Must be one of: ${VALID_FIELDS.join(', ')}` },
        { status: 400 }
      )
    }

    const corrected = await correctReportText(text, field)

    return NextResponse.json({ corrected })
  } catch (err) {
    console.error('[text-correction] Error:', err)

    if (err instanceof GeminiApiError) {
      const status =
        err.isQuotaError || err.isRateLimitError
          ? 429
          : err.code === 'invalid_api_key'
            ? 401
            : err.code === 'empty_text'
              ? 400
              : 400
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }

    if (err instanceof GeminiConfigError) {
      return NextResponse.json(
        { error: err.message, code: 'config_error' },
        { status: 500 }
      )
    }

    const message = err instanceof Error ? err.message : 'An unexpected server error occurred.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
