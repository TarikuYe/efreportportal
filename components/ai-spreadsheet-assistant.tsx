'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FileSpreadsheet,
  Send,
  Paperclip,
  Download,
  RefreshCcw,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  FileText,
  ChevronDown,
  Bot,
  User,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** If message contains downloadable spreadsheet data */
  spreadsheetData?: Record<string, unknown> | null
  /** File attachment metadata for user messages */
  fileMeta?: {
    name: string
    size: number
    type: string
    rowCount?: number
  } | null
  timestamp: Date
  isStreaming?: boolean
  isError?: boolean
}

interface UploadStatus {
  phase: 'idle' | 'parsing' | 'analyzing' | 'done' | 'error'
  progress: number
  filename?: string
  error?: string
}

const SUGGESTED_PROMPTS = [
  'Convert to professional Excel',
  'Remove duplicates',
  'Clean & format data',
  'Add totals & summaries',
  'Split full names',
  'Fix date formatting',
  'Calculate percentages',
  'Classify records',
]

const ALLOWED_TYPES = '.xlsx,.xls,.csv,.pdf,.docx,.txt,.json'

// ─── Helper: Format file size ─────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ─── Helper: parse SSE stream ─────────────────────────────────────────────────

async function readSseStream(
  response: Response,
  onChunk: (chunk: string) => void,
  onDone: (data: Record<string, unknown>) => void,
  onError: (msg: string, code?: string) => void
) {
  const reader = response.body?.getReader()
  if (!reader) { onError('No response stream.'); return }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const parsed = JSON.parse(line.slice(6))
        if (parsed.error) {
          onError(parsed.error, parsed.code)
          return
        }
        if (parsed.chunk) onChunk(parsed.chunk)
        if (parsed.done) { onDone(parsed); return }
      } catch { /* ignore malformed lines */ }
    }
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AiSpreadsheetAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "👋 Hello! I'm your AI Spreadsheet Assistant. Upload any file (Excel, CSV, PDF, Word, JSON, or TXT) and I'll help you convert it into a professionally formatted Excel spreadsheet, clean your data, analyze trends, and more.\n\nYou can also just ask me spreadsheet questions without uploading a file!",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ phase: 'idle', progress: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send plain text chat ────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return
      setInput('')

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      }

      const assistantId = `assistant-${Date.now()}`
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      try {
        const history = messages
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({ role: m.role, content: m.content }))
        history.push({ role: 'user', content: text.trim() })

        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error ?? 'Request failed')
        }

        let fullText = ''
        await readSseStream(
          response,
          (chunk) => {
            fullText += chunk
            const extracted = extractSpreadsheetData(fullText)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: fullText, spreadsheetData: extracted }
                  : m
              )
            )
          },
          (data) => {
            const extracted = extractSpreadsheetData(data.fullText as string ?? fullText)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: data.fullText as string ?? fullText,
                      spreadsheetData: extracted,
                      isStreaming: false,
                    }
                  : m
              )
            )
          },
          (errMsg, code) => {
            const isOllamaDown = code === 'connection_error' || code === 'model_not_found'
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: isOllamaDown
                        ? '⚠️ Ollama is not reachable. Make sure Ollama is running locally and run: ollama pull llama3.1'
                        : `❌ ${errMsg}`,
                      isStreaming: false,
                      isError: true,
                    }
                  : m
              )
            )
          }
        )
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `❌ ${errMsg}`, isStreaming: false, isError: true }
              : m
          )
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, messages]
  )

  // ── Upload & analyze file ────────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      if (isStreaming) return

      const MAX_SIZE = 10 * 1024 * 1024
      const ALLOWED_EXTS = ['xlsx', 'xls', 'csv', 'pdf', 'docx', 'txt', 'json']
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

      if (!ALLOWED_EXTS.includes(ext)) {
        setUploadStatus({
          phase: 'error',
          progress: 0,
          error: `File type ".${ext}" is not supported.`,
        })
        return
      }
      if (file.size > MAX_SIZE) {
        setUploadStatus({
          phase: 'error',
          progress: 0,
          error: `File too large (${formatBytes(file.size)}). Max: 10 MB`,
        })
        return
      }

      setPendingFile(null)
      setUploadStatus({ phase: 'parsing', progress: 20, filename: file.name })
      setIsStreaming(true)

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: input.trim() || 'Please analyze this file and convert it to a professional Excel spreadsheet.',
        fileMeta: { name: file.name, size: file.size, type: ext },
        timestamp: new Date(),
      }
      setInput('')

      const assistantId = `assistant-${Date.now()}`
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setUploadStatus({ phase: 'analyzing', progress: 50, filename: file.name })

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('prompt', userMsg.content)
        const history = messages
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({ role: m.role, content: m.content }))
        formData.append('history', JSON.stringify(history))

        const response = await fetch('/api/ai-chat/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error ?? 'Upload failed')
        }

        let fullText = ''
        await readSseStream(
          response,
          (chunk) => {
            fullText += chunk
            const extracted = extractSpreadsheetData(fullText)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: fullText, spreadsheetData: extracted }
                  : m
              )
            )
          },
          (data) => {
            const extracted = extractSpreadsheetData(data.fullText as string ?? fullText)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: data.fullText as string ?? fullText,
                      spreadsheetData: extracted,
                      fileMeta: data.fileMeta as ChatMessage['fileMeta'],
                      isStreaming: false,
                    }
                  : m
              )
            )
            setUploadStatus({ phase: 'done', progress: 100, filename: file.name })
          },
          (errMsg, code) => {
            const isOllamaDown = code === 'connection_error' || code === 'model_not_found'
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: isOllamaDown
                        ? '⚠️ Ollama is not reachable. Make sure Ollama is running locally and run: ollama pull llama3.1'
                        : `❌ ${errMsg}`,
                      isStreaming: false,
                      isError: true,
                    }
                  : m
              )
            )
            setUploadStatus({ phase: 'error', progress: 0, error: errMsg })
          }
        )
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `❌ ${errMsg}`, isStreaming: false, isError: true }
              : m
          )
        )
        setUploadStatus({ phase: 'error', progress: 0, error: errMsg })
      } finally {
        setIsStreaming(false)
        setTimeout(
          () => setUploadStatus({ phase: 'idle', progress: 0 }),
          uploadStatus.phase !== 'error' ? 3000 : 6000
        )
      }
    },
    [isStreaming, input, messages, uploadStatus.phase]
  )

  // ── Download Excel ───────────────────────────────────────────────────────────

  const downloadExcel = useCallback(async (data: Record<string, unknown>, title?: string) => {
    try {
      const response = await fetch('/api/ai-chat/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })

      if (!response.ok) {
        const err = await response.json()
        alert(`Download failed: ${err.error}`)
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (title ?? 'AI_Spreadsheet').replace(/[^a-zA-Z0-9\s\-_]/g, '') + '.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Download error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [])

  // ── Retry last message ───────────────────────────────────────────────────────

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUser) {
      setMessages((prev) => prev.filter((m) => !m.isError))
      sendMessage(lastUser.content)
    }
  }, [messages, sendMessage])

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  // ── Keyboard shortcut ─────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (pendingFile) {
        processFile(pendingFile)
      } else {
        sendMessage(input)
      }
    }
  }

  // ── Render message content (simple markdown) ──────────────────────────────

  const renderContent = (content: string) => {
    // Strip spreadsheet_data blocks from display
    const cleaned = content.replace(/```spreadsheet_data[\s\S]*?```/g, '').trim()
    if (!cleaned) return null

    return (
      <div className="prose-chat">
        {cleaned.split('\n').map((line, i) => {
          if (line.startsWith('# ')) return <h3 key={i} className="font-bold text-base mt-2 mb-1">{line.slice(2)}</h3>
          if (line.startsWith('## ')) return <h4 key={i} className="font-semibold text-sm mt-2 mb-1">{line.slice(3)}</h4>
          if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{line.slice(2)}</li>
          if (line.trim() === '') return <div key={i} className="h-2" />
          return <p key={i} className="text-sm leading-relaxed">{line}</p>
        })}
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[600px] bg-background rounded-2xl border border-border shadow-xl overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 via-background to-accent/5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
          <Sparkles className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-foreground text-base leading-tight">
            AI Spreadsheet Assistant
          </h1>
          <p className="text-xs text-muted-foreground">
            Powered by Ollama (Llama 3.1) — Convert, clean &amp; analyze your data
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </span>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">

        {/* ── Chat messages ──────────────────────────────────────────────── */}
        <div
          className="flex-1 flex flex-col min-h-0"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-2xl pointer-events-none">
              <FileSpreadsheet className="size-12 text-primary mb-3" />
              <p className="font-semibold text-primary text-lg">Drop your file here</p>
              <p className="text-sm text-muted-foreground">Excel, CSV, PDF, Word, JSON, TXT</p>
            </div>
          )}

          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`shrink-0 size-8 rounded-full flex items-center justify-center shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gradient-to-br from-accent to-accent/60 text-accent-foreground'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="size-4" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[78%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {/* File attachment chip */}
                  {msg.fileMeta && (
                    <div className="flex items-center gap-2 bg-secondary/60 border border-border rounded-lg px-3 py-2 text-xs">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate max-w-[160px]">
                        {msg.fileMeta.name}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {formatBytes(msg.fileMeta.size)}
                        {msg.fileMeta.rowCount ? ` · ${msg.fileMeta.rowCount} rows` : ''}
                      </span>
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : msg.isError
                        ? 'bg-destructive/10 border border-destructive/30 text-destructive rounded-tl-sm'
                        : 'bg-card border border-border text-card-foreground rounded-tl-sm'
                    }`}
                  >
                    {msg.isStreaming && !msg.content ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span className="text-xs">Thinking…</span>
                      </div>
                    ) : (
                      renderContent(msg.content)
                    )}

                    {/* Streaming cursor */}
                    {msg.isStreaming && msg.content && (
                      <span className="inline-block w-0.5 h-3.5 bg-current opacity-70 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>

                  {/* Download button for spreadsheet data */}
                  {msg.spreadsheetData && !msg.isStreaming && (
                    <button
                      id={`download-excel-${msg.id}`}
                      onClick={() =>
                        downloadExcel(
                          msg.spreadsheetData as Record<string, unknown>,
                          (msg.spreadsheetData as Record<string, unknown>)?.title as string
                        )
                      }
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Download className="size-3.5" />
                      Download Excel
                      <FileSpreadsheet className="size-3.5 opacity-80" />
                    </button>
                  )}

                  {/* Retry button for error messages */}
                  {msg.isError && !msg.isStreaming && (
                    <button
                      onClick={retryLast}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCcw className="size-3" />
                      Retry
                    </button>
                  )}

                  {/* Timestamp */}
                  <span className="text-[10px] text-muted-foreground/60 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* ── Upload status bar ──────────────────────────────────────────── */}
          {uploadStatus.phase !== 'idle' && (
            <div className="mx-4 mb-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {uploadStatus.phase === 'error' ? (
                    <AlertCircle className="size-4 text-destructive" />
                  ) : uploadStatus.phase === 'done' ? (
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  ) : (
                    <Loader2 className="size-4 text-primary animate-spin" />
                  )}
                  <span className="text-xs font-medium text-foreground">
                    {uploadStatus.phase === 'parsing' && `Parsing ${uploadStatus.filename}…`}
                    {uploadStatus.phase === 'analyzing' && 'AI analyzing file…'}
                    {uploadStatus.phase === 'done' && 'Analysis complete!'}
                    {uploadStatus.phase === 'error' && 'Upload failed'}
                  </span>
                </div>
                {uploadStatus.phase === 'error' && (
                  <button
                    onClick={() => setUploadStatus({ phase: 'idle', progress: 0 })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {uploadStatus.phase === 'error' ? (
                <p className="text-xs text-destructive">{uploadStatus.error}</p>
              ) : (
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                    style={{ width: `${uploadStatus.progress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Pending file chip ───────────────────────────────────────────── */}
          {pendingFile && (
            <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2">
              <FileText className="size-4 text-accent shrink-0" />
              <span className="text-xs font-medium text-foreground flex-1 truncate">
                {pendingFile.name} <span className="text-muted-foreground">({formatBytes(pendingFile.size)})</span>
              </span>
              <button
                onClick={() => setPendingFile(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* ── Suggested prompts ───────────────────────────────────────────── */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Try asking…
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/60 text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all duration-150"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Input area ──────────────────────────────────────────────────── */}
          <div className="border-t border-border p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-secondary/30 px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              {/* File attach button */}
              <button
                id="attach-file-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                title="Attach file"
                className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
              >
                <Paperclip className="size-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setPendingFile(file)
                  e.target.value = ''
                }}
              />

              {/* Text input */}
              <textarea
                ref={inputRef}
                id="ai-chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingFile ? 'Add instructions for this file… (Enter to send)' : 'Ask me anything about your spreadsheet… (Enter to send)'}
                rows={1}
                disabled={isStreaming}
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none max-h-32 disabled:opacity-60 py-1"
                style={{ height: 'auto', minHeight: '24px' }}
                onInput={(e) => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = `${Math.min(t.scrollHeight, 128)}px`
                }}
              />

              {/* Send button */}
              <button
                id="send-message-btn"
                onClick={() => pendingFile ? processFile(pendingFile) : sendMessage(input)}
                disabled={isStreaming || (!input.trim() && !pendingFile)}
                className="shrink-0 flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              >
                {isStreaming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>

            <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
              Supports Excel, CSV, PDF, Word, JSON, TXT · Max 10 MB · Press Enter to send
            </p>
          </div>
        </div>

        {/* ── Right sidebar: drag-drop zone (desktop only) ─────────────────── */}
        <div className="hidden lg:flex w-64 flex-col border-l border-border p-4 gap-4 bg-secondary/20">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Upload File
            </h3>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all duration-200
                ${isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-border bg-background/50 hover:border-primary/50 hover:bg-primary/5'
                }
              `}
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <FileSpreadsheet className="size-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground">
                  Drop file here
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  or click to browse
                </p>
              </div>
              <div className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
                xlsx · csv · pdf
                <br />
                docx · txt · json
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              AI Capabilities
            </h3>
            <ul className="space-y-1.5">
              {[
                '✦ Convert any file to Excel',
                '✦ Clean & deduplicate data',
                '✦ Format currencies & dates',
                '✦ Split / merge columns',
                '✦ Generate formulas',
                '✦ Analyze trends',
                '✦ Classify records',
                '✦ Create pivot tables',
                '✦ Fix data errors',
                '✦ Translate content',
              ].map((item) => (
                <li key={item} className="text-[11px] text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Scroll to bottom */}
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="mt-auto flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="size-3.5" />
            Scroll to bottom
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Utility: extract spreadsheet data from AI response ───────────────────────

function extractSpreadsheetData(text: string): Record<string, unknown> | null {
  const regex = /```spreadsheet_data\s*([\s\S]*?)```/
  const match = regex.exec(text)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}
