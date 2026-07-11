import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Auth guard ────────────────────────────────────────────
async function checkAdminOrDgm(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: emp } = await admin
    .from('employees').select('role').eq('id', userId).maybeSingle()
  return emp?.role === 'admin' || emp?.role === 'dgm'
}

// ── Colour palette (AARRGGBB) ─────────────────────────────
const C = {
  NAVY_BG:      'FF1E3A8A',
  NAVY_FG:      'FFFFFFFF',
  SLATE_BG:     'FFE2E8F0',
  BLACK_FG:     'FF000000',
  GRAY_FG:      'FF4B5563',
  OVERDUE_BG:   'FFFEE2E2',
  OVERDUE_FG:   'FF991B1B',
  CLOSED_BG:    'FFF0FDF4',
  CLOSED_FG:    'FF166534',
  OPEN_BG:      'FFFEF3C7',
  OPEN_FG:      'FF92400E',
  NOTREQ_BG:    'FFF3F4F6',
  NOTREQ_FG:    'FF374151',
  INCOMING_FG:  'FF1E40AF',
  OUTGOING_FG:  'FFB45309',
  AMBER_BG:     'FFFEF3C7',
  AMBER_FG:     'FF92400E',
  KPI_BLUE_BG:  'FFDBEAFE',
  KPI_BLUE_FG:  'FF1D4ED8',
  KPI_RED_BG:   'FFFEE2E2',
  KPI_RED_FG:   'FF991B1B',
  KPI_GREEN_BG: 'FFF0FDF4',
  KPI_GREEN_FG: 'FF166534',
  THIN:  { style: 'thin'   as const },
  MED:   { style: 'medium' as const },
}

// ── Utility helpers ───────────────────────────────────────
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return String(d).substring(0, 10)
}
function fmtMonth(d: string | null | undefined): string {
  if (!d) return '—'
  return String(d).substring(0, 7) // YYYY-MM
}
function cleanStr(v: string | null | undefined): string {
  const s = v?.trim()
  return s && s !== '0' ? s : '—'
}
function agingDays(dateLogged: string | null | undefined): number {
  if (!dateLogged) return 0
  const logged = new Date(dateLogged)
  const today  = new Date()
  today.setHours(0, 0, 0, 0)
  logged.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - logged.getTime()) / 86_400_000))
}
function calcStatus(l: any, todayISO: string): string {
  if (!l.response_required) return 'Not Required'
  if (l.response_sent_date)  return 'Closed'
  if (l.response_due_date && l.response_due_date < todayISO) return 'Overdue'
  return 'Open'
}
function allBorders(cell: ExcelJS.Cell) {
  cell.border = { top: C.THIN, bottom: C.THIN, left: C.THIN, right: C.THIN }
}
function medBorders(cell: ExcelJS.Cell) {
  cell.border = { top: C.MED, bottom: C.MED, left: C.MED, right: C.MED }
}
function statusBg(status: string): [string, string] {
  switch (status) {
    case 'Overdue':      return [C.OVERDUE_BG,  C.OVERDUE_FG]
    case 'Closed':       return [C.CLOSED_BG,   C.CLOSED_FG]
    case 'Open':         return [C.OPEN_BG,      C.OPEN_FG]
    default:             return [C.NOTREQ_BG,   C.NOTREQ_FG]
  }
}
function applyStatusCell(cell: ExcelJS.Cell, status: string) {
  const [bg, fg] = statusBg(status)
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
  cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: fg } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  allBorders(cell)
}
function setCell(
  ws: ExcelJS.Worksheet, addr: string, value: string | number | null | undefined,
  bg: string, fg: string, bold = false, size = 9
) {
  const cell = ws.getCell(addr)
  cell.value = value
  cell.font  = { name: 'Calibri', size, bold, color: { argb: fg } }
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  allBorders(cell)
}
function autoFit(ws: ExcelJS.Worksheet) {
  ws.columns.forEach(col => {
    let max = 8
    col.eachCell!({ includeEmpty: false }, cell => {
      const v   = cell.value
      const len = typeof v === 'string' ? v.length
                : v instanceof Date     ? 10
                : v != null             ? String(v).length : 0
      if (len > max) max = len
    })
    col.width = Math.min(45, Math.max(8, max + 2))
  })
}

