/**
 * Ollama AI Service — local Llama 3.1 for the spreadsheet assistant.
 * Requires Ollama running locally (default: http://localhost:11434).
 */

import type { ParsedFileContent } from './file-parser'

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '')
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1'

const SYSTEM_PROMPT = `You are an expert AI spreadsheet assistant.
Your primary goal is to help users clean, analyze, format, and convert their data into professional Excel spreadsheets.

When a user uploads data or asks you to process it:
1. Analyze the content carefully.
2. Respond in a friendly, concise manner explaining what you found and what you did.
3. When generating spreadsheet data, you MUST output a valid JSON block wrapped in triple backticks with the label "spreadsheet_data" like this:

\`\`\`spreadsheet_data
{
  "title": "Sheet Title",
  "sheets": [
    {
      "name": "Sheet Name",
      "headers": ["Col1", "Col2", "Col3"],
      "rows": [
        ["val1", "val2", "val3"],
        ["val4", "val5", "val6"]
      ],
      "columnFormats": {
        "1": "currency",
        "2": "date"
      }
    }
  ]
}
\`\`\`

Column format options: "currency", "percent", "date", "number", "text"

You can handle requests such as:
- Convert this data to a professional Excel spreadsheet
- Clean this spreadsheet (remove duplicates, fix formatting)
- Merge columns / split names
- Add calculated columns
- Classify or categorize records
- Summarize data
- Generate formulas
- Analyze trends
- Translate text
- Fix data types and formatting

Always be helpful and precise. When in doubt, ask a clarifying question.`

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamChatOptions {
  messages: ChatMessage[]
  onChunk: (chunk: string) => void
  onComplete: (fullText: string) => void
  onError: (error: OllamaApiError | OllamaConfigError | Error) => void
}

function buildOllamaMessages(messages: ChatMessage[]) {
  const ollamaMessages: { role: string; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]
  for (const m of messages) {
    if (m.role === 'system') continue
    ollamaMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })
  }
  return ollamaMessages
}

async function ollamaChatStream(messages: ChatMessage[]): Promise<Response> {
  const url = `${OLLAMA_BASE_URL}/api/chat`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: buildOllamaMessages(messages),
      stream: true,
      options: { temperature: 0.2 },
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw classifyError(new Error(errText || `Ollama request failed (${response.status})`))
  }

  return response
}

async function* readOllamaStream(response: Response): AsyncIterable<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable.')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        const delta = parsed.message?.content ?? ''
        if (delta) yield delta
      } catch {
        // ignore malformed lines
      }
    }
  }
}

export async function streamChatResponse(options: StreamChatOptions): Promise<void> {
  const { messages, onChunk, onComplete, onError } = options

  try {
    const response = await ollamaChatStream(messages)
    let fullText = ''

    for await (const chunk of readOllamaStream(response)) {
      fullText += chunk
      onChunk(chunk)
    }

    onComplete(fullText)
  } catch (err) {
    onError(classifyError(err))
  }
}

export async function analyzeFileContent(
  parsed: ParsedFileContent,
  userPrompt: string,
  conversationHistory: ChatMessage[]
): Promise<{ stream: AsyncIterable<string> }> {
  let fileDescription = ''
  if (parsed.type === 'table' && parsed.headers && parsed.rows) {
    const preview = parsed.rows.slice(0, 20)
    fileDescription = `
File: ${parsed.filename} (${parsed.extension.toUpperCase()})
Rows: ${parsed.rowCount}
Headers: ${parsed.headers.join(' | ')}
Preview (first ${Math.min(20, parsed.rowCount)} rows):
${preview.map((r) => r.join(' | ')).join('\n')}
    `.trim()
  } else if (parsed.type === 'text' && parsed.text) {
    const truncated = parsed.text.substring(0, 3000)
    fileDescription = `
File: ${parsed.filename} (${parsed.extension.toUpperCase()})
Content:
${truncated}${parsed.text.length > 3000 ? '\n[... truncated ...]' : ''}
    `.trim()
  }

  const userMessage: ChatMessage = {
    role: 'user',
    content: `I've uploaded a file. Here is its content:\n\n${fileDescription}\n\nMy request: ${userPrompt || 'Please analyze this data and convert it into a professional Excel spreadsheet.'}`,
  }

  const response = await ollamaChatStream([...conversationHistory, userMessage])
  return { stream: readOllamaStream(response) }
}

export function extractSpreadsheetData(
  aiResponse: string
): Record<string, unknown> | null {
  const regex = /```spreadsheet_data\s*([\s\S]*?)```/
  const match = regex.exec(aiResponse)
  if (!match) return null

  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

export class OllamaApiError extends Error {
  public readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'OllamaApiError'
    this.code = code
  }
}

export class OllamaConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OllamaConfigError'
  }
}

function classifyError(err: unknown): OllamaApiError | OllamaConfigError | Error {
  if (err instanceof OllamaConfigError || err instanceof OllamaApiError) return err

  const msg = err instanceof Error ? err.message : String(err)

  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('connect ECONNREFUSED')
  ) {
    return new OllamaApiError(
      `Cannot reach Ollama at ${OLLAMA_BASE_URL}. Make sure Ollama is running and the model "${OLLAMA_MODEL}" is pulled (ollama pull ${OLLAMA_MODEL}).`,
      'connection_error'
    )
  }

  if (msg.toLowerCase().includes('model') && msg.toLowerCase().includes('not found')) {
    return new OllamaApiError(
      `Model "${OLLAMA_MODEL}" is not available. Run: ollama pull ${OLLAMA_MODEL}`,
      'model_not_found'
    )
  }

  if (err instanceof Error) return err
  return new Error('An unexpected error occurred.')
}
