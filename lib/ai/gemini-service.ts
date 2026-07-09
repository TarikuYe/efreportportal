/**
 * Gemini AI Service — report text correction for employee work logs.
 * Uses GEMINI_API_KEY (server-side only).
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

export type ReportTextField = 'assigned_tasks' | 'actual_work_done' | 'remark'

const FIELD_LABELS: Record<ReportTextField, string> = {
  assigned_tasks: 'Assigned Tasks',
  actual_work_done: 'Actual Work Done',
  remark: 'Remark',
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new GeminiConfigError(
      'GEMINI_API_KEY is not set. Please add it to your .env file.'
    )
  }
  return apiKey
}

const CORRECTION_SYSTEM_PROMPT = `You are a professional writing assistant for an engineering firm's daily work reports.
Your job is to correct grammar, spelling, punctuation, and clarity while preserving the original meaning and facts.

Rules:
- Fix errors only; do not invent new tasks or accomplishments.
- Keep the same language the employee used (English unless they wrote in another language).
- Use clear, professional tone suitable for official timesheets.
- Preserve bullet/list structure if present; use markdown list format when appropriate.
- Return ONLY the corrected text — no explanations, quotes, or labels.`

/**
 * Correct employee report text using Gemini.
 */
export async function correctReportText(
  text: string,
  field: ReportTextField
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new GeminiApiError('Nothing to correct — please enter some text first.', 'empty_text')
  }

  const apiKey = getApiKey()
  const fieldLabel = FIELD_LABELS[field]

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: CORRECTION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Correct this "${fieldLabel}" entry for a daily work log:\n\n${trimmed}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    }),
  })

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}))
    throw classifyError(errJson)
  }

  const data = await response.json()
  const corrected =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

  if (!corrected) {
    throw new GeminiApiError('Gemini returned an empty response.', 'empty_response')
  }

  // Strip wrapping quotes if the model added them
  return corrected.replace(/^["']|["']$/g, '')
}

export class GeminiApiError extends Error {
  public readonly code: string
  public readonly isQuotaError: boolean
  public readonly isRateLimitError: boolean

  constructor(message: string, code: string) {
    super(message)
    this.name = 'GeminiApiError'
    this.code = code
    this.isQuotaError = code === 'insufficient_quota'
    this.isRateLimitError = code === 'rate_limit_exceeded'
  }
}

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiConfigError'
  }
}

function classifyError(err: unknown): GeminiApiError | GeminiConfigError | Error {
  if (err instanceof GeminiConfigError || err instanceof GeminiApiError) return err

  if (err && typeof err === 'object') {
    const errorObj = (err as { error?: { status?: string; message?: string; code?: number } }).error
    if (errorObj && typeof errorObj === 'object') {
      const code = String(errorObj.status ?? 'unknown')
      const msg = String(errorObj.message ?? 'Unknown API error')
      const httpCode = Number(errorObj.code ?? 0)

      if (httpCode === 429 || code.includes('RESOURCE_EXHAUSTED')) {
        return new GeminiApiError(
          'Gemini API quota reached. Please retry shortly.',
          'insufficient_quota'
        )
      }

      if (httpCode === 400 && msg.toLowerCase().includes('api key not valid')) {
        return new GeminiApiError(
          'Invalid API key. Please check your GEMINI_API_KEY environment variable.',
          'invalid_api_key'
        )
      }

      return new GeminiApiError(msg, code)
    }
  }

  if (err instanceof Error) return err
  return new Error('An unexpected error occurred.')
}