// ── Shared sheet-header builder ───────────────────────────
function buildSheetBanner(
  ws: ExcelJS.Worksheet,
  title: string,
  lastUpdated: string,
  dateRange: string,
  lastColLetter: string,  // e.g. 'M'
  colCount: number        // total number of columns
) {
  // Row 1 — corporate title banner
  ws.mergeCells(`A1:${lastColLetter}1`)
  const t = ws.getCell('A1')
  t.value = `EF Architects & Engineers Consulting  —  ${title}`
  t.font  = { name: 'Calibri', size: 13, bold: true, color: { argb: C.NAVY_FG } }
  t.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_BG } }
  t.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 28

  // Row 2 — subtitle
  ws.mergeCells(`A2:${lastColLetter}2`)
  const sub = ws.getCell('A2')
  sub.value = 'Correspondence Log — Inward & Outward'
  sub.font  = { name: 'Calibri', size: 9, italic: true, color: { argb: C.GRAY_FG } }
  sub.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SLATE_BG } }
  sub.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(2).height = 14

  // Row 3 — metadata
  ws.getCell('A3').value = `Last Updated: ${lastUpdated}`
  ws.getCell('A3').font  = { name: 'Calibri', size: 8, color: { argb: C.GRAY_FG } }

  const rightAddr = String.fromCharCode(64 + colCount) + '3'
  ws.getCell(rightAddr).value = `Date Range: ${dateRange}`
  ws.getCell(rightAddr).font  = { name: 'Calibri', size: 8, color: { argb: C.GRAY_FG } }
  ws.getCell(rightAddr).alignment = { horizontal: 'right' }
  ws.getRow(3).height = 13
}

// ── Header row builder ────────────────────────────────────
function buildHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, headers: string[]) {
  const row = ws.getRow(rowNum)
  row.height = 22
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1)
    cell.value = h
    cell.font  = { name: 'Calibri', size: 9, bold: true, color: { argb: C.BLACK_FG } }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SLATE_BG } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { top: C.MED, bottom: C.MED, left: C.THIN, right: C.THIN }
  })
}

// ── KPI bar builder (used on Outgoing & Incoming sheets) ──
function buildKpiBar(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  total: number, open: number, overdue: number,
  closed: number, notReq: number,
  rateLabel: string,
  lastColLetter: string
) {
  ws.mergeCells(`A${rowNum}:B${rowNum}`)
  setCell(ws, `A${rowNum}`, `TOTAL  ${total}`,    C.NAVY_BG,    C.NAVY_FG,    true, 10)
  ws.mergeCells(`C${rowNum}:D${rowNum}`)
  setCell(ws, `C${rowNum}`, `OPEN  ${open}`,       C.OPEN_BG,    C.OPEN_FG,    true, 10)
  ws.mergeCells(`E${rowNum}:F${rowNum}`)
  setCell(ws, `E${rowNum}`, `OVERDUE  ${overdue}`, C.OVERDUE_BG, C.OVERDUE_FG, true, 10)
  ws.mergeCells(`G${rowNum}:H${rowNum}`)
  setCell(ws, `G${rowNum}`, `CLOSED  ${closed}`,   C.CLOSED_BG,  C.CLOSED_FG,  true, 10)
  if (notReq > 0) {
    ws.mergeCells(`I${rowNum}:J${rowNum}`)
    setCell(ws, `I${rowNum}`, `NOT REQ  ${notReq}`, C.NOTREQ_BG, C.NOTREQ_FG,  true, 10)
  }
  ws.mergeCells(`K${rowNum}:${lastColLetter}${rowNum}`)
  setCell(ws, `K${rowNum}`, `${rateLabel}`, C.KPI_BLUE_BG, C.KPI_BLUE_FG, true, 10)
  ws.getRow(rowNum).height = 22
}

