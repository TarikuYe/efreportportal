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

// ── Colour palette (AARRGGBB) — mirrors EOT Tracker template ──
const C = {
  NAVY_BG:        'FF1E3A8A',   // Corporate navy fill
  NAVY_FG:        'FFFFFFFF',   // White text on navy
  SLATE_BG:       'FFE2E8F0',   // Header row background
  BLACK_FG:       'FF111827',
  GRAY_FG:        'FF475569',
  MUTED_FG:       'FF64748B',
  // Alert fills (pastel)
  EXPIRED_BG:     'FFFEE2E2',   // Soft red
  EXPIRED_FG:     'FF991B1B',   // Dark red
  NEARLY_BG:      'FFFEF3C7',   // Soft amber
  NEARLY_FG:      'FF92400E',   // Dark amber
  OK_BG:          'FFF0FDF4',   // Soft green
  OK_FG:          'FF166534',   // Dark green
  BAND_A:         'FFFFFFFF',
  BAND_B:         'FFF8FAFC',
  SECTION_BG:     'FFE0E7FF',   // Indigo tint for client group headers
  SECTION_FG:     'FF1E3A8A',
  MARGIN_BG:      'FFFFFFFF',   // Left margin columns (A, B) — plain white
  APPROVED_BY_BG: 'FFFFFBEB',   // Soft amber tint — flags "fill me in"
  REMARKS_BG:     'FFFAFAF9',   // Soft neutral tint — flags "fill me in"
  THIN:  { style: 'thin'   as const },
  MED:   { style: 'medium' as const },
}

// ── Layout constants ──────────────────────────────────────
// Columns A and B are a blank left margin (matches the master template),
// so the table itself runs from column C to column N.
const FIRST_COL   = 3   // column C
const LAST_COL     = 14  // column N
const LAST_COL_LETTER = 'N'

// ── Utility helpers ───────────────────────────────────────
function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}
function allBorders(cell: ExcelJS.Cell) {
  cell.border = { top: C.THIN, bottom: C.THIN, left: C.THIN, right: C.THIN }
}
function medBorders(cell: ExcelJS.Cell) {
  cell.border = { top: C.MED, bottom: C.MED, left: C.MED, right: C.MED }
}
function cleanStr(v: string | null | undefined): string {
  const s = v?.trim()
  return s || '—'
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return String(d).substring(0, 10)
}
function daysRemaining(dateStr: string | null | undefined, today: Date): number | null {
  if (!dateStr) return null
  const exp = new Date(dateStr)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)
}
// EOT Status is driven by BOTH the approval status and the days remaining:
//  - no revised completion date on file            -> '—'   (nothing to evaluate yet)
//  - status is Rejected                             -> 'Rejected'
//  - status is Pending / Under Review / anything     -> evaluated against days remaining,
//    else not yet "Approved"                            same as an approved row (it still needs tracking)
//  - date has passed (<= 0 days left)               -> 'Expired'
//  - date is within 30 days                          -> 'Nearly Expired'
//  - otherwise                                        -> 'OK'
function eotStatus(
  statusStr: string | null | undefined,
  dateStr: string | null | undefined,
  today: Date
): 'Expired' | 'Nearly Expired' | 'OK' | 'Rejected' | '—' {
  const s = (statusStr || '').trim().toLowerCase()
  if (s === 'rejected') return 'Rejected'
  const dr = daysRemaining(dateStr, today)
  if (dr === null) return '—'
  if (dr <= 0)  return 'Expired'
  if (dr <= 30) return 'Nearly Expired'
  return 'OK'
}

// ── DB row shape ──────────────────────────────────────────
type EotRow = {
  id:                       string
  client_name:              string
  project_name:             string
  contractor_name:          string
  eot_number:               number | null
  days_approved:            number | null
  revised_completion_date:  string | null
  status:                   string
  reason_for_eot:           string
  approved_by:              string
  remarks:                  string
  // computed
  eot_status:               'Expired' | 'Nearly Expired' | 'OK' | 'Rejected' | '—'
  days_remaining:           number | null
}

