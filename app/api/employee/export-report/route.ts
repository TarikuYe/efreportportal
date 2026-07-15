import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// Colour palette (AARRGGBB — ExcelJS ARGB format)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  // Corporate structure
  NAVY_BG:      'FF1E3A8A',   // #1E3A8A — main banner fill
  NAVY_FG:      'FFFFFFFF',   // white text on navy
  SLATE_HDR_BG: 'FF475569',   // #475569 — column header row fill
  SLATE_HDR_FG: 'FFFFFFFF',   // white text on slate
  DARK_FG:      'FF1E293B',   // #1E293B — employee profile label
  MUTED_FG:     'FF64748B',   // #64748B — "report generated" meta label
  BLACK_FG:     'FF111827',
  BAND_A:       'FFFFFFFF',
  BAND_B:       'FFF8FAFC',
  // Approval status badge fills (pastel)
  APPROVED_BG:  'FFF0FDF4',   // soft green
  APPROVED_FG:  'FF166534',   // dark green
  PENDING_BG:   'FFFEF3C7',   // soft yellow
  PENDING_FG:   'FF92400E',   // dark amber
  REJECTED_BG:  'FFFEE2E2',   // soft red
  REJECTED_FG:  'FF991B1B',   // dark red
  FOOTER_FG:    'FF1E3A8A',   // navy text in summary block
  THIN:  { style: 'thin'   as const },
  MED:   { style: 'medium' as const },
}

// ─────────────────────────────────────────────────────────────────────────────
// Column layout — 8 data columns (A–H)
// ─────────────────────────────────────────────────────────────────────────────
const COLUMNS = [
  { header: 'Date',                        key: 'date',        width: 14 },
  { header: 'Biometric In (Fingerprint)',   key: 'entrance',    width: 22 },
  { header: 'Biometric Out (Fingerprint)',  key: 'leave',       width: 22 },
  { header: 'Computed Shift Hours',         key: 'hours',       width: 20 },
  { header: 'Task Summary / Description',  key: 'tasks',       width: 42 },
  { header: '% Progress Complete',          key: 'progress',    width: 20 },
  { header: 'Approval Status',             key: 'status',      width: 18 },
  { header: 'Supervisor Remarks',          key: 'remarks',     width: 34 },
]
const LAST_COL_LETTER = 'H'
const DATA_START_ROW  = 6   // row where the first data row begins

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────
function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function allBorders(cell: ExcelJS.Cell): void {
  cell.border = { top: C.THIN, bottom: C.THIN, left: C.THIN, right: C.THIN }
}

function medBorders(cell: ExcelJS.Cell): void {
  cell.border = { top: C.MED, bottom: C.MED, left: C.MED, right: C.MED }
}

/** Replace null / blank values with a clear flag text for the reader. */
function orMissed(v: string | null | undefined): string {
  const s = v?.toString().trim()
  return s ? s : 'Missed / Unlogged'
}

/** Format a YYYY-MM-DD string to a human-readable label, e.g. "Mon, Jul 11 2026". */
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return String(d).substring(0, 10)
  }
}

/** Today formatted as "Jul 11, 2026". */
function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

/** Today formatted as YYYYMMDD for the filename. */
function todayFileStamp(): string {
  return new Date().toISOString().split('T')[0].replace(/-/g, '')
}

/**
 * Dynamically measure the longest text in each column and return a map of
 * column index (1-based) → recommended width.  Falls back to the configured
 * minimum width so no column is narrower than its header.
 */
