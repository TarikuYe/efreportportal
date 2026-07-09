/**
 * POST /api/ai-chat
 * Streaming AI chat endpoint. Accepts a conversation history and streams back the response.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const rateLimitResult = checkRateLimit(user.id)
    if (!rateLimitResult.allowed) {
      const resetSec = Math.ceil(rateLimitResult.resetInMs / 1000)
      return NextResponse.json(
        {
          error: `Too many requests. Please wait ${resetSec} seconds before trying again.`,
          code: 'rate_limited',
          resetInSeconds: resetSec,
        },
        { status: 429 }
      )
    }

    // ── Parse body ─────────────────────────────────────────────────────────
    const body = await request.json()
    const messages: { role: string; content: string }[] = body.messages ?? []

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })
    }

    // ── Dynamic import to avoid edge runtime issues ────────────────────────
    const { streamChatResponse } = await import('@/lib/ai/ollama-service')

    // ── Create a ReadableStream to pipe chunks back to the client ──────────
    const encoder = new TextEncoder()
    let onChunkCalled = false

    const readable = new ReadableStream({
      async start(controller) {
        await streamChatResponse({
          messages: messages as { role: 'user' | 'assistant' | 'system'; content: string }[],
          onChunk(chunk) {
            onChunkCalled = true
            // Server-Sent Events format
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`))
          },
          onComplete(fullText) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`)
            )
            controller.close()
          },
          onError(err) {
            let message = err.message
            let code = 'unknown'

            if (err instanceof OllamaApiError) {
              code = err.code
              message = err.message
            } else if (err instanceof OllamaConfigError) {
              code = 'config_error'
              message = err.message
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: message, code })}\n\n`)
            )
            controller.close()
          },
        })

        // Guard: if no chunks were sent (e.g., empty response), close cleanly
        if (!onChunkCalled) {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Rate-Limit-Remaining': String(rateLimitResult.remaining),
      },
    })
  } catch (err) {
    console.error('[ai-chat] Unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected server error occurred.' },
      { status: 500 }
    )
  }
}
