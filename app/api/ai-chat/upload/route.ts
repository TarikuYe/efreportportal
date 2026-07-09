/**
 * POST /api/ai-chat/upload
 * Accepts a multipart/form-data file upload + prompt.
 * Parses the file, sends content to AI, streams back the response.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseFile, validateFile } from '@/lib/ai/file-parser'
import { checkRateLimit } from '@/lib/ai/rate-limiter'
import { OllamaApiError, OllamaConfigError } from '@/lib/ai/ollama-service'

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
    const rateLimitResult = checkRateLimit(`upload:${user.id}`)
    if (!rateLimitResult.allowed) {
      const resetSec = Math.ceil(rateLimitResult.resetInMs / 1000)
      return NextResponse.json(
        { error: `Too many uploads. Wait ${resetSec}s.`, code: 'rate_limited' },
        { status: 429 }
      )
    }

    // ── Parse multipart form ───────────────────────────────────────────────
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const prompt = (formData.get('prompt') as string | null) ?? ''
    const historyRaw = (formData.get('history') as string | null) ?? '[]'

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    // ── Validate file ──────────────────────────────────────────────────────
    const validation = validateFile(file.name, file.size)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // ── Parse conversation history ─────────────────────────────────────────
    let history: { role: 'user' | 'assistant'; content: string }[] = []
    try {
      history = JSON.parse(historyRaw)
    } catch {
      history = []
    }

    // ── Parse file content ─────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let parsed
    try {
      parsed = await parseFile(buffer, file.name, file.type)
    } catch (parseErr: unknown) {
      const msg = parseErr instanceof Error ? parseErr.message : 'Failed to parse file.'
      return NextResponse.json({ error: msg }, { status: 422 })
    }

    // ── Stream AI analysis ─────────────────────────────────────────────────
    const { analyzeFileContent } = await import('@/lib/ai/ollama-service')

    const { stream } = await analyzeFileContent(parsed, prompt, history).catch(
      (err: unknown) => {
        throw err
      }
    )

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = ''

          for await (const chunk of stream) {
            fullText += chunk
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`)
            )
          }

          // Send completion with file metadata
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                fullText,
                fileMeta: {
                  name: file.name,
                  size: file.size,
                  rowCount: parsed.rowCount,
                  type: parsed.type,
                  headers: parsed.headers,
                },
              })}\n\n`
            )
          )
          controller.close()
        } catch (streamErr: unknown) {
          let message = 'Stream error.'
          let code = 'unknown'

          if (streamErr instanceof OllamaApiError) {
            code = streamErr.code
            message = streamErr.message
          } else if (streamErr instanceof OllamaConfigError) {
            code = 'config_error'
            message = streamErr.message
          } else if (streamErr instanceof Error) {
            message = streamErr.message
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message, code })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[ai-chat/upload] Error:', err)

    if (err instanceof OllamaApiError) {
      const status =
        err.code === 'connection_error' || err.code === 'model_not_found'
          ? 503
          : 400
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }

    if (err instanceof OllamaConfigError) {
      return NextResponse.json(
        { error: err.message, code: 'config_error' },
        { status: 500 }
      )
    }

    const message =
      err instanceof Error ? err.message : 'An unexpected server error occurred.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