function measureColumnWidths(
  ws: ExcelJS.Worksheet,
  dataStartRow: number,
  dataEndRow: number,
): void {
  COLUMNS.forEach((colDef, idx) => {
    const col = ws.getColumn(idx + 1)
    let max = colDef.header.length + 4   // header length + padding

    for (let r = dataStartRow; r <= dataEndRow; r++) {
      const cell = ws.getRow(r).getCell(idx + 1)
      const val  = cell.value
      if (val === null || val === undefined) continue
      let len: number
      if (typeof val === 'object' && 'formula' in val) {
        len = 10   // formula cells — assume short result
      } else {
        len = String(val).length
      }
      if (len > max) max = len
    }

    col.width = Math.min(max + 2, 60)   // cap at 60 chars to prevent runaway columns
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employee/export-report
// Session-bound: returns only the authenticated user's own work log records.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(_req: Request) {
  // ── 1. Authenticate — extract session from server-side cookie ────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    )
  }

  // ── 2. Resolve full employee profile (name, department, role) ────────────
  const admin = createAdminClient()
  const { data: employee, error: empError } = await admin
    .from('employees')
    .select('id, full_name, department, role')
    .eq('id', user.id)
    .maybeSingle()

  if (empError || !employee) {
    return NextResponse.json(
      { error: 'Employee profile not found.' },
      { status: 404 },
    )
  }

  // ── 3. Fetch all work logs for this employee, newest first ───────────────
  // Join daily_work_log_reviews so approval_status reflects the latest
  // decision recorded by the admin — the base row's approval_status field
  // is never updated by the review flow.
  const { data: logs, error: logsError } = await admin
    .from('daily_work_logs')
    .select(
      'id, log_date, office_entrance_time, office_leave_time, actual_working_hour, ' +
      'assigned_tasks, actual_work_done, completion_percentage, remark, ' +
      'daily_work_log_reviews(approval_status, head_comments, reviewed_at)',
    )
    .eq('employee_id', employee.id)
    .order('log_date', { ascending: false })

  if (logsError) {
    console.error('[export-report] DB fetch error:', logsError.message)
    return NextResponse.json(
      { error: 'Failed to retrieve work log records.' },
      { status: 500 },
    )
  }

  // Flatten the most-recent review onto each log row (same logic as the
  // GET /api/daily-work-logs handler so both views are consistent).
  const allRows = (logs ?? []).map((log: any) => {
    const reviews: any[] = log.daily_work_log_reviews ?? []
    const latestReview = reviews.sort(
      (a: any, b: any) =>
        new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime(),
    )[0]
    return {
      ...log,
      daily_work_log_reviews: undefined,
      approval_status: latestReview?.approval_status ?? 'Pending',
      head_comments:   latestReview?.head_comments   ?? null,
      reviewed_at:     latestReview?.reviewed_at     ?? null,
    }
  })

  // ── Deduplicate resubmission pairs ───────────────────────────────────────
  // When an employee corrects a returned log, the DB keeps the old Returned
  // row AND gains a new row for the same date. We must suppress the old
  // Returned row so each date only shows the most-recent meaningful entry.
  //
  // Rule (mirrors employee-workspace.tsx):
  //   For a given log_date, if ANY non-Returned row exists, hide all Returned
  //   rows for that date — they have been superseded by the correction.
  const datesWithNonReturned = new Set<string>(
    allRows
      .filter((r: any) => r.approval_status !== 'Returned')
      .map((r: any) => r.log_date as string),
  )

  const rows = allRows.filter(
    (r: any) =>
      !(r.approval_status === 'Returned' && datesWithNonReturned.has(r.log_date)),
  )

  // ── 4. Build workbook ─────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'EF Architects & Engineers Consulting'
  wb.created  = new Date()
  wb.modified = new Date()

  const ws = wb.addWorksheet('My Work Log')
  ws.views = [{ showGridLines: true, zoomScale: 100, state: 'frozen', xSplit: 0, ySplit: 5 }]

  // Set column widths from the layout config (auto-adjusted later)
  COLUMNS.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 1 — Corporate banner title
  // ═══════════════════════════════════════════════════════════════════════════
  ws.mergeCells(`A1:${LAST_COL_LETTER}1`)
  const titleCell = ws.getCell('A1')
  titleCell.value = 'EF Architects & Engineers Consulting — Personal Attendance & Work Log Summary'
  titleCell.font  = { name: 'Calibri', size: 14, bold: true, color: { argb: C.NAVY_FG } }
  titleCell.fill  = solidFill(C.NAVY_BG)
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
  ws.getRow(1).height = 38

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 2 — Blank spacer
  // ═══════════════════════════════════════════════════════════════════════════
  ws.mergeCells(`A2:${LAST_COL_LETTER}2`)
  ws.getCell('A2').fill = solidFill('FFF1F5F9')
  ws.getRow(2).height   = 6

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 3 — Employee context panel
  // ═══════════════════════════════════════════════════════════════════════════
  ws.getRow(3).height = 22

  // A3:D3 — Employee profile label
  ws.mergeCells('A3:D3')
  const empCell = ws.getCell('A3')
  empCell.value = `Employee Profile:  ${employee.full_name}  ·  ${employee.department}`
  empCell.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.DARK_FG } }
  empCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // E3:H3 — Report generation date
  ws.mergeCells('E3:H3')
  const dateCell = ws.getCell('E3')
  dateCell.value = `Report Generated On:  ${todayLabel()}`
  dateCell.font  = { name: 'Calibri', size: 10, italic: true, color: { argb: C.MUTED_FG } }
  dateCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 4 — Thin separator line
  // ═══════════════════════════════════════════════════════════════════════════
  ws.mergeCells(`A4:${LAST_COL_LETTER}4`)
  ws.getCell('A4').fill = solidFill(C.NAVY_BG)
  ws.getRow(4).height   = 3

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW 5 — Column headers
  // ═══════════════════════════════════════════════════════════════════════════
  ws.getRow(5).height = 28
  COLUMNS.forEach((col, idx) => {
    const cell  = ws.getRow(5).getCell(idx + 1)
    cell.value  = col.header
    cell.font   = { name: 'Calibri', size: 11, bold: true, color: { argb: C.SLATE_HDR_FG } }
    cell.fill   = solidFill(C.SLATE_HDR_BG)
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    medBorders(cell)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ROWS 6+ — Data rows
  // ═══════════════════════════════════════════════════════════════════════════
  rows.forEach((log, i) => {
    const rowNum  = DATA_START_ROW + i
    const row     = ws.getRow(rowNum)
    row.height    = 20
    const band    = i % 2 === 0 ? C.BAND_A : C.BAND_B

    // ── Col A: Date ─────────────────────────────────────────────────────────
    const dateC = row.getCell(1)
    dateC.value = fmtDate(log.log_date)
    dateC.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
    dateC.fill  = solidFill(band)
    dateC.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(dateC)

    // ── Col B: Biometric In (office_entrance_time) ───────────────────────────
    const inCell = row.getCell(2)
    inCell.value = orMissed(log.office_entrance_time)
    inCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
    inCell.fill  = solidFill(band)
    inCell.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(inCell)

    // ── Col C: Biometric Out (office_leave_time) ─────────────────────────────
    const outCell = row.getCell(3)
    outCell.value = orMissed(log.office_leave_time)
    outCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
    outCell.fill  = solidFill(band)
    outCell.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(outCell)

    // ── Col D: Computed Shift Hours ──────────────────────────────────────────
    const hoursCell = row.getCell(4)
    const hoursVal  = log.actual_working_hour != null
      ? parseFloat(String(log.actual_working_hour))
      : null
    hoursCell.value = hoursVal !== null ? hoursVal : '—'
    hoursCell.numFmt = hoursVal !== null ? '0.00' : '@'
    hoursCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
    hoursCell.fill  = solidFill(band)
    hoursCell.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(hoursCell)

    // ── Col E: Task Summary / Description ───────────────────────────────────
    // Prefer actual_work_done; fall back to assigned_tasks for context
    const taskText = [log.actual_work_done, log.assigned_tasks]
      .map(v => v?.trim())
      .filter(Boolean)
      .join(' / ') || 'Missed / Unlogged'
    const taskCell = row.getCell(5)
    taskCell.value = taskText
    taskCell.font  = { name: 'Calibri', size: 9, color: { argb: C.BLACK_FG } }
    taskCell.fill  = solidFill(band)
    taskCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }
    allBorders(taskCell)

    // ── Col F: % Progress Complete ───────────────────────────────────────────
    // The DB stores this as a decimal fraction (0.0–1.0).
    // ExcelJS's '0%' format multiplies by 100 for display, so we pass the
    // raw decimal directly — no manual / 100 needed.
    const pctCell = row.getCell(6)
    const pctVal  = log.completion_percentage != null
      ? parseFloat(String(log.completion_percentage))
      : null
    pctCell.value  = pctVal !== null ? pctVal : '—'
    pctCell.numFmt = pctVal !== null ? '0%' : '@'
    pctCell.font   = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
    pctCell.fill   = solidFill(band)
    pctCell.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(pctCell)

    // ── Col G: Approval Status — colour-coded badge ──────────────────────────
    const statusVal = (log.approval_status ?? '').toString().trim()
    let statusBg = band
    let statusFg = C.BLACK_FG
    let statusBold = false
    if (statusVal === 'Approved') {
      statusBg = C.APPROVED_BG; statusFg = C.APPROVED_FG; statusBold = true
    } else if (statusVal === 'Pending') {
      statusBg = C.PENDING_BG;  statusFg = C.PENDING_FG;  statusBold = true
    } else if (statusVal === 'Returned' || statusVal === 'Rejected') {
      statusBg = C.REJECTED_BG; statusFg = C.REJECTED_FG; statusBold = true
    }
    const statusCell = row.getCell(7)
    statusCell.value = statusVal || '—'
    statusCell.font  = { name: 'Calibri', size: 10, bold: statusBold, color: { argb: statusFg } }
    statusCell.fill  = solidFill(statusBg)
    statusCell.alignment = { vertical: 'middle', horizontal: 'center' }
    allBorders(statusCell)

    // ── Col H: Supervisor Remarks (head_comments → remark fallback) ──────────
    const remarkText = [log.head_comments, log.remark]
      .map(v => v?.trim())
      .filter(Boolean)
      .join(' · ') || '—'
    const remarkCell = row.getCell(8)
    remarkCell.value = remarkText
    remarkCell.font  = {
      name: 'Calibri', size: 9,
      italic: remarkText === '—',
      color: { argb: remarkText === '—' ? C.MUTED_FG : C.BLACK_FG },
    }
    remarkCell.fill  = solidFill(band)
    remarkCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }
    allBorders(remarkCell)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Summary footer — placed 2 rows below the last data row
  // ═══════════════════════════════════════════════════════════════════════════
  const dataEndRow    = DATA_START_ROW + rows.length - 1
  const footerStartRow = dataEndRow + 2   // one blank gap row

  if (rows.length > 0) {
    // ── Total Operational Hours Worked ──────────────────────────────────────
    const totalHoursRow = ws.getRow(footerStartRow)
    totalHoursRow.height = 20

    ws.mergeCells(`A${footerStartRow}:C${footerStartRow}`)
    const labelHours = totalHoursRow.getCell(1)
    labelHours.value = 'Total Operational Hours Worked'
    labelHours.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.FOOTER_FG } }
    labelHours.alignment = { vertical: 'middle', horizontal: 'right' }

    const sumCell = totalHoursRow.getCell(4)
    sumCell.value  = { formula: `SUM(D${DATA_START_ROW}:D${dataEndRow})` }
    sumCell.numFmt = '0.00'
    sumCell.font   = { name: 'Calibri', size: 10, bold: true, color: { argb: C.FOOTER_FG } }
    sumCell.fill   = solidFill('FFEFF6FF')
    sumCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
    allBorders(sumCell)

    // ── Average Task Completion Rate ────────────────────────────────────────
    const avgRow = ws.getRow(footerStartRow + 1)
    avgRow.height = 20

    ws.mergeCells(`A${footerStartRow + 1}:C${footerStartRow + 1}`)
    const labelAvg = avgRow.getCell(1)
    labelAvg.value = 'Average Task Completion Rate'
    labelAvg.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.FOOTER_FG } }
    labelAvg.alignment = { vertical: 'middle', horizontal: 'right' }

    const avgCell = avgRow.getCell(6)
    avgCell.value  = { formula: `AVERAGE(F${DATA_START_ROW}:F${dataEndRow})` }
    avgCell.numFmt = '0%'
    avgCell.font   = { name: 'Calibri', size: 10, bold: true, color: { argb: C.FOOTER_FG } }
    avgCell.fill   = solidFill('FFEFF6FF')
    avgCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
    allBorders(avgCell)
  }

  // ── Empty-state notice when employee has no logs yet ─────────────────────
  if (rows.length === 0) {
    ws.mergeCells(`A${DATA_START_ROW}:${LAST_COL_LETTER}${DATA_START_ROW}`)
    const emptyCell = ws.getCell(`A${DATA_START_ROW}`)
    emptyCell.value = 'No work log records found for this employee.'
    emptyCell.font  = { name: 'Calibri', size: 11, italic: true, color: { argb: C.MUTED_FG } }
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(DATA_START_ROW).height = 28
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Post-population: auto-fit column widths
  // ═══════════════════════════════════════════════════════════════════════════
  const lastDataRow = rows.length > 0 ? dataEndRow : DATA_START_ROW
  measureColumnWidths(ws, DATA_START_ROW, lastDataRow)

  // ── 5. Stream buffer as downloadable .xlsx attachment ─────────────────────
  const buffer     = Buffer.from(await wb.xlsx.writeBuffer())
  const fileDate   = todayFileStamp()
  const safeSlug   = employee.full_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
  const filename   = `My_Work_Log_Report_${safeSlug}_${fileDate}.xlsx`

  return new NextResponse(buffer, {
    status:  200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
