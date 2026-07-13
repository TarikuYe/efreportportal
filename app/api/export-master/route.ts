import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function checkDGM(userId: string) {
  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees').select('role').eq('id', userId).maybeSingle()
  return employee?.role === 'dgm' || employee?.role === 'gm'
}

// ── Colour palette (AARRGGBB) — unified with EOT / bonds / performance / correspondence ──
const C = {
  NAVY_BG:   'FF1E3A8A',
  NAVY_FG:   'FFFFFFFF',
  SLATE_BG:  'FFE2E8F0',
  BLACK_FG:  'FF111827',
  GRAY_FG:   'FF475569',
  MUTED_FG:  'FF64748B',
  BAND_A:    'FFFFFFFF',
  BAND_B:    'FFF8FAFC',
  MARGIN_BG: 'FFFFFFFF',
  // Status fills
  SUCCESS_BG: 'FFF0FDF4', SUCCESS_FG: 'FF166534',
  WARNING_BG: 'FFFEF3C7', WARNING_FG: 'FF92400E',
  DANGER_BG:  'FFFEE2E2', DANGER_FG:  'FF991B1B',
  INFO_BG:    'FFDBEAFE', INFO_FG:    'FF1D4ED8',
  NEUTRAL_BG: 'FFF3F4F6', NEUTRAL_FG: 'FF374151',
  // Performance tier fills (exact 5-tier scale)
  A_BG: 'FFD1FAE5', A_FG: 'FF065F46',
  B_BG: 'FFDBEAFE', B_FG: 'FF1D4ED8',
  C_BG: 'FFFEF9C3', C_FG: 'FF713F12',
  D_BG: 'FFFEF3C7', D_FG: 'FF92400E',
  E_BG: 'FFFEE2E2', E_FG: 'FF991B1B',
  THIN: { style: 'thin'   as const },
  MED:  { style: 'medium' as const },
}

// ── Shared cell helpers ───────────────────────────────────
function sf(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}
function ab(cell: ExcelJS.Cell) {
  cell.border = { top: C.THIN, bottom: C.THIN, left: C.THIN, right: C.THIN }
}
function mb(cell: ExcelJS.Cell) {
  cell.border = { top: C.MED, bottom: C.MED, left: C.MED, right: C.MED }
}
function applyStatus(cell: ExcelJS.Cell, bg: string, fg: string) {
  cell.fill = sf(bg)
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: fg } }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  ab(cell)
}

// ── Sheet banner builder (rows 1-5, frozen through row 5) ─
// Row 1: navy title banner (full width A→lastCol)
// Row 2: slate spacer
// Row 3: "Prepared By" left + "As of Date" right
// Row 4: KPI bar  (caller provides kpiDefs)
// Row 5: column headers
function buildSheetHeader(
  ws: ExcelJS.Worksheet,
  title: string,
  preparedBy: string,
  asOfDate: string,
  lastColLetter: string,
  kpiDefs: { label: string; value: string | number; bg: string; fg: string }[],
  headers: string[],
  firstDataCol: number,   // 1-indexed col where table headers start (after margin cols)
  marginCols: number      // how many left-margin cols (A, B …) to white-fill
) {
  const lastColIdx = ws.columnCount || (firstDataCol + headers.length - 1)

  // ROW 1 — banner
  ws.mergeCells(`A1:${lastColLetter}1`)
  const t = ws.getCell('A1')
  t.value     = `EF Architects & Engineers Consulting — ${title}`
  t.font      = { name: 'Calibri', size: 14, bold: true, color: { argb: C.NAVY_FG } }
  t.fill      = sf(C.NAVY_BG)
  t.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 38

  // ROW 2 — spacer
  ws.mergeCells(`A2:${lastColLetter}2`)
  ws.getCell('A2').fill = sf('FFF1F5F9')
  ws.getRow(2).height   = 6

  // ROW 3 — metadata
  ws.getRow(3).height = 22
  const midCol    = Math.ceil((firstDataCol + firstDataCol + headers.length - 1) / 2)
  const midLetter = colLetter(midCol)
  ws.mergeCells(`${colLetter(firstDataCol)}3:${midLetter}3`)
  const prep     = ws.getCell(`${colLetter(firstDataCol)}3`)
  prep.value     = `Prepared By: ${preparedBy}`
  prep.font      = { name: 'Calibri', size: 10, italic: true, color: { argb: C.GRAY_FG } }
  prep.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  prep.fill      = sf('FFF8FAFC')

  const rightStart = colLetter(midCol + 1)
  ws.mergeCells(`${rightStart}3:${lastColLetter}3`)
  const dt     = ws.getCell(`${rightStart}3`)
  dt.value     = `As of Date: ${asOfDate}`
  dt.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: C.BLACK_FG } }
  dt.alignment = { vertical: 'middle', horizontal: 'right' }
  dt.fill      = sf('FFF8FAFC')
  for (let m = 1; m <= marginCols; m++) ws.getCell(`${colLetter(m)}3`).fill = sf(C.MARGIN_BG)

  // ROW 4 — KPI bar
  ws.getRow(4).height = 24
  const kpiColSpan = Math.floor(headers.length / kpiDefs.length)
  kpiDefs.forEach((k, i) => {
    const startIdx = firstDataCol + i * kpiColSpan
    const endIdx   = i === kpiDefs.length - 1
      ? firstDataCol + headers.length - 1
      : startIdx + kpiColSpan - 1
    const startL   = colLetter(startIdx)
    const endL     = colLetter(endIdx)
    if (startIdx !== endIdx) ws.mergeCells(`${startL}4:${endL}4`)
    const cell     = ws.getCell(`${startL}4`)
    cell.value     = `${k.label}:  ${k.value}`
    cell.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: k.fg } }
    cell.fill      = sf(k.bg)
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    mb(cell)
  })
  for (let m = 1; m <= marginCols; m++) ws.getCell(`${colLetter(m)}4`).fill = sf(C.MARGIN_BG)

  // ROW 5 — column headers
  ws.getRow(5).height = 28
  headers.forEach((h, i) => {
    const cell = ws.getRow(5).getCell(firstDataCol + i)
    cell.value     = h
    cell.font      = { name: 'Calibri', size: 11, bold: true, color: { argb: C.BLACK_FG } }
    cell.fill      = sf(C.SLATE_BG)
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border    = { top: C.MED, bottom: C.MED, left: C.THIN, right: C.THIN }
  })
  for (let m = 1; m <= marginCols; m++) ws.getCell(`${colLetter(m)}5`).fill = sf(C.MARGIN_BG)

  // Freeze through header row
  ws.views = [{ showGridLines: true, zoomScale: 100, state: 'frozen', xSplit: 0, ySplit: 5 }]
}