// ── Main route handler ────────────────────────────────────
export async function GET(_req: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (!(await checkAdminOrDgm(user.id)))
      return NextResponse.json({ error: 'Admin or DGM access required.' }, { status: 403 })

    // 2. Fetch all EOT records sorted by revised completion date ASC
    const admin = createAdminClient()
    const PAGE_SIZE = 1000
    let rawAll: any[] = []
    let page = 0
    while (true) {
      const { data: pageData, error } = await admin
        .from('eot_tracker')
        .select('*')
        .order('revised_completion_date', { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (error) {
        console.error('[export-eot] DB:', error.message)
        return NextResponse.json({ error: 'Failed to retrieve EOT records.' }, { status: 500 })
      }
      rawAll = rawAll.concat(pageData ?? [])
      if (!pageData || pageData.length < PAGE_SIZE) break
      page++
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 3. Normalise + compute EOT status
    const rows: EotRow[] = rawAll.map((r: any) => {
      const revDate = r.revised_completion_date
        ? String(r.revised_completion_date).substring(0, 10)
        : null
      const statusRaw = cleanStr(r.status)
      return {
        id:                      r.id,
        client_name:             cleanStr(r.client_name),
        project_name:            cleanStr(r.project_name),
        contractor_name:         cleanStr(r.contractor_name),
        eot_number:              r.eot_number != null ? parseInt(String(r.eot_number), 10) : null,
        days_approved:           r.days_approved != null ? parseInt(String(r.days_approved), 10) : null,
        revised_completion_date: revDate,
        status:                  statusRaw,
        reason_for_eot:          cleanStr(r.reason_for_eot),
        // "Approved By" is intentionally left blank for the reviewer to fill in by hand —
        // if the DB later gains an approved_by column, wire it in here.
        approved_by:             cleanStr(r.approved_by),
        remarks:                 cleanStr(r.remarks),
        eot_status:              eotStatus(statusRaw, revDate, today),
        days_remaining:          daysRemaining(revDate, today),
      }
    })

    // 4. KPI tallies
    const totalRecords  = rows.length
    const expiredCount  = rows.filter(r => r.eot_status === 'Expired').length
    const nearlyCount   = rows.filter(r => r.eot_status === 'Nearly Expired').length
    const okCount       = rows.filter(r => r.eot_status === 'OK').length
    const approvedCount = rows.filter(r => r.status === 'Approved').length

    // Group by client for section merging
    const clientOrder: string[] = []
    const clientGroups = new Map<string, EotRow[]>()
    for (const row of rows) {
      if (!clientGroups.has(row.client_name)) {
        clientGroups.set(row.client_name, [])
        clientOrder.push(row.client_name)
      }
      clientGroups.get(row.client_name)!.push(row)
    }

    const asOfDate = today.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
    const fileDate = today.toISOString().split('T')[0].replace(/-/g, '')

    // ── Build workbook ────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator  = 'EF Architects & Engineers Consulting PLC'
    wb.created  = new Date()
    wb.modified = new Date()

    const ws = wb.addWorksheet('EOT-Register')
    // zoomScale locked at 100% so the sheet opens exactly as designed, no squint-and-scroll
    ws.views = [{ showGridLines: true, zoomScale: 100, state: 'frozen', xSplit: 0, ySplit: 5 }]

    // ── Column widths ─────────────────────────────────────
    //   A    B      C      D           E             F               G        H              I                        J        K               L             M          N
    // (margin)(margin)| S/N | Client | Project | Contractor | EOT No. | Days Approved | Revised Completion Date | Status | Reason for EOT | Approved By | Remarks | EOT Status
    const COL_WIDTHS = [3, 3, 7, 24, 38, 32, 9, 14, 22, 14, 40, 20, 26, 16]
    COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    // ═════════════════════════════════════════════════════
    // ROW 1 — Main title banner  (A1:N1)
    // ═════════════════════════════════════════════════════
    ws.mergeCells(`A1:${LAST_COL_LETTER}1`)
    const titleCell = ws.getCell('A1')
    titleCell.value = 'EF Architects & Engineers Consulting — Extension of Time (EOT) Register'
    titleCell.font  = { name: 'Calibri', size: 14, bold: true, color: { argb: C.NAVY_FG } }
    titleCell.fill  = solidFill(C.NAVY_BG)
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(1).height = 38

    // ─────────────────────────────────────────────────────
    // ROW 2 — (blank spacer row, subtle slate fill)
    // ─────────────────────────────────────────────────────
    ws.mergeCells(`A2:${LAST_COL_LETTER}2`)
    ws.getCell('A2').fill = solidFill('FFF1F5F9')
    ws.getRow(2).height = 6

    // ═════════════════════════════════════════════════════
    // ROW 3 — Operational metadata
    // ═════════════════════════════════════════════════════
    ws.getRow(3).height = 22

    ws.mergeCells('C3:I3')
    const prepCell = ws.getCell('C3')
    prepCell.value = 'Prepared By: Procurement and Contract Administration Department'
    prepCell.font  = { name: 'Calibri', size: 10, italic: true, color: { argb: C.GRAY_FG } }
    prepCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    prepCell.fill = solidFill('FFF8FAFC')

    ws.mergeCells('J3:N3')
    ws.getCell('J3').value = `As of Date: ${asOfDate}`
    ws.getCell('J3').font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.BLACK_FG } }
    ws.getCell('J3').alignment = { vertical: 'middle', horizontal: 'right' }
    ws.getCell('J3').fill = solidFill('FFF8FAFC')

    // Left margin cells for row 3 stay blank/white
    ;['A3', 'B3'].forEach(addr => { ws.getCell(addr).fill = solidFill(C.MARGIN_BG) })

    // ─────────────────────────────────────────────────────
    // ROW 4 — KPI summary bar
    // ─────────────────────────────────────────────────────
    ws.getRow(4).height = 24

    const kpiDefs: [string, number | string, string, string][] = [
      ['Total EOTs',   totalRecords,  C.NAVY_BG,    C.NAVY_FG],
      ['Approved',     approvedCount, 'FF166534',   C.NAVY_FG],
      ['🔴 Expired',   expiredCount,  'FF991B1B',   C.NAVY_FG],
      ['🟡 Near Exp.', nearlyCount,   'FF92400E',   C.NAVY_FG],
      ['🟢 OK',        okCount,       'FF14532D',   C.NAVY_FG],
    ]
    // Each KPI takes 2 columns starting at C; footer note sits at the far right (N)
    // C4:D4, E4:F4, G4:H4, I4:J4, K4:L4, note at M4:N4
    const kpiCols = ['C4:D4', 'E4:F4', 'G4:H4', 'I4:J4', 'K4:L4']
    kpiDefs.forEach(([label, value, bg, fg], i) => {
      ws.mergeCells(kpiCols[i])
      const cell = ws.getCell(kpiCols[i].split(':')[0])
      cell.value = `${label}:  ${value}`
      cell.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: fg } }
      cell.fill  = solidFill(bg)
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      medBorders(cell)
    })
    ws.mergeCells('M4:N4')
    const kpiNote = ws.getCell('M4')
    kpiNote.value = `Generated: ${asOfDate}`
    kpiNote.font  = { name: 'Calibri', size: 8, italic: true, color: { argb: C.MUTED_FG } }
    kpiNote.alignment = { vertical: 'middle', horizontal: 'right' }
    kpiNote.fill = solidFill('FFF8FAFC')

    ;['A4', 'B4'].forEach(addr => { ws.getCell(addr).fill = solidFill(C.MARGIN_BG) })

    // ═════════════════════════════════════════════════════
    // ROW 5 — Table header row
    // ═════════════════════════════════════════════════════
    ws.getRow(5).height = 28

    const HEADERS = [
      'S/N',
      'Client Name',
      'Project Name',
      'Contractor Name',
      'EOT No.',
      'Days Approved',
      'Revised Completion Date',
      'Status',
      'Reason for EOT',
      'Approved By',
      'Remarks',
      'EOT Status',
    ]
    HEADERS.forEach((h, i) => {
      const cell = ws.getRow(5).getCell(FIRST_COL + i)
      cell.value = h
      cell.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.BLACK_FG } }
      cell.fill  = solidFill(C.SLATE_BG)
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = { top: C.MED, bottom: C.MED, left: C.THIN, right: C.THIN }
    })
    ;['A5', 'B5'].forEach(addr => { ws.getCell(addr).fill = solidFill(C.MARGIN_BG) })

    // ═════════════════════════════════════════════════════
    // ROWS 6+ — Data, grouped by client with section headers
    // ═════════════════════════════════════════════════════
    let currentRow = 6
    let sn = 1

    for (const clientName of clientOrder) {
      const group = clientGroups.get(clientName)!
      const groupStart = currentRow
      const groupEnd   = currentRow + group.length - 1

      group.forEach((eot, i) => {
        const rowNum = currentRow + i
        const row    = ws.getRow(rowNum)
        row.height   = 20

        // Left margin columns stay blank/white for every data row
        ws.getCell(`A${rowNum}`).fill = solidFill(C.MARGIN_BG)
        ws.getCell(`B${rowNum}`).fill = solidFill(C.MARGIN_BG)

        // Alternating row band
        const band = i % 2 === 0 ? C.BAND_A : C.BAND_B

        // ── Col C: S/N (written + merged for the whole client group, first row only)
        if (i === 0) {
          const snCell = row.getCell(FIRST_COL)
          snCell.value = sn
          snCell.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.NAVY_FG } }
          snCell.fill  = solidFill(C.NAVY_BG)
          snCell.alignment = { vertical: 'middle', horizontal: 'center' }
          allBorders(snCell)

          if (groupEnd > groupStart) {
            ws.mergeCells(`C${groupStart}:C${groupEnd}`)
          }
        }

        // ── Col D: Client Name (written + merged for entire group)
        if (i === 0) {
          const clientCell = row.getCell(FIRST_COL + 1)
          clientCell.value = eot.client_name
          clientCell.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.SECTION_FG } }
          clientCell.fill  = solidFill(C.SECTION_BG)
          clientCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
          allBorders(clientCell)

          if (groupEnd > groupStart) {
            ws.mergeCells(`D${groupStart}:D${groupEnd}`)
          }
        }

        // ── Col E: Project Name
        const projCell = row.getCell(FIRST_COL + 2)
        projCell.value = eot.project_name
        projCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        projCell.fill  = solidFill(band)
        projCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }
        allBorders(projCell)

        // ── Col F: Contractor Name
        const ctrCell = row.getCell(FIRST_COL + 3)
        ctrCell.value = eot.contractor_name
        ctrCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        ctrCell.fill  = solidFill(band)
        ctrCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }
        allBorders(ctrCell)

        // ── Col G: EOT No. (integer, right-aligned)
        const eotNumCell = row.getCell(FIRST_COL + 4)
        eotNumCell.value = eot.eot_number ?? '—'
        eotNumCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        eotNumCell.fill  = solidFill(band)
        eotNumCell.alignment = { vertical: 'middle', horizontal: 'right' }
        allBorders(eotNumCell)

        // ── Col H: Days Approved (integer, right-aligned)
        const daysCell = row.getCell(FIRST_COL + 5)
        daysCell.value = eot.days_approved ?? '—'
        daysCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        daysCell.fill  = solidFill(band)
        daysCell.alignment = { vertical: 'middle', horizontal: 'right' }
        allBorders(daysCell)

        // ── Col I: Revised Completion Date (YYYY-MM-DD)
        const dateCell = row.getCell(FIRST_COL + 6)
        if (eot.revised_completion_date) {
          const parts = eot.revised_completion_date.split('-')
          if (parts.length === 3) {
            dateCell.value  = new Date(
              parseInt(parts[0], 10),
              parseInt(parts[1], 10) - 1,
              parseInt(parts[2], 10)
            )
            dateCell.numFmt = 'yyyy-mm-dd'
          } else {
            dateCell.value = eot.revised_completion_date
          }
        } else {
          dateCell.value = '—'
        }
        dateCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        dateCell.fill  = solidFill(band)
        dateCell.alignment = { vertical: 'middle', horizontal: 'center' }
        allBorders(dateCell)

        // ── Col J: Approval Status
        const statusCell = row.getCell(FIRST_COL + 7)
        statusCell.value = eot.status
        statusCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        statusCell.fill  = solidFill(band)
        statusCell.alignment = { vertical: 'middle', horizontal: 'center' }
        allBorders(statusCell)

        // ── Col K: Reason for EOT
        const reasonCell = row.getCell(FIRST_COL + 8)
        reasonCell.value = eot.reason_for_eot
        reasonCell.font  = { name: 'Calibri', size: 9, color: { argb: C.GRAY_FG } }
        reasonCell.fill  = solidFill(band)
        reasonCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }
        allBorders(reasonCell)

        // ── Col L: Approved By — left blank for manual sign-off, tinted so it's easy to spot
        const approvedByCell = row.getCell(FIRST_COL + 9)
        approvedByCell.value = eot.approved_by === '—' ? '' : eot.approved_by
        approvedByCell.font  = { name: 'Calibri', size: 10, color: { argb: C.BLACK_FG } }
        approvedByCell.fill  = solidFill(C.APPROVED_BY_BG)
        approvedByCell.alignment = { vertical: 'middle', horizontal: 'center' }
        allBorders(approvedByCell)

        // ── Col M: Remarks — free-text, left blank unless already on file
        const remarksCell = row.getCell(FIRST_COL + 10)
        remarksCell.value = eot.remarks === '—' ? '' : eot.remarks
        remarksCell.font  = { name: 'Calibri', size: 9, color: { argb: C.GRAY_FG } }
        remarksCell.fill  = solidFill(C.REMARKS_BG)
        remarksCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }
        allBorders(remarksCell)

        // ── Col N: EOT Status (conditional fill, driven by Status + Days Remaining)
        const eotStatusCell = row.getCell(FIRST_COL + 11)
        let statusBg: string
        let statusFg: string
        let statusPrefix: string
        switch (eot.eot_status) {
          case 'Expired':
            statusBg = C.EXPIRED_BG; statusFg = C.EXPIRED_FG; statusPrefix = '🔴 '; break
          case 'Nearly Expired':
            statusBg = C.NEARLY_BG;  statusFg = C.NEARLY_FG;  statusPrefix = '🟡 '; break
          case 'OK':
            statusBg = C.OK_BG;      statusFg = C.OK_FG;      statusPrefix = '🟢 '; break
          case 'Rejected':
            statusBg = 'FFF3F4F6';   statusFg = C.MUTED_FG;   statusPrefix = '⚪ '; break
          default:
            statusBg = 'FFF3F4F6'; statusFg = C.MUTED_FG; statusPrefix = ''; break
        }
        eotStatusCell.value = eot.eot_status === '—' ? '—' : `${statusPrefix}${eot.eot_status}`
        eotStatusCell.font  = {
          name: 'Calibri', size: 10,
          bold: eot.eot_status === 'Expired' || eot.eot_status === 'Nearly Expired',
          color: { argb: statusFg },
        }
        eotStatusCell.fill  = solidFill(statusBg)
        eotStatusCell.alignment = { vertical: 'middle', horizontal: 'center' }
        allBorders(eotStatusCell)
      })

      currentRow = groupEnd + 1
      sn++
    }

    // ── 3 blank placeholder rows ───────────────────────────
    for (let i = 0; i < 3; i++) {
      const rowNum = currentRow + i
      const row = ws.getRow(rowNum)
      row.height = 20
      ws.getCell(`A${rowNum}`).fill = solidFill(C.MARGIN_BG)
      ws.getCell(`B${rowNum}`).fill = solidFill(C.MARGIN_BG)
      // S/N placeholder
      const snCell = row.getCell(FIRST_COL)
      snCell.value = sn + i
      snCell.font  = { name: 'Calibri', size: 10, color: { argb: C.MUTED_FG } }
      snCell.fill  = solidFill('FFF9FAFB')
      snCell.alignment = { vertical: 'middle', horizontal: 'center' }
      for (let c = FIRST_COL; c <= LAST_COL; c++) allBorders(row.getCell(c))
    }
    currentRow += 3

    // ── Footer row ─────────────────────────────────────────
    ws.mergeCells(`A${currentRow}:${LAST_COL_LETTER}${currentRow}`)
    const footer = ws.getCell(`A${currentRow}`)
    footer.value = `Generated: ${asOfDate}  |  EF Architects & Engineers Consulting PLC  |  Procurement & Contract Administration Department`
    footer.font  = { name: 'Calibri', size: 8, italic: true, color: { argb: C.MUTED_FG } }
    footer.fill  = solidFill(C.SLATE_BG)
    footer.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(currentRow).height = 14

    // ── Stream workbook as binary attachment ──────────────
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="EF_EOT_Tracker_Master_${fileDate}.xlsx"`,
        'Cache-Control':       'no-store, max-age=0',
      },
    })
  } catch (err) {
    console.error('[export-eot] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Export failed: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    )
  }
}