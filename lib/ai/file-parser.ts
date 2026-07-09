/**
 * Multi-format file parser for the AI Spreadsheet Assistant.
 * Supports: .csv, .json, .txt, .xlsx, .pdf (text-based), .docx (basic)
 */

import ExcelJS from 'exceljs'

export interface ParsedFileContent {
  type: 'table' | 'text' | 'json'
  /** Parsed rows for table data */
  rows?: string[][]
  /** Headers extracted from the first row */
  headers?: string[]
  /** Raw text for non-tabular files */
  text?: string
  /** Original filename */
  filename: string
  /** Detected MIME/extension */
  extension: string
  /** Approximate row/record count */
  rowCount: number
}

/**
 * Parse a file Buffer into a structured content object.
 */
export async function parseFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ParsedFileContent> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  switch (ext) {
    case 'csv':
      return parseCsv(buffer, filename, ext)
    case 'json':
      return parseJson(buffer, filename, ext)
    case 'txt':
      return parseTxt(buffer, filename, ext)
    case 'xlsx':
    case 'xls':
      return parseXlsx(buffer, filename, ext)
    case 'pdf':
      return parsePdfText(buffer, filename, ext)
    case 'docx':
      return parseDocxText(buffer, filename, ext)
    default:
      throw new Error(
        `Unsupported file type: .${ext}. Allowed: xlsx, csv, pdf, docx, txt, json`
      )
  }
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function parseCsv(
  buffer: Buffer,
  filename: string,
  extension: string
): ParsedFileContent {
  const text = buffer.toString('utf-8')
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const rows = lines.map((line) => parseCsvLine(line))
  const [headers, ...dataRows] = rows

  return {
    type: 'table',
    rows: dataRows,
    headers,
    filename,
    extension,
    rowCount: dataRows.length,
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

function parseJson(
  buffer: Buffer,
  filename: string,
  extension: string
): ParsedFileContent {
  const raw = JSON.parse(buffer.toString('utf-8'))
  const arr = Array.isArray(raw) ? raw : [raw]

  if (arr.length === 0) {
    return { type: 'json', text: '[]', filename, extension, rowCount: 0 }
  }

  const headers = Object.keys(arr[0])
  const rows = arr.map((item: Record<string, unknown>) =>
    headers.map((h) => String(item[h] ?? ''))
  )

  return {
    type: 'table',
    rows,
    headers,
    filename,
    extension,
    rowCount: rows.length,
  }
}

// ─── TXT ──────────────────────────────────────────────────────────────────────

function parseTxt(
  buffer: Buffer,
  filename: string,
  extension: string
): ParsedFileContent {
  const text = buffer.toString('utf-8')
  return { type: 'text', text, filename, extension, rowCount: 1 }
}

// ─── XLSX ─────────────────────────────────────────────────────────────────────

async function parseXlsx(
  buffer: Buffer,
  filename: string,
  extension: string
): Promise<ParsedFileContent> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return { type: 'table', rows: [], headers: [], filename, extension, rowCount: 0 }
  }

  const allRows: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = (row.values as ExcelJS.CellValue[])
      .slice(1) // ExcelJS row.values is 1-indexed, index 0 is empty
      .map((v) => {
        if (v === null || v === undefined) return ''
        if (typeof v === 'object' && 'result' in (v as object)) {
          return String((v as ExcelJS.CellFormulaValue).result ?? '')
        }
        return String(v)
      })
    allRows.push(cells)
  })

  const [headers, ...rows] = allRows
  return {
    type: 'table',
    rows,
    headers: headers ?? [],
    filename,
    extension,
    rowCount: rows.length,
  }
}

// ─── PDF (text extraction) ────────────────────────────────────────────────────

function parsePdfText(
  buffer: Buffer,
  filename: string,
  extension: string
): ParsedFileContent {
  // Extract readable ASCII text from PDF binary
  const raw = buffer.toString('latin1')
  const textChunks: string[] = []

  // Match text between BT (Begin Text) and ET (End Text) markers
  const btEtRegex = /BT([\s\S]*?)ET/g
  let match: RegExpExecArray | null

  while ((match = btEtRegex.exec(raw)) !== null) {
    // Extract string literals like (text) or <hex>
    const inner = match[1]
    const strRegex = /\(([^)]*)\)/g
    let strMatch: RegExpExecArray | null
    while ((strMatch = strRegex.exec(inner)) !== null) {
      const decoded = strMatch[1].replace(/\\n/g, '\n').replace(/\\r/g, '')
      if (decoded.trim()) textChunks.push(decoded)
    }
  }

  const text = textChunks.join(' ').replace(/\s+/g, ' ').trim()

  return {
    type: 'text',
    text: text || '[PDF content could not be extracted as text. Please describe the data manually.]',
    filename,
    extension,
    rowCount: 1,
  }
}

// ─── DOCX (basic text extraction) ────────────────────────────────────────────

function parseDocxText(
  buffer: Buffer,
  filename: string,
  extension: string
): ParsedFileContent {
  // DOCX is a ZIP; extract readable text via simple regex on the XML
  const raw = buffer.toString('latin1')
  const texts: string[] = []

  // Match content inside <w:t> tags (Word text runs)
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(raw)) !== null) {
    if (m[1].trim()) texts.push(m[1])
  }

  const text = texts.join(' ').replace(/\s+/g, ' ').trim()

  return {
    type: 'text',
    text: text || '[DOCX content could not be extracted. Please describe the data manually.]',
    filename,
    extension,
    rowCount: 1,
  }
}

/**
 * Validate file type and size before parsing.
 */
export function validateFile(
  filename: string,
  sizeBytes: number
): { valid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
  const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'pdf', 'docx', 'txt', 'json']

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File type ".${ext}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    }
  }

  if (sizeBytes > MAX_SIZE) {
    return {
      valid: false,
      error: `File too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). Maximum allowed: 10 MB`,
    }
  }

  // Sanitize filename (no path traversal)
  const base = filename.replace(/[^a-zA-Z0-9._\- ]/g, '_')
  if (base !== filename) {
    return { valid: false, error: 'Filename contains invalid characters.' }
  }

  return { valid: true }
}
