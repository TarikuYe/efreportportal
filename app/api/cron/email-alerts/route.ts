// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cron/email-alerts
//
// Vercel Cron Job controller — runs daily at 08:00 AM Addis Ababa time
// (05:00 UTC, configured in vercel.json).
//
// Responsibilities:
//   1. Validate the Vercel cron secret (Authorization: Bearer <CRON_SECRET>).
//   2. Delegate scanning + dispatch to runAlertScan() in lib/alert-scanner.ts.
//   3. Return a structured JSON summary and write diagnostics to system_cron_logs.
//
// Security model:
//   - Protected by CRON_SECRET bearer token. Vercel injects this header
//     automatically when invoking cron routes; manual calls without the correct
//     secret receive a 401 with no information leakage.
//   - Uses the Supabase service-role client (bypasses RLS) inside the scanner.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { runAlertScan }              from '@/lib/alert-scanner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel enforces a 60-second max duration for cron functions on Pro plans.
// Set to 60 so the runtime doesn't cut us off mid-scan on large datasets.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // ── 1. Route protection ──────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('Authorization')

  if (!cronSecret) {
    // CRON_SECRET not configured — fail closed to prevent open execution
    console.error('[cron/email-alerts] CRON_SECRET env var is not set.')
    return NextResponse.json(
      { error: 'Cron secret not configured on this deployment.' },
      { status: 500 },
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cron/email-alerts] Unauthorized request — invalid or missing bearer token.')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // ── 2. Run the full scan + dispatch cycle ────────────────────────────────
  const startedAt = Date.now()
  console.log(`[cron/email-alerts] Cron run started at ${new Date().toISOString()}`)

  try {
    const result = await runAlertScan()

    const durationMs = Date.now() - startedAt
    const statusLabel =
      result.errorsCount > 0 && result.totalSent === 0
        ? 'ERROR'
        : result.errorsCount > 0
        ? 'PARTIAL'
        : 'SUCCESS'

    // ── 3. Structured console summary (visible in Vercel Function logs) ──
    console.log(
      `[cron/email-alerts] Run ${statusLabel} in ${durationMs}ms — ` +
      `${result.bondsSent} Bond email(s) sent, ` +
      `${result.eotsSent} EOT email(s) sent, ` +
      `${result.errorsCount} error(s).`,
    )

    if (result.detail) {
      // Log each per-record line individually for clean Vercel log streaming
      result.detail.split('\n').forEach(line => {
        if (line.trim()) console.log(line)
      })
    }

    // ── 4. HTTP response ──────────────────────────────────────────────────
    return NextResponse.json({
      status:      statusLabel,
      bondsSent:   result.bondsSent,
      eotsSent:    result.eotsSent,
      totalSent:   result.totalSent,
      errorsCount: result.errorsCount,
      durationMs,
      executedAt:  new Date().toISOString(),
    })
  } catch (err: any) {
    // Unexpected top-level failure — scanner itself threw
    const durationMs = Date.now() - startedAt
    console.error(`[cron/email-alerts] Fatal error after ${durationMs}ms:`, err)

    return NextResponse.json(
      {
        status:     'ERROR',
        error:      err?.message ?? 'Unexpected server error',
        durationMs,
        executedAt: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