// ── Col index → letter ────────────────────────────────────
function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// ── Footer row ────────────────────────────────────────────
function addFooter(ws: ExcelJS.Worksheet, rowNum: number, lastColLetter: string, asOfDate: string) {
  ws.mergeCells(`A${rowNum}:${lastColLetter}${rowNum}`)
  const f     = ws.getCell(`A${rowNum}`)
  f.value     = `Generated: ${asOfDate}  |  EF Architects & Engineers Consulting PLC  |  Master Log Export`
  f.font      = { name: 'Calibri', size: 8, italic: true, color: { argb: C.MUTED_FG } }
  f.fill      = sf(C.SLATE_BG)
  f.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(rowNum).height = 14
}

// ── Fill margin cols for a data row ──────────────────────
function fillMargins(ws: ExcelJS.Worksheet, rowNum: number, count: number) {
  for (let m = 1; m <= count; m++) ws.getCell(`${colLetter(m)}${rowNum}`).fill = sf(C.MARGIN_BG)
}

// ── GET /api/export-master ────────────────────────────────
export async function GET(_req: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await checkDGM(user.id)))
      return NextResponse.json({ error: 'DGM access required.' }, { status: 403 })

    const admin     = createAdminClient()
    const today     = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO  = today.toISOString().split('T')[0]
    const asOfDate  = today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    const fileDate  = todayISO.replace(/-/g, '')

    // 2. Fetch all data in parallel
    const [
      { data: rawLogs },
      { data: letters },
      { data: bonds },
      { data: eots },
      { data: evals },
    ] = await Promise.all([
      admin.from('daily_work_logs')
        .select('*, employees(full_name, email, department), daily_work_log_reviews(approval_status, head_comments, reviewed_at)')
        .order('log_date', { ascending: false }),
      admin.from('correspondence_register').select('*').order('date_logged', { ascending: false }),
      admin.from('project_bonds').select('*').order('expiry_date', { ascending: true }),
      admin.from('eot_tracker').select('*').order('revised_completion_date', { ascending: true }),
      admin.from('performance_evaluations')
        .select('*, employees(full_name, email, department)')
        .order('evaluation_period_end', { ascending: false }),
    ])

    // Flatten latest review onto each log, keep only Approved
    const logs = (rawLogs ?? [])
      .map((log: any) => {
        const reviews: any[] = log.daily_work_log_reviews ?? []
        const latest = reviews.sort(
          (a: any, b: any) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
        )[0]
        return {
          ...log,
          daily_work_log_reviews: undefined,
          approval_status: latest?.approval_status ?? 'Pending',
          head_comments:   latest?.head_comments   ?? null,
        }
      })
      .filter((log: any) => log.approval_status === 'Approved')
      .sort((a: any, b: any) => {
        const na = (a.employees?.full_name ?? '').toLowerCase()
        const nb = (b.employees?.full_name ?? '').toLowerCase()
        if (na < nb) return -1
        if (na > nb) return  1
        return (b.log_date ?? '') < (a.log_date ?? '') ? -1 : 1
      })

    // 3. Build workbook
    const wb = new ExcelJS.Workbook()
    wb.creator  = 'EF Architects & Engineers Consulting PLC'
    wb.created  = new Date()
    wb.modified = new Date()

    const pad = (n: number) => String(n).padStart(2, '0')
    const nowTimestamp = (() => {
      const d = new Date()
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
    })()

    // ════════════════════════════════════════════════════════
    // SHEET 0 — Audit Diagnostics
    // Layout: col A = margin (width 2), cols B–D = content
    // Rows: 1=banner, 2=spacer, 3=metadata, 4=content header, 5+=rows
    // ════════════════════════════════════════════════════════
    const wsDiag = wb.addWorksheet('Audit Diagnostics')
    wsDiag.views = [{ showGridLines: true, zoomScale: 100, state: 'frozen', xSplit: 0, ySplit: 4 }]
    wsDiag.getColumn('A').width = 3
    wsDiag.getColumn('B').width = 38
    wsDiag.getColumn('C').width = 58

    // Row 1 — banner
    wsDiag.mergeCells('A1:C1')
    const diagTitle = wsDiag.getCell('A1')
    diagTitle.value     = 'EF Architects & Engineers Consulting — Executive Audit & Verification Log'
    diagTitle.font      = { name: 'Calibri', size: 14, bold: true, color: { argb: C.NAVY_FG } }
    diagTitle.fill      = sf(C.NAVY_BG)
    diagTitle.alignment = { vertical: 'middle', horizontal: 'center' }
    wsDiag.getRow(1).height = 38

    // Row 2 — spacer
    wsDiag.mergeCells('A2:C2')
    wsDiag.getCell('A2').fill = sf('FFF1F5F9')
    wsDiag.getRow(2).height   = 6

    // Row 3 — metadata bar
    wsDiag.getRow(3).height = 22
    wsDiag.getCell('A3').fill = sf(C.MARGIN_BG)
    wsDiag.mergeCells('B3:C3')
    const diagMeta     = wsDiag.getCell('B3')
    diagMeta.value     = `DGM Executive Export  |  As of Date: ${asOfDate}  |  ${nowTimestamp}`
    diagMeta.font      = { name: 'Calibri', size: 10, italic: true, color: { argb: C.GRAY_FG } }
    diagMeta.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    diagMeta.fill      = sf('FFF8FAFC')

    // Row 4 — column headers
    wsDiag.getRow(4).height = 24
    wsDiag.getCell('A4').fill = sf(C.MARGIN_BG)
    ;['Audit Parameter', 'Audit Evidence / Value'].forEach((h, i) => {
      const cell     = wsDiag.getRow(4).getCell(2 + i)
      cell.value     = h
      cell.font      = { name: 'Calibri', size: 11, bold: true, color: { argb: C.BLACK_FG } }
      cell.fill      = sf(C.SLATE_BG)
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border    = { top: C.MED, bottom: C.MED, left: C.THIN, right: C.THIN }
    })

    // Rows 5+ — audit data
    const diagRows: [string, string, string, string][] = [
      // [param, value, valueBg, valueFg]
      ['Audit Review Status',              'VERIFIED & LOCKED',                              'FFBBF7D0', 'FF166534'],
      ['Audit Review Completed (DGM)',     nowTimestamp,                                     C.BAND_B,   C.BLACK_FG],
      ['DB Filter Enforcement',            "daily_work_log_reviews latest per log → 'Approved'", C.BAND_B, C.BLACK_FG],
      ['System Verification Signature',   'DGM CONTROL TOWER EXECUTIVE SECURE EXPORT GATE', C.BAND_B,   C.BLACK_FG],
      ['Export Date (ISO)',                todayISO,                                          C.BAND_B,   C.BLACK_FG],
      ['Total Approved Logs Exported',     String(logs.length),                              C.INFO_BG,  C.INFO_FG],
      ['Total Correspondence Records',     String((letters ?? []).length),                   C.BAND_B,   C.BLACK_FG],
      ['Total Bond Records',               String((bonds ?? []).length),                     C.BAND_B,   C.BLACK_FG],
      ['Total EOT Records',                String((eots ?? []).length),                      C.BAND_B,   C.BLACK_FG],
      ['Total Performance Evaluations',    String((evals ?? []).length),                     C.BAND_B,   C.BLACK_FG],
    ]
    diagRows.forEach(([param, value, vBg, vFg], i) => {
      const rowNum = 5 + i
      const row    = wsDiag.getRow(rowNum)
      row.height   = 20
      wsDiag.getCell(`A${rowNum}`).fill = sf(C.MARGIN_BG)
      const pCell     = row.getCell(2)
      pCell.value     = param
      pCell.font      = { name: 'Calibri', size: 10, bold: false, color: { argb: C.BLACK_FG } }
      pCell.fill      = sf(i % 2 === 0 ? C.BAND_A : C.BAND_B)
      pCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      ab(pCell)
      const vCell     = row.getCell(3)
      vCell.value     = value
      vCell.font      = { name: 'Calibri', size: 10, bold: i === 0, color: { argb: vFg } }
      vCell.fill      = sf(vBg)
      vCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      ab(vCell)
    })

    // Footer
    const diagFooterRow = 5 + diagRows.length
    addFooter(wsDiag, diagFooterRow, 'C', asOfDate)

    // ════════════════════════════════════════════════════════
    // SHEET 1 — Daily Work Logs
    // Cols A+B = margin, table C→R (15 data cols, 1-indexed 3→17)
    // ════════════════════════════════════════════════════════
    const wsLogs = wb.addWorksheet('Daily Work Logs')

    // Column widths: A  B   C    D    E    F    G    H    I    J    K    L    M    N    O    P    Q
    const logWidths = [3, 3, 13, 11, 22, 18, 32, 32, 10, 12, 9,  8,  11, 11, 16, 18, 22]
    logWidths.forEach((w, i) => { wsLogs.getColumn(i + 1).width = w })

    const totalLogs    = logs.length
    const homeLogs     = logs.filter((l: any) => l.done_at_home).length
    const avgHours     = totalLogs > 0
      ? (logs.reduce((s: number, l: any) => s + Number(l.hours_worked ?? 0), 0) / totalLogs).toFixed(1)
      : '0.0'
    const deptSet      = new Set(logs.map((l: any) => l.employees?.department).filter(Boolean))

    buildSheetHeader(
      wsLogs,
      'Daily Work Logs — Approved Entries',
      'Human Resources & Procurement Department',
      asOfDate,
      'Q',
      [
        { label: `Total Logs`,     value: totalLogs,        bg: C.NAVY_BG,    fg: C.NAVY_FG },
        { label: `Departments`,    value: deptSet.size,     bg: 'FF0F766E',   fg: C.NAVY_FG },
        { label: `Avg Hrs/Day`,    value: avgHours,         bg: 'FF1E40AF',   fg: C.NAVY_FG },
        { label: `Done at Home`,   value: homeLogs,         bg: 'FF6B21A8',   fg: C.NAVY_FG },
        { label: `✅ Approved`,    value: totalLogs,        bg: 'FF166534',   fg: C.NAVY_FG },
      ],
      [
        'S/N', 'Log Date', 'Day', 'Employee', 'Department',
        'Assigned Tasks', 'Actual Work Done',
        'Hours\nWorked', 'Onsite\nHours', 'Completion\n%',
        'Home?', 'Entrance', 'Leave',
        'Approval', 'Comments', 'Remark',
      ],
      3,   // firstDataCol = C (index 3)
      2    // 2 margin cols (A, B)
    )

    // Rows 6+ — data
    if (logs.length === 0) {
      wsLogs.mergeCells('C6:Q6')
      const msg     = wsLogs.getCell('C6')
      msg.value     = 'No approved work log entries found for this period.'
      msg.font      = { name: 'Calibri', size: 11, bold: true, color: { argb: C.WARNING_FG } }
      msg.fill      = sf(C.WARNING_BG)
      msg.alignment = { vertical: 'middle', horizontal: 'center' }
      wsLogs.getRow(6).height = 36
      fillMargins(wsLogs, 6, 2)
    } else {
      logs.forEach((log: any, idx: number) => {
        const rowNum = 6 + idx
        const row    = wsLogs.getRow(rowNum)
        row.height   = 22
        fillMargins(wsLogs, rowNum, 2)
        const emp  = log.employees ?? {}
        const band = idx % 2 === 0 ? C.BAND_A : C.BAND_B

        const vals: [number, any, string, boolean][] = [
          // [colOffset, value, align, wrapText]
          [0,  idx + 1,                          'center', false],
          [1,  log.log_date,                     'center', false],
          [2,  log.day_of_week,                  'center', false],
          [3,  emp.full_name    ?? '—',          'left',   false],
          [4,  emp.department   ?? '—',          'left',   false],
          [5,  log.assigned_tasks,               'left',   true ],
          [6,  log.actual_work_done,             'left',   true ],
          [7,  Number(log.hours_worked),         'right',  false],
          [8,  Number(log.actual_working_hour),  'right',  false],
          [9,  Number(log.completion_percentage),'right',  false],
          [10, log.done_at_home ? 'Yes' : 'No', 'center', false],
          [11, log.office_entrance_time ?? '—', 'center', false],
          [12, log.office_leave_time    ?? '—', 'center', false],
          [13, log.approval_status,             'center', false],
          [14, log.head_comments        ?? '—', 'left',   true ],
          [15, log.remark               ?? '—', 'left',   true ],
        ]

        vals.forEach(([offset, value, align, wrap]) => {
          const cell     = row.getCell(3 + offset)
          cell.value     = value
          cell.font      = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
          cell.fill      = sf(band)
          cell.alignment = { vertical: 'middle', horizontal: align as any, wrapText: wrap }
          ab(cell)
        })

        // numFmt
        row.getCell(4).numFmt  = 'yyyy-mm-dd'
        row.getCell(10).numFmt = '0.00'
        row.getCell(11).numFmt = '0.00'
        row.getCell(12).numFmt = '0%'

        // Approval status pill
        const sc = row.getCell(16)
        if (log.approval_status === 'Approved')  applyStatus(sc, C.SUCCESS_BG, C.SUCCESS_FG)
        else if (log.approval_status === 'Returned') applyStatus(sc, C.DANGER_BG, C.DANGER_FG)
        else                                      applyStatus(sc, C.WARNING_BG, C.WARNING_FG)
      })
    }

    addFooter(wsLogs, 6 + Math.max(logs.length, 1) + 1, 'Q', asOfDate)

    // ════════════════════════════════════════════════════════
    // SHEET 2 — Correspondence Register
    // Cols A+B = margin, table C→N (12 data cols)
    // ════════════════════════════════════════════════════════
    const wsCorr = wb.addWorksheet('Correspondence Register')

    //                    A  B   C    D    E    F    G    H    I    J    K    L    M    N
    const corrWidths = [3, 3, 15, 11, 10, 22, 32, 12, 9,  13, 15, 13, 11, 20]
    corrWidths.forEach((w, i) => { wsCorr.getColumn(i + 1).width = w })

    const allLetters   = letters ?? []
    const corrTotal    = allLetters.length
    const corrOutgoing = allLetters.filter((l: any) => l.direction === 'Outgoing').length
    const corrIncoming = allLetters.filter((l: any) => l.direction === 'Incoming').length
    const corrOverdue  = allLetters.filter((l: any) => {
      if (!l.response_required || l.response_sent_date) return false
      return l.response_due_date && l.response_due_date < todayISO
    }).length
    const corrClosed   = allLetters.filter((l: any) => !!l.response_sent_date).length

    buildSheetHeader(
      wsCorr,
      'Correspondence Register',
      'Procurement and Contract Administration Department',
      asOfDate,
      'N',
      [
        { label: 'Total',     value: corrTotal,    bg: C.NAVY_BG,  fg: C.NAVY_FG },
        { label: 'Outgoing',  value: corrOutgoing, bg: 'FFB45309', fg: C.NAVY_FG },
        { label: 'Incoming',  value: corrIncoming, bg: 'FF1E40AF', fg: C.NAVY_FG },
        { label: '🔴 Overdue',value: corrOverdue,  bg: 'FF991B1B', fg: C.NAVY_FG },
        { label: '🟢 Closed', value: corrClosed,   bg: 'FF166534', fg: C.NAVY_FG },
        { label: `Rate`, value: corrTotal > 0 ? `${((corrClosed/corrTotal)*100).toFixed(1)}%` : '0.0%', bg: 'FF0F766E', fg: C.NAVY_FG },
      ],
      ['S/N', 'Letter Ref No', 'Date', 'Direction', 'Counterparty', 'Subject', 'Category', 'Reply Req?', 'Due Date', 'Linked Ref', 'Reply Date', 'Status'],
      3,  // firstDataCol = C
      2   // 2 margin cols
    )

    allLetters.forEach((letter: any, idx: number) => {
      const rowNum = 6 + idx
      const row    = wsCorr.getRow(rowNum)
      row.height   = 20
      fillMargins(wsCorr, rowNum, 2)
      const band = idx % 2 === 0 ? C.BAND_A : C.BAND_B

      let calcStatus = letter.status ?? 'Open'
      if (letter.response_required && !letter.response_sent_date) {
        if (letter.response_due_date && letter.response_due_date < todayISO) calcStatus = 'Overdue'
        else calcStatus = 'Open'
      } else if (letter.response_sent_date) {
        calcStatus = 'Closed'
      } else if (!letter.response_required) {
        calcStatus = 'Not Required'
      }

      const isIncoming = letter.direction === 'Incoming'
      const dirBg      = isIncoming ? C.INFO_BG : 'FFFEF3C7'
      const dirFg      = isIncoming ? C.INFO_FG : 'FFB45309'

      const dataVals: [number, any][] = [
        [0,  idx + 1],
        [1,  letter.letter_ref_no   ?? '—'],
        [2,  letter.date_logged     ?? '—'],
        [3,  letter.direction       ?? '—'],
        [4,  letter.counterparty    ?? '—'],
        [5,  letter.subject         ?? '—'],
        [6,  letter.category        ?? '—'],
        [7,  letter.response_required ? 'Yes' : 'No'],
        [8,  letter.response_due_date  ?? '—'],
        [9,  letter.linked_response_ref ?? '—'],
        [10, letter.response_sent_date ?? '—'],
        [11, calcStatus],
      ]

      dataVals.forEach(([offset, value]) => {
        const cell     = row.getCell(3 + offset)
        cell.value     = value
        cell.font      = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        cell.fill      = sf(band)
        cell.alignment = {
          vertical: 'middle',
          horizontal: offset === 4 || offset === 5 ? 'left' : 'center',
          wrapText: offset === 5,
          indent: offset === 4 || offset === 5 ? 1 : 0,
        }
        ab(cell)
      })

      // Direction pill
      const dirCell     = row.getCell(6)
      dirCell.font      = { name: 'Calibri', size: 9, bold: true, color: { argb: dirFg } }
      dirCell.fill      = sf(dirBg)

      // Status pill
      const sc = row.getCell(14)
      if (calcStatus === 'Closed')       applyStatus(sc, C.SUCCESS_BG, C.SUCCESS_FG)
      else if (calcStatus === 'Overdue') applyStatus(sc, C.DANGER_BG,  C.DANGER_FG)
      else if (calcStatus === 'Open')    applyStatus(sc, C.WARNING_BG, C.WARNING_FG)
      else                               applyStatus(sc, C.NEUTRAL_BG, C.NEUTRAL_FG)
    })

    addFooter(wsCorr, 6 + Math.max(allLetters.length, 1) + 1, 'N', asOfDate)

    // ════════════════════════════════════════════════════════
    // SHEET 3 — Project Bonds
    // Cols A+B = margin, table C→L (10 data cols)
    // ════════════════════════════════════════════════════════
    const wsBonds = wb.addWorksheet('Project Bonds')

    //                     A  B   C    D    E    F    G    H    I    J    K    L
    const bondsWidths = [3, 3, 26, 36, 28, 18, 13, 13, 16, 13, 13, 16]
    bondsWidths.forEach((w, i) => { wsBonds.getColumn(i + 1).width = w })

    const allBonds   = bonds ?? []
    const bondExpired  = allBonds.filter((b: any) => {
      if (b.status === 'Released') return false
      const dr = Math.ceil((new Date(b.expiry_date).setHours(0,0,0,0) - today.getTime()) / 86400000)
      return dr <= 0
    }).length
    const bondExpiring = allBonds.filter((b: any) => {
      if (b.status === 'Released') return false
      const dr = Math.ceil((new Date(b.expiry_date).setHours(0,0,0,0) - today.getTime()) / 86400000)
      return dr > 0 && dr <= 30
    }).length
    const bondSafe     = allBonds.filter((b: any) => {
      if (b.status === 'Released') return false
      const dr = Math.ceil((new Date(b.expiry_date).setHours(0,0,0,0) - today.getTime()) / 86400000)
      return dr > 30
    }).length
    const bondReleased = allBonds.filter((b: any) => b.status === 'Released').length

    buildSheetHeader(
      wsBonds,
      'Project Bonds — Expiry Tracker',
      'Procurement and Contract Administration Department',
      asOfDate,
      'L',
      [
        { label: 'Total Bonds',       value: allBonds.length, bg: C.NAVY_BG,  fg: C.NAVY_FG },
        { label: '🔴 Expired',        value: bondExpired,     bg: 'FF991B1B', fg: C.NAVY_FG },
        { label: '🟡 Expiring ≤30d',  value: bondExpiring,    bg: 'FF92400E', fg: C.NAVY_FG },
        { label: '🟢 Safe',           value: bondSafe,        bg: 'FF14532D', fg: C.NAVY_FG },
        { label: '⚪ Released',        value: bondReleased,    bg: 'FF374151', fg: C.NAVY_FG },
      ],
      ['S/N', 'Employer', 'Project', 'Contractor', 'Bond Type', 'Issue Date', 'Expiry Date', 'Amount (ETB)', 'Days Left', 'Status'],
      3,  // firstDataCol = C
      2
    )

    // ── Group bond rows by employer_name (preserving DB sort order) ──
    // Col C = S/N (merged per employer group), Col D = Employer Name (merged per group),
    // Cols E–L = per-project/bond data written on every row.
    const bondEmployerOrder: string[] = []
    const bondEmployerGroups = new Map<string, any[]>()
    for (const bond of allBonds) {
      const key = (bond.employer_name ?? '—').trim() || '—'
      if (!bondEmployerGroups.has(key)) {
        bondEmployerGroups.set(key, [])
        bondEmployerOrder.push(key)
      }
      bondEmployerGroups.get(key)!.push(bond)
    }

    let bondCurrentRow = 6
    let bondSn = 1

    for (const employerName of bondEmployerOrder) {
      const group      = bondEmployerGroups.get(employerName)!
      const groupStart = bondCurrentRow
      const groupEnd   = bondCurrentRow + group.length - 1

      group.forEach((bond: any, i: number) => {
        const rowNum = bondCurrentRow + i
        const row    = wsBonds.getRow(rowNum)
        row.height   = 22
        fillMargins(wsBonds, rowNum, 2)
        const band = i % 2 === 0 ? C.BAND_A : C.BAND_B

        // ── Col C: S/N — written once, merged for the whole group ──
        if (i === 0) {
          const snCell     = row.getCell(3)
          snCell.value     = bondSn
          snCell.font      = { name: 'Calibri', size: 11, bold: true, color: { argb: C.NAVY_FG } }
          snCell.fill      = sf(C.NAVY_BG)
          snCell.alignment = { vertical: 'middle', horizontal: 'center' }
          ab(snCell)
          if (groupEnd > groupStart) wsBonds.mergeCells(`C${groupStart}:C${groupEnd}`)
        }

        // ── Col D: Employer Name — written once, merged for the whole group ──
        if (i === 0) {
          const empCell     = row.getCell(4)
          empCell.value     = employerName
          empCell.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } }
          empCell.fill      = sf('FFE0E7FF')   // indigo tint — matches EOT SECTION_BG
          empCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
          ab(empCell)
          if (groupEnd > groupStart) wsBonds.mergeCells(`D${groupStart}:D${groupEnd}`)
        }

        // ── Compute days remaining and live status ──
        const expDate = new Date(bond.expiry_date)
        expDate.setHours(0, 0, 0, 0)
        const daysLeft  = Math.ceil((expDate.getTime() - today.getTime()) / 86400000)
        let liveStatus  = bond.status
        if (bond.status !== 'Released') liveStatus = daysLeft <= 0 ? 'Expired' : 'Active'

        // ── Cols E–L: per-bond data (offsets 2–9 → getCell(5)–getCell(12)) ──
        const dataVals: [number, any][] = [
          [2,  bond.project_name    ?? '—'],
          [3,  bond.contractor_name ?? '—'],
          [4,  bond.bond_type       ?? '—'],
          [5,  bond.issue_date      ?? '—'],
          [6,  bond.expiry_date     ?? '—'],
          [7,  bond.amount ? Number(bond.amount) : null],
          [8,  daysLeft],
          [9,  liveStatus],
        ]
        dataVals.forEach(([offset, value]) => {
          const cell     = row.getCell(3 + offset)
          cell.value     = value ?? '—'
          cell.font      = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
          cell.fill      = sf(band)
          cell.alignment = {
            vertical:   'middle',
            horizontal: offset === 2 || offset === 3 ? 'left' : 'center',
            wrapText:   offset === 2,
            indent:     offset === 2 || offset === 3 ? 1 : 0,
          }
          ab(cell)
        })

        // numFmt
        row.getCell(8).numFmt  = 'yyyy-mm-dd'   // Issue Date
        row.getCell(9).numFmt  = 'yyyy-mm-dd'   // Expiry Date
        row.getCell(10).numFmt = '#,##0.00'      // Amount
        row.getCell(11).numFmt = '#,##0'         // Days Left

        // Days left colouring (col K = 3+8=11)
        const dlCell = row.getCell(11)
        if (daysLeft <= 0) {
          dlCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.DANGER_FG } }
          dlCell.fill = sf(C.DANGER_BG)
        } else if (daysLeft <= 30) {
          dlCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.WARNING_FG } }
          dlCell.fill = sf(C.WARNING_BG)
        }

        // Status pill (col L = 3+9=12)
        const sc = row.getCell(12)
        if      (liveStatus === 'Active')   applyStatus(sc, C.SUCCESS_BG, C.SUCCESS_FG)
        else if (liveStatus === 'Expired')  applyStatus(sc, C.DANGER_BG,  C.DANGER_FG)
        else if (liveStatus === 'Released') applyStatus(sc, C.NEUTRAL_BG, C.NEUTRAL_FG)
        else                                applyStatus(sc, C.WARNING_BG, C.WARNING_FG)
      })

      bondCurrentRow = groupEnd + 1
      bondSn++
    }

    addFooter(wsBonds, bondCurrentRow + 1, 'L', asOfDate)

    // ════════════════════════════════════════════════════════
    // SHEET 4 — EOT Tracker
    // Cols A+B = margin, table C→N (12 data cols)
    // ════════════════════════════════════════════════════════
    const wsEots = wb.addWorksheet('EOT Tracker')

    //                    A  B   C    D    E    F    G    H    I    J    K    L    M    N
    const eotWidths = [3, 3, 22, 36, 28, 9,  12, 20, 14, 38, 16, 18, 12, 14]
    eotWidths.forEach((w, i) => { wsEots.getColumn(i + 1).width = w })

    const allEots     = eots ?? []
    const eotExpired  = allEots.filter((e: any) => {
      if (!e.revised_completion_date) return false
      return Math.ceil((new Date(e.revised_completion_date).setHours(0,0,0,0) - today.getTime()) / 86400000) <= 0
    }).length
    const eotNearly   = allEots.filter((e: any) => {
      if (!e.revised_completion_date) return false
      const dr = Math.ceil((new Date(e.revised_completion_date).setHours(0,0,0,0) - today.getTime()) / 86400000)
      return dr > 0 && dr <= 30
    }).length
    const eotOk       = allEots.filter((e: any) => {
      if (!e.revised_completion_date) return false
      return Math.ceil((new Date(e.revised_completion_date).setHours(0,0,0,0) - today.getTime()) / 86400000) > 30
    }).length
    const eotApproved = allEots.filter((e: any) => (e.status ?? '').toLowerCase() === 'approved').length

    buildSheetHeader(
      wsEots,
      'Extension of Time (EOT) Register',
      'Procurement and Contract Administration Department',
      asOfDate,
      'N',
      [
        { label: 'Total EOTs',      value: allEots.length, bg: C.NAVY_BG,  fg: C.NAVY_FG },
        { label: '✅ Approved',     value: eotApproved,    bg: 'FF166534', fg: C.NAVY_FG },
        { label: '🔴 Expired',      value: eotExpired,     bg: 'FF991B1B', fg: C.NAVY_FG },
        { label: '🟡 Nearly Exp.',  value: eotNearly,      bg: 'FF92400E', fg: C.NAVY_FG },
        { label: '🟢 OK',           value: eotOk,          bg: 'FF14532D', fg: C.NAVY_FG },
      ],
      ['S/N', 'Client Name', 'Project Name', 'Contractor', 'EOT No.', 'Days Approved', 'Revised Completion', 'Status', 'Reason for EOT', 'Approved By', 'Remarks', 'EOT Status'],
      3,  // firstDataCol = C
      2
    )

    // ── Group EOT rows by client_name (preserving DB order) ──
    // Same merging pattern as the individual export-eot route:
    // col C = S/N (merged per client group), col D = Client Name (merged per group),
    // cols E–N = per-project data written on every row.
    const eotClientOrder: string[] = []
    const eotClientGroups = new Map<string, any[]>()
    for (const eot of allEots) {
      const key = (eot.client_name ?? '—').trim() || '—'
      if (!eotClientGroups.has(key)) {
        eotClientGroups.set(key, [])
        eotClientOrder.push(key)
      }
      eotClientGroups.get(key)!.push(eot)
    }

    let eotCurrentRow = 6
    let eotSn = 1

    for (const clientName of eotClientOrder) {
      const group      = eotClientGroups.get(clientName)!
      const groupStart = eotCurrentRow
      const groupEnd   = eotCurrentRow + group.length - 1

      group.forEach((eot: any, i: number) => {
        const rowNum = eotCurrentRow + i
        const row    = wsEots.getRow(rowNum)
        row.height   = 20
        fillMargins(wsEots, rowNum, 2)
        // Alternate banding resets per group so each client block is visually distinct
        const band = i % 2 === 0 ? C.BAND_A : C.BAND_B

        // ── Col C: S/N — written once, merged for the whole group ──
        if (i === 0) {
          const snCell     = row.getCell(3)
          snCell.value     = eotSn
          snCell.font      = { name: 'Calibri', size: 11, bold: true, color: { argb: C.NAVY_FG } }
          snCell.fill      = sf(C.NAVY_BG)
          snCell.alignment = { vertical: 'middle', horizontal: 'center' }
          ab(snCell)
          if (groupEnd > groupStart) wsEots.mergeCells(`C${groupStart}:C${groupEnd}`)
        }

        // ── Col D: Client Name — written once, merged for the whole group ──
        if (i === 0) {
          const clientCell     = row.getCell(4)
          clientCell.value     = clientName
          clientCell.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } }
          clientCell.fill      = sf('FFE0E7FF')   // indigo tint — same as EOT SECTION_BG
          clientCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
          ab(clientCell)
          if (groupEnd > groupStart) wsEots.mergeCells(`D${groupStart}:D${groupEnd}`)
        }

        // ── Compute days remaining and alert ──
        let daysLeft: number | null = null
        if (eot.revised_completion_date) {
          const cd = new Date(eot.revised_completion_date)
          cd.setHours(0, 0, 0, 0)
          daysLeft = Math.ceil((cd.getTime() - today.getTime()) / 86400000)
        }
        let eotAlert = '—'
        if (daysLeft !== null) {
          if (daysLeft <= 0)       eotAlert = '🔴 Expired'
          else if (daysLeft <= 30) eotAlert = '🟡 Nearly Expired'
          else                     eotAlert = '🟢 OK'
        }

        // ── Cols E–N: per-project data (offsets 2–11 → getCell(5)–getCell(14)) ──
        // offset 0 = S/N (col C) — handled above as merged group cell
        // offset 1 = Client Name (col D) — handled above as merged group cell
        const dataVals: [number, any][] = [
          [2,  eot.project_name               ?? '—'],
          [3,  eot.contractor_name            ?? '—'],
          [4,  eot.eot_number != null ? Number(eot.eot_number) : '—'],
          [5,  eot.days_approved != null ? Number(eot.days_approved) : '—'],
          [6,  eot.revised_completion_date    ?? '—'],
          [7,  eot.status                     ?? '—'],
          [8,  eot.reason_for_eot             ?? '—'],
          [9,  eot.approved_by               ?? ''],
          [10, eot.remarks                   ?? ''],
          [11, eotAlert],
        ]

        dataVals.forEach(([offset, value]) => {
          const cell = row.getCell(3 + offset)
          cell.value = value
          cell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
          cell.fill  = sf(band)
          cell.alignment = {
            vertical:   'middle',
            horizontal: (offset === 2 || offset === 3 || offset === 8) ? 'left' : 'center',
            wrapText:   offset === 2 || offset === 8,
            indent:     (offset === 2 || offset === 3 || offset === 8) ? 1 : 0,
          }
          ab(cell)
        })

        // numFmt
        row.getCell(9).numFmt  = 'yyyy-mm-dd'   // Revised Completion Date

        // Approval status pill (col J = getCell(3+7=10))
        const sc = row.getCell(10)
        const st = (eot.status ?? '').toLowerCase()
        if      (st === 'approved') applyStatus(sc, C.SUCCESS_BG, C.SUCCESS_FG)
        else if (st === 'rejected') applyStatus(sc, C.DANGER_BG,  C.DANGER_FG)
        else if (st === 'pending')  applyStatus(sc, C.WARNING_BG, C.WARNING_FG)
        else                        applyStatus(sc, C.INFO_BG,    C.INFO_FG)

        // EOT alert pill (col N = getCell(3+11=14))
        const ac = row.getCell(14)
        if      (eotAlert.includes('Expired')) applyStatus(ac, C.DANGER_BG,  C.DANGER_FG)
        else if (eotAlert.includes('Nearly'))  applyStatus(ac, C.WARNING_BG, C.WARNING_FG)
        else if (eotAlert.includes('OK'))      applyStatus(ac, C.SUCCESS_BG, C.SUCCESS_FG)
        else { ac.font = { name: 'Calibri', size: 10, color: { argb: C.MUTED_FG } }; ac.fill = sf(band) }
      })

      eotCurrentRow = groupEnd + 1
      eotSn++
    }

    addFooter(wsEots, eotCurrentRow + 1, 'N', asOfDate)

    // ════════════════════════════════════════════════════════
    // SHEET 5 — Performance Evaluations
    // Cols A+B = margin, table C→P (14 data cols)
    // ════════════════════════════════════════════════════════
    const wsEvals = wb.addWorksheet('Performance Evaluations')

    //                      A  B   C    D    E    F    G    H    I    J    K    L    M    N    O    P
    const evalWidths = [3, 3, 28, 24, 24, 13, 13, 15, 14, 13, 15, 13, 15, 13, 22, 8]
    evalWidths.forEach((w, i) => { wsEvals.getColumn(i + 1).width = w })

    const allEvals  = evals ?? []
    const evalTotal = allEvals.length
    const rankA     = allEvals.filter((e: any) => Number(e.total_score) >= 90).length
    const rankB     = allEvals.filter((e: any) => Number(e.total_score) >= 80 && Number(e.total_score) < 90).length
    const rankC     = allEvals.filter((e: any) => Number(e.total_score) >= 70 && Number(e.total_score) < 80).length
    const rankD     = allEvals.filter((e: any) => Number(e.total_score) >= 60 && Number(e.total_score) < 70).length
    const rankE     = allEvals.filter((e: any) => Number(e.total_score) <  60).length
    const avgScore  = evalTotal > 0
      ? (allEvals.reduce((s: number, e: any) => s + Number(e.total_score ?? 0), 0) / evalTotal).toFixed(1)
      : '0.0'

    buildSheetHeader(
      wsEvals,
      'Performance Evaluations Master Log',
      'Human Resources & Procurement Department',
      asOfDate,
      'P',
      [
        { label: `Total: ${evalTotal}`,              value: '', bg: C.NAVY_BG, fg: C.NAVY_FG },
        { label: `A — Outstanding: ${rankA}`,        value: '', bg: C.A_BG,    fg: C.A_FG },
        { label: `B — Very Good: ${rankB}`,          value: '', bg: C.B_BG,    fg: C.B_FG },
        { label: `C — Good: ${rankC}`,               value: '', bg: C.C_BG,    fg: C.C_FG },
        { label: `D — Satisfactory: ${rankD}`,       value: '', bg: C.D_BG,    fg: C.D_FG },
        { label: `E — Needs Improvement: ${rankE}`,  value: '', bg: C.E_BG,    fg: C.E_FG },
        { label: `Avg Score: ${avgScore}%`,          value: '', bg: C.NAVY_BG, fg: C.NAVY_FG },
      ],
      [
        'Employee Name', 'Email', 'Department',
        'Period Start', 'Period End',
        'Tech\n(40%)', 'Productivity\n(30%)', 'Punctuality\n(10%)',
        'Communication\n(5%)', 'Reporting\n(5%)', 'Adaptability\n(10%)',
        'Total Score', 'Performance Level', 'Grade',
      ],
      3,  // firstDataCol = C
      2
    )

    allEvals.forEach((evalRow: any, idx: number) => {
      const rowNum = 6 + idx
      const row    = wsEvals.getRow(rowNum)
      row.height   = 20
      fillMargins(wsEvals, rowNum, 2)
      const emp   = evalRow.employees ?? {}
      const band  = idx % 2 === 0 ? C.BAND_A : C.BAND_B
      const total = Number(evalRow.total_score ?? 0)

      // Compute weighted contributions
      const w = (raw: number, wt: number) => (raw * wt) / 100
      const tech  = Number(evalRow.tech_competence_score  ?? 0)
      const prod  = Number(evalRow.productivity_score      ?? 0)
      const punc  = Number(evalRow.punctuality_score       ?? 0)
      const comm  = Number(evalRow.communication_score     ?? 0)
      const rep   = Number(evalRow.reporting_score         ?? 0)
      const adapt = Number(evalRow.adaptability_score      ?? 0)

      const grade = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'E'
      const [lvlBg, lvlFg] = total >= 90 ? [C.A_BG, C.A_FG]
        : total >= 80 ? [C.B_BG, C.B_FG]
        : total >= 70 ? [C.C_BG, C.C_FG]
        : total >= 60 ? [C.D_BG, C.D_FG]
        : [C.E_BG, C.E_FG]

      const dataVals: [number, any, string][] = [
        [0,  emp.full_name   ?? '—', 'left'],
        [1,  emp.email       ?? '—', 'left'],
        [2,  emp.department  ?? '—', 'left'],
        [3,  evalRow.evaluation_period_start ?? '—', 'center'],
        [4,  evalRow.evaluation_period_end   ?? '—', 'center'],
        [5,  w(tech, 40),  'center'],
        [6,  w(prod, 30),  'center'],
        [7,  w(punc, 10),  'center'],
        [8,  w(comm,  5),  'center'],
        [9,  w(rep,   5),  'center'],
        [10, w(adapt, 10), 'center'],
        [11, total,        'right'],
      ]

      dataVals.forEach(([offset, value, align]) => {
        const cell = row.getCell(3 + offset)
        cell.value = value
        cell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        cell.fill  = sf(band)
        cell.alignment = { vertical: 'middle', horizontal: align as any, indent: align === 'left' ? 1 : 0 }
        ab(cell)
      })

      // numFmt
      row.getCell(6).numFmt  = 'yyyy-mm-dd'   // period start
      row.getCell(7).numFmt  = 'yyyy-mm-dd'   // period end
      for (let c = 8; c <= 14; c++) row.getCell(c).numFmt = '0.00'

      // Performance Level pill (col O = 3+12=15)
      const lvlCell     = row.getCell(15)
      lvlCell.value     = total < 60 ? `⚠️ ${evalRow.performance_level ?? 'Needs Improvement'}` : (evalRow.performance_level ?? '')
      lvlCell.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: lvlFg } }
      lvlCell.fill      = sf(lvlBg)
      lvlCell.alignment = { vertical: 'middle', horizontal: 'center' }
      ab(lvlCell)

      // Grade pill (col P = 3+13=16)
      const gradeCell     = row.getCell(16)
      gradeCell.value     = grade
      gradeCell.font      = { name: 'Calibri', size: 12, bold: true, color: { argb: lvlFg } }
      gradeCell.fill      = sf(lvlBg)
      gradeCell.alignment = { vertical: 'middle', horizontal: 'center' }
      ab(gradeCell)
    })

    // Legend row
    const legendRow = 6 + Math.max(allEvals.length, 1) + 1
    wsEvals.getRow(legendRow).height = 18
    const legendDefs: [string, number, number, string, string][] = [
      ['A — 90–100 · Outstanding',          3,  4,  C.A_BG, C.A_FG],
      ['B — 80–89  · Very Good',            5,  7,  C.B_BG, C.B_FG],
      ['C — 70–79  · Good',                 8, 10,  C.C_BG, C.C_FG],
      ['D — 60–69  · Satisfactory',        11, 13,  C.D_BG, C.D_FG],
      ['E — < 60   · Needs Improvement',   14, 16,  C.E_BG, C.E_FG],
    ]
    legendDefs.forEach(([text, cs, ce, bg, fg]) => {
      if (cs !== ce) wsEvals.mergeCells(`${colLetter(cs)}${legendRow}:${colLetter(ce)}${legendRow}`)
      const cell     = wsEvals.getCell(`${colLetter(cs)}${legendRow}`)
      cell.value     = text
      cell.font      = { name: 'Calibri', size: 9, bold: true, color: { argb: fg } }
      cell.fill      = sf(bg)
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      ab(cell)
    })
    fillMargins(wsEvals, legendRow, 2)

    addFooter(wsEvals, legendRow + 1, 'P', asOfDate)

    // ── Stream workbook ───────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="EF_Master_Log_${fileDate}.xlsx"`,
        'Cache-Control':       'no-store, max-age=0',
      },
    })
  } catch (err) {
    console.error('[export-master] GET unexpected:', err)
    return NextResponse.json(
      { error: 'Unexpected server error: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    )
  }
}
