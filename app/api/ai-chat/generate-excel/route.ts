/**
 * POST /api/ai-chat/generate-excel
 * Accepts AI-structured spreadsheet data and returns a professional .xlsx file.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateExcel,
  buildExcelOptionsFromAiData,
  type AiSpreadsheetData,
} from '@/lib/ai/excel-generator'
import { checkRateLimit } from '@/lib/ai/rate-limiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate limiting ──────────────────────────────────────────────────────
    const rateLimitResult = checkRateLimit(`excel:${user.id}`)
    if (!rateLimitResult.allowed) {
      const resetSec = Math.ceil(rateLimitResult.resetInMs / 1000)
      return NextResponse.json(
        { error: `Too many requests. Wait ${resetSec}s.`, code: 'rate_limited' },
        { status: 429 }
      )
    }

    // ── Parse body ─────────────────────────────────────────────────────────
    const body = await request.json()
    const aiData = body.data as AiSpreadsheetData | undefined

    if (!aiData || !aiData.sheets || !Array.isArray(aiData.sheets)) {
      return NextResponse.json(
        { error: 'Invalid spreadsheet data. Expected { title, sheets: [...] }' },
        { status: 400 }
      )
    }

    // Validate minimum structure
    for (const sheet of aiData.sheets) {
      if (!sheet.name || !Array.isArray(sheet.headers) || !Array.isArray(sheet.rows)) {
        return NextResponse.json(
          { error: 'Each sheet must have: name, headers[], rows[][]' },
          { status: 400 }
        )
      }
    }

    // ── Generate Excel ─────────────────────────────────────────────────────
    const options = buildExcelOptionsFromAiData(aiData)
    const buffer = await generateExcel(options)

    // ── Sanitize filename ──────────────────────────────────────────────────
    const rawTitle = aiData.title ?? 'AI_Spreadsheet'
    const safeFilename =
      rawTitle
        .replace(/[^a-zA-Z0-9\s\-_]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 60) + '.xlsx'

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[ai-chat/generate-excel] Error:', err)
    return NextResponse.json(
      {
        error: 'Failed to generate Excel file.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
