/**
 * Professional Excel Generator using ExcelJS.
 * Applies styled headers, borders, auto-widths, formatting, frozen rows, and filters.
 */

import ExcelJS from 'exceljs'

export interface SpreadsheetSheet {
  name: string
  headers: string[]
  rows: (string | number | Date | null)[][]
  /** Optional column format hints: 'currency' | 'percent' | 'date' | 'number' | 'text' */
  columnFormats?: Record<number, 'currency' | 'percent' | 'date' | 'number' | 'text'>
}

export interface GenerateExcelOptions {
  sheets: SpreadsheetSheet[]
  /** Workbook title for metadata */
  title?: string
  /** Author name for metadata */
  author?: string
}

// ─── Theme Colors ─────────────────────────────────────────────────────────────
const HEADER_BG = '2F4F8F'   // deep navy blue
const HEADER_FG = 'FFFFFF'   // white text
const ALT_ROW_BG = 'EEF2FA'  // very light blue for alternating rows
const BORDER_COLOR = 'BFCDE0'
const ACCENT_COLOR = '1565C0'

/**
 * Generate a professional .xlsx workbook buffer.
 */
export async function generateExcel(options: GenerateExcelOptions): Promise<Buffer> {
  const { sheets, title = 'AI Generated Spreadsheet', author = 'EF A&E AI Assistant' } = options

  const workbook = new ExcelJS.Workbook()
  workbook.creator = author
  workbook.lastModifiedBy = author
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.title = title
  workbook.subject = 'AI-Generated Spreadsheet'
  workbook.keywords = 'AI, Excel, EF A&E'

  for (const sheetDef of sheets) {
    const worksheet = workbook.addWorksheet(sanitizeSheetName(sheetDef.name), {
      properties: { tabColor: { argb: `FF${ACCENT_COLOR}` } },
      views: [{ state: 'frozen', ySplit: 1 }], // freeze header row
    })

    const colCount = sheetDef.headers.length

    // ── Define columns with auto-width estimation ─────────────────────────────
    worksheet.columns = sheetDef.headers.map((header, i) => {
      const fmt = sheetDef.columnFormats?.[i]
      const maxDataLen = Math.max(
        header.length,
        ...sheetDef.rows.slice(0, 100).map((r) => String(r[i] ?? '').length)
      )
      const width = Math.min(Math.max(maxDataLen + 4, 12), 50)

      return {
        header,
        key: `col${i}`,
        width,
        style: getColumnStyle(fmt),
      }
    })

    // ── Style the header row ──────────────────────────────────────────────────
    const headerRow = worksheet.getRow(1)
    headerRow.height = 24

    for (let c = 1; c <= colCount; c++) {
      const cell = headerRow.getCell(c)
      cell.font = {
        name: 'Calibri',
        bold: true,
        size: 11,
        color: { argb: `FF${HEADER_FG}` },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${HEADER_BG}` },
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: false,
      }
      cell.border = buildBorder(BORDER_COLOR)
    }

    // ── Add data rows ─────────────────────────────────────────────────────────
    sheetDef.rows.forEach((rowData, rowIndex) => {
      const row = worksheet.addRow(
        sheetDef.headers.map((_, colIdx) => rowData[colIdx] ?? '')
      )
      row.height = 18

      const isAlt = rowIndex % 2 === 1

      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c)
        const fmt = sheetDef.columnFormats?.[c - 1]

        // Alternating row background
        if (isAlt) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: `FF${ALT_ROW_BG}` },
          }
        }

        cell.font = { name: 'Calibri', size: 10 }
        cell.alignment = { vertical: 'middle', wrapText: fmt === 'text' }
        cell.border = buildBorder(BORDER_COLOR)

        // Apply number formats
        applyNumericFormat(cell, fmt, rowData[c - 1])
      }
    })

    // ── Auto-filter on header row ─────────────────────────────────────────────
    if (colCount > 0 && sheetDef.rows.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: colCount },
      }
    }

    // ── Add an Excel Table for better data management ────────────────────────
    if (sheetDef.rows.length > 0 && colCount > 0) {
      try {
        worksheet.addTable({
          name: `Table_${sanitizeTableName(sheetDef.name)}`,
          ref: `A1`,
          headerRow: true,
          totalsRow: false,
          style: {
            theme: 'TableStyleMedium9',
            showRowStripes: true,
          },
          columns: sheetDef.headers.map((h) => ({
            name: h,
            filterButton: true,
          })),
          rows: sheetDef.rows.map((r) =>
            sheetDef.headers.map((_, i) => r[i] ?? '')
          ),
        })
      } catch {
        // Table creation can fail on duplicate names or special chars; continue without it
      }
    }
  }

  // ── Write to buffer ───────────────────────────────────────────────────────
  const buf = await workbook.xlsx.writeBuffer()
  return Buffer.from(buf)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBorder(color: string): Partial<ExcelJS.Borders> {
  const side: ExcelJS.BorderStyle = 'thin'
  const borderDef = { style: side, color: { argb: `FF${color}` } }
  return { top: borderDef, left: borderDef, bottom: borderDef, right: borderDef }
}

function getColumnStyle(fmt?: string): Partial<ExcelJS.Style> {
  switch (fmt) {
    case 'currency':
      return { numFmt: '"$"#,##0.00' }
    case 'percent':
      return { numFmt: '0.00%' }
    case 'date':
      return { numFmt: 'yyyy-mm-dd' }
    case 'number':
      return { numFmt: '#,##0.##' }
    default:
      return {}
  }
}

function applyNumericFormat(
  cell: ExcelJS.Cell,
  fmt: string | undefined,
  value: unknown
) {
  if (!fmt || fmt === 'text') return

  // Try to coerce string numbers
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%\s]/g, '')
    const num = parseFloat(cleaned)
    if (!isNaN(num)) {
      cell.value = fmt === 'percent' && Math.abs(num) > 1 ? num / 100 : num
    }
  }
}

function sanitizeSheetName(name: string): string {
  return name
    .replace(/[\\/*?:\[\]]/g, '')
    .substring(0, 31)
    .trim() || 'Sheet1'
}

function sanitizeTableName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 40) || 'Table1'
}

/**
 * Build GenerateExcelOptions from AI-structured data.
 */
export function buildExcelOptionsFromAiData(
  aiData: AiSpreadsheetData
): GenerateExcelOptions {
  return {
    title: aiData.title ?? 'AI Generated Spreadsheet',
    author: 'EF A&E AI Assistant',
    sheets: aiData.sheets.map((s) => ({
      name: s.name,
      headers: s.headers,
      rows: s.rows,
      columnFormats: s.columnFormats,
    })),
  }
}

export interface AiSpreadsheetData {
  title?: string
  sheets: {
    name: string
    headers: string[]
    rows: (string | number | null)[][]
    columnFormats?: Record<number, 'currency' | 'percent' | 'date' | 'number' | 'text'>
  }[]
}