// ── GET /api/registrar/export-correspondence ──────────────
export async function GET(_req: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await checkAdminOrDgm(user.id)))
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })

    // 2. Fetch all correspondence sorted chronologically DESC
    const admin = createAdminClient()
    const { data: raw, error } = await admin
      .from('correspondence_register')
      .select('*')
      .order('date_logged', { ascending: false })
    if (error) {
      console.error('[export-correspondence] DB:', error.message)
      return NextResponse.json({ error: 'Failed to retrieve records.' }, { status: 500 })
    }

    // 3. Normalise rows + recalculate live status
    const todayISO  = new Date().toISOString().split('T')[0]
    const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

    const all = (raw ?? []).map((l: any) => ({
      id:           l.id,
      ref:          cleanStr(l.letter_ref_no),
      dateLogged:   fmtDate(l.date_logged),
      month:        fmtMonth(l.date_logged),
      direction:    cleanStr(l.direction),
      counterparty: cleanStr(l.counterparty),
      subject:      cleanStr(l.subject),
      category:     cleanStr(l.category),
      respRequired: l.response_required,
      dueDate:      fmtDate(l.response_due_date),
      linkedRef:    cleanStr(l.linked_response_ref),
      sentDate:     fmtDate(l.response_sent_date),
      status:       calcStatus(l, todayISO),
      aging:        agingDays(l.date_logged),
      remarks:      cleanStr(l.remarks ?? null),
    }))

    const outgoing = all.filter(r => r.direction === 'Outgoing')
    const incoming = all.filter(r => r.direction === 'Incoming')

    // Compute summary stats
    const stats = (rows: typeof all) => ({
      total:   rows.length,
      open:    rows.filter(r => r.status === 'Open').length,
      overdue: rows.filter(r => r.status === 'Overdue').length,
      closed:  rows.filter(r => r.status === 'Closed').length,
      notReq:  rows.filter(r => r.status === 'Not Required').length,
      rate:    (rows.length > 0
        ? ((rows.filter(r => r.status === 'Closed').length / rows.length) * 100).toFixed(1)
        : '0.0') + '%',
    })

    const outStats = stats(outgoing)
    const inStats  = stats(incoming)
    const totStats = stats(all)

    // Date range label
    const datesAll = all.map(r => r.dateLogged).filter(d => d !== '—').sort()
    const dateRange = datesAll.length
      ? `${datesAll[0]}  to  ${datesAll[datesAll.length - 1]}`
      : 'N/A'

    // 4. Build workbook
    const wb = new ExcelJS.Workbook()
    wb.creator = 'EF Architects & Engineers Consulting PLC'
    wb.created = new Date()

    // ════════════════════════════════════════════════════════
    // SHEET 1 — Letter Tracking (blank template register)
    // ════════════════════════════════════════════════════════
    const wsTrack = wb.addWorksheet('Letter Tracking')
    wsTrack.views = [{ showGridLines: true, zoomScale: 100 }]

    const TRACK_HEADERS = ['S.No','Letter Ref No.','Date','Direction','From (Sender)','To (Recipient)','Subject','Mode','Priority','Assigned To','Action Required','Due Date','Status','Date Closed','Remarks']
    // Title banner
    wsTrack.mergeCells(`A1:O1`)
    const trTitle = wsTrack.getCell('A1')
    trTitle.value = 'LETTER TRACKING REGISTER'
    trTitle.font  = { name: 'Calibri', size: 13, bold: true, color: { argb: C.NAVY_FG } }
    trTitle.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_BG } }
    trTitle.alignment = { vertical: 'middle', horizontal: 'center' }
    wsTrack.getRow(1).height = 28

    wsTrack.mergeCells('A2:O2')
    const trSub = wsTrack.getCell('A2')
    trSub.value = 'Correspondence Log — Inward & Outward'
    trSub.font  = { name: 'Calibri', size: 9, italic: true, color: { argb: C.GRAY_FG } }
    trSub.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SLATE_BG } }
    trSub.alignment = { vertical: 'middle', horizontal: 'center' }
    wsTrack.getRow(2).height = 14

    buildHeaderRow(wsTrack, 3, TRACK_HEADERS)

    // 30 blank numbered rows
    for (let i = 1; i <= 30; i++) {
      const row = wsTrack.getRow(3 + i)
      row.height = 17
      row.getCell(1).value = i
      row.getCell(1).font  = { name: 'Calibri', size: 9 }
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      for (let c = 1; c <= 15; c++) allBorders(row.getCell(c))
    }

    //           S/N  Ref   Date  Dir  From  To    Subject  Mode  Pri  Assigned  Action  Due  Status  Closed  Remarks
    const trackWidths = [5, 15, 11, 10, 18, 18, 28, 10, 9, 15, 18, 11, 11, 11, 18]
    trackWidths.forEach((w, i) => { wsTrack.getColumn(i + 1).width = w })
    // Freeze header rows
    wsTrack.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, showGridLines: true, zoomScale: 100 }]

    // ════════════════════════════════════════════════════════
    // SHEET 2 — Dashboard
    // ════════════════════════════════════════════════════════
    const wsDash = wb.addWorksheet('Dashboard')
    wsDash.views = [{ showGridLines: true, zoomScale: 100 }]

    // Banner — spans all 7 columns (A:G) to cover the breakdown table width
    wsDash.mergeCells('A1:G1')
    const dashTitle = wsDash.getCell('A1')
    dashTitle.value = 'CORRESPONDENCE DASHBOARD'
    dashTitle.font  = { name: 'Calibri', size: 13, bold: true, color: { argb: C.NAVY_FG } }
    dashTitle.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_BG } }
    dashTitle.alignment = { vertical: 'middle', horizontal: 'center' }
    wsDash.getRow(1).height = 28

    wsDash.mergeCells('A2:G2')
    const dashSub = wsDash.getCell('A2')
    dashSub.value = 'Consolidated summary — Outgoing & Incoming registers'
    dashSub.font  = { name: 'Calibri', size: 9, italic: true, color: { argb: C.GRAY_FG } }
    dashSub.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SLATE_BG } }
    dashSub.alignment = { vertical: 'middle', horizontal: 'center' }
    wsDash.getRow(2).height = 14

    // Row 3: spacer
    wsDash.getRow(3).height = 6

    // Row 4: KPI tile labels — each tile spans 1 col, 4 tiles total A-D
    const kpiLabels = ['Total Letters', 'Open', 'Overdue', 'Closure Rate']
    const kpiValues = [totStats.total, totStats.open, totStats.overdue, totStats.rate]
    const kpiAddrs  = ['A4','B4','C4','D4']
    const kpiVAddrs = ['A5','B5','C5','D5']
    const kpiBgs    = [C.NAVY_BG, C.OPEN_BG, C.OVERDUE_BG, C.KPI_GREEN_BG]
    const kpiFgs    = [C.NAVY_FG, C.OPEN_FG, C.OVERDUE_FG, C.KPI_GREEN_FG]

    kpiLabels.forEach((lbl, i) => {
      const lc = wsDash.getCell(kpiAddrs[i])
      lc.value = lbl
      lc.font  = { name: 'Calibri', size: 9, bold: true, color: { argb: kpiFgs[i] } }
      lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiBgs[i] } }
      lc.alignment = { vertical: 'middle', horizontal: 'center' }
      medBorders(lc)

      const vc = wsDash.getCell(kpiVAddrs[i])
      vc.value = kpiValues[i]
      vc.font  = { name: 'Calibri', size: 16, bold: true, color: { argb: kpiFgs[i] } }
      vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiBgs[i] } }
      vc.alignment = { vertical: 'middle', horizontal: 'center' }
      medBorders(vc)
    })
    wsDash.getRow(4).height = 18
    wsDash.getRow(5).height = 30

    // Row 6: spacer
    wsDash.getRow(6).height = 8

    // Row 7: Breakdown table header
    const breakHdrs = ['Register', 'Total', 'Open', 'Overdue', 'Closed', 'Not Required', 'Closure Rate']
    buildHeaderRow(wsDash, 7, breakHdrs)

    // Rows 8-10: Outgoing / Incoming / Total
    const bkData = [
      { label: 'Outgoing', s: outStats },
      { label: 'Incoming', s: inStats  },
      { label: 'Total',    s: totStats },
    ]
    bkData.forEach(({ label, s }, i) => {
      const row = wsDash.getRow(8 + i)
      row.height = 17
      const vals = [label, s.total, s.open, s.overdue, s.closed, s.notReq, s.rate]
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1)
        cell.value = v
        cell.font  = { name: 'Calibri', size: 9, bold: label === 'Total' }
        cell.alignment = { vertical: 'middle', horizontal: ci === 0 ? 'left' : 'center' }
        allBorders(cell)
        if (ci === 2) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.OPEN_BG } };    cell.font = { name: 'Calibri', size: 9, bold: label === 'Total', color: { argb: C.OPEN_FG } } }
        if (ci === 3) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.OVERDUE_BG } }; cell.font = { name: 'Calibri', size: 9, bold: label === 'Total', color: { argb: C.OVERDUE_FG } } }
        if (ci === 4) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.CLOSED_BG } };  cell.font = { name: 'Calibri', size: 9, bold: label === 'Total', color: { argb: C.CLOSED_FG } } }
        if (label === 'Total') cell.fill = cell.fill ?? { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SLATE_BG } }
      })
    })
    //                        Register  Total  Open  Overdue  Closed  Not Req  Rate
    const dashWidths = [14, 8, 8, 10, 9, 12, 13]
    dashWidths.forEach((w, i) => { wsDash.getColumn(i + 1).width = w })

    // Footer
    wsDash.getRow(12).height = 13
    const footCell = wsDash.getCell('A12')
    footCell.value = `Generated: ${lastUpdated}  |  EF Architects & Engineers Consulting PLC`
    footCell.font  = { name: 'Calibri', size: 8, italic: true, color: { argb: C.GRAY_FG } }
    wsDash.mergeCells('A12:G12')
    footCell.alignment = { horizontal: 'center' }

    // ════════════════════════════════════════════════════════
    // SHEET 3 — Outgoing_Register
    // ════════════════════════════════════════════════════════
    const wsOut = wb.addWorksheet('Outgoing_Register')
    wsOut.views = [{ showGridLines: true, zoomScale: 100 }]

    buildSheetBanner(wsOut, 'OUTGOING LETTER REGISTER & REPLY MONITORING', lastUpdated, dateRange, 'M', 13)

    // Row 4: KPI bar
    buildKpiBar(wsOut, 4, outStats.total, outStats.open, outStats.overdue, outStats.closed, outStats.notReq,
      `REPLY RATE  ${outStats.rate}`, 'M')

    // Row 5: spacer
    wsOut.getRow(5).height = 6

    // Row 6: Table headers
    const OUT_HEADERS = ['S/No.','Letter Ref. No.','Date Sent','To (Recipient)','Subject','Category','Reply Reqd?','Reply Due Date','Reply Ref. No.','Reply Recd. Date','Status','Aging (Days)','Remarks']
    buildHeaderRow(wsOut, 6, OUT_HEADERS)

    // Rows 7+: Outgoing data
    outgoing.forEach((r, i) => {
      const row = wsOut.getRow(7 + i)
      row.height = 17
      const vals = [
        i + 1, r.ref, r.dateLogged, r.counterparty, r.subject,
        r.category, r.respRequired ? 'Yes' : 'No',
        r.dueDate, r.linkedRef, r.sentDate, r.status, r.aging, r.remarks
      ]
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1)
        cell.value = v
        cell.font  = { name: 'Calibri', size: 9 }
        allBorders(cell)
        cell.alignment = {
          vertical: 'middle',
          horizontal: ci === 4 ? 'left' : ci === 3 ? 'left' : 'center',
        }
      })
      applyStatusCell(row.getCell(11), r.status)
      if (r.status === 'Overdue')
        wsOut.getRow(7 + i).getCell(12).font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.OVERDUE_FG } }
    })

    // Empty rows padding
    const outEnd = 7 + outgoing.length
    for (let i = outEnd; i < outEnd + 3; i++) {
      const row = wsOut.getRow(i)
      row.height = 17
      for (let c = 1; c <= 13; c++) allBorders(row.getCell(c))
    }

    //           S/N  Ref   Date  Recipient  Subject  Cat  Reqd  Due   Linked  Sent  Status  Aging  Remarks
    const outWidths = [5, 15, 11, 20, 28, 11, 8, 11, 15, 11, 12, 8, 18]
    outWidths.forEach((w, i) => { wsOut.getColumn(i + 1).width = w })
    // Freeze rows 1-6 (banner + KPI + header) and first 2 columns
    wsOut.views = [{ state: 'frozen', xSplit: 2, ySplit: 6, showGridLines: true, zoomScale: 100 }]

    // ════════════════════════════════════════════════════════
    // SHEET 4 — Incoming_Register
    // ════════════════════════════════════════════════════════
    const wsIn = wb.addWorksheet('Incoming_Register')
    wsIn.views = [{ showGridLines: true, zoomScale: 100 }]

    buildSheetBanner(wsIn, 'INCOMING LETTER REGISTER & RESPONSE MONITORING', lastUpdated, dateRange, 'M', 13)

    // Row 4: KPI bar
    buildKpiBar(wsIn, 4, inStats.total, inStats.open, inStats.overdue, inStats.closed, inStats.notReq,
      `RESP. RATE  ${inStats.rate}`, 'M')

    // Row 5: spacer
    wsIn.getRow(5).height = 6

    // Row 6: Table headers
    const IN_HEADERS = ['S/No.','Letter Ref. No.','Date Recd.','From (Sender)','Subject','Category','Resp. Reqd?','Response Due Date','Our Resp. Ref.','Resp. Sent Date','Status','Aging (Days)','Remarks']
    buildHeaderRow(wsIn, 6, IN_HEADERS)

    // Rows 7+: Incoming data
    incoming.forEach((r, i) => {
      const row = wsIn.getRow(7 + i)
      row.height = 17
      const vals = [
        i + 1, r.ref, r.dateLogged, r.counterparty, r.subject,
        r.category, r.respRequired ? 'Yes' : 'No',
        r.dueDate, r.linkedRef, r.sentDate, r.status, r.aging, r.remarks
      ]
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1)
        cell.value = v
        cell.font  = { name: 'Calibri', size: 9 }
        allBorders(cell)
        cell.alignment = {
          vertical: 'middle',
          horizontal: ci === 4 ? 'left' : ci === 3 ? 'left' : 'center',
        }
      })
      applyStatusCell(row.getCell(11), r.status)
      if (r.status === 'Overdue')
        wsIn.getRow(7 + i).getCell(12).font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.OVERDUE_FG } }
    })

    // Empty rows padding
    const inEnd = 7 + incoming.length
    for (let i = inEnd; i < inEnd + 3; i++) {
      const row = wsIn.getRow(i)
      row.height = 17
      for (let c = 1; c <= 13; c++) allBorders(row.getCell(c))
    }

    //          S/N  Ref   Date  Sender  Subject  Cat  Reqd  Due   Our Ref  Sent  Status  Aging  Remarks
    const inWidths = [5, 15, 11, 20, 28, 11, 8, 11, 15, 11, 12, 8, 18]
    inWidths.forEach((w, i) => { wsIn.getColumn(i + 1).width = w })
    // Freeze rows 1-6 and first 2 columns
    wsIn.views = [{ state: 'frozen', xSplit: 2, ySplit: 6, showGridLines: true, zoomScale: 100 }]

    // ════════════════════════════════════════════════════════
    // SHEET 5 — Consolidated_Data
    // ════════════════════════════════════════════════════════
    const wsCon = wb.addWorksheet('Consolidated_Data')
    wsCon.views = [{ showGridLines: true, zoomScale: 100 }]

    // Banner
    wsCon.mergeCells('A1:I1')
    const conTitle = wsCon.getCell('A1')
    conTitle.value = 'EF Architects & Engineers  —  Consolidated Correspondence Data'
    conTitle.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.NAVY_FG } }
    conTitle.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.NAVY_BG } }
    conTitle.alignment = { vertical: 'middle', horizontal: 'center' }
    wsCon.getRow(1).height = 24

    // Sub-header
    wsCon.mergeCells('A2:I2')
    const conSub = wsCon.getCell('A2')
    conSub.value = `Generated: ${lastUpdated}  |  Total records: ${all.length}`
    conSub.font  = { name: 'Calibri', size: 8, italic: true, color: { argb: C.GRAY_FG } }
    conSub.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SLATE_BG } }
    conSub.alignment = { vertical: 'middle', horizontal: 'center' }
    wsCon.getRow(2).height = 12

    const CON_HEADERS = ['Direction','Letter Ref No','Date','Month','Counterparty','Subject','Category','Status','Aging (Days)']
    buildHeaderRow(wsCon, 3, CON_HEADERS)

    // All rows (outgoing first, then incoming — matching the uploaded file layout)
    const sorted = [
      ...all.filter(r => r.direction === 'Outgoing'),
      ...all.filter(r => r.direction === 'Incoming'),
    ]

    sorted.forEach((r, i) => {
      const row = wsCon.getRow(4 + i)
      row.height = 17
      const vals = [r.direction, r.ref, r.dateLogged, r.month, r.counterparty, r.subject, r.category, r.status, r.aging]
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1)
        cell.value = v
        cell.font  = { name: 'Calibri', size: 8 }
        cell.alignment = { vertical: 'middle', horizontal: ci === 5 ? 'left' : ci === 4 ? 'left' : 'center' }
        allBorders(cell)
      })
      const dirCell = row.getCell(1)
      if (r.direction === 'Incoming') {
        dirCell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: C.INCOMING_FG } }
        dirCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.KPI_BLUE_BG } }
      } else {
        dirCell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: C.OUTGOING_FG } }
        dirCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.AMBER_BG } }
      }
      applyStatusCell(row.getCell(8), r.status)
    })

    // Fixed widths: Direction|Ref|Date|Month|Counterparty|Subject|Category|Status|Aging
    const conWidths = [9, 14, 10, 8, 18, 26, 10, 11, 7]
    conWidths.forEach((w, i) => { wsCon.getColumn(i + 1).width = w })
    // Freeze header rows
    wsCon.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, showGridLines: true, zoomScale: 100 }]

    // ── Stream workbook buffer ────────────────────────────
    const buffer  = await wb.xlsx.writeBuffer()
    const dateStr = todayISO.replace(/-/g, '')

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="EF_Correspondence_Register_${dateStr}.xlsx"`,
        'Cache-Control':       'no-store, max-age=0',
      },
    })
  } catch (err) {
    console.error('[export-correspondence] unexpected:', err)
    return NextResponse.json(
      { error: 'Export failed: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    )
  }
}